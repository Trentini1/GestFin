// Firebase SDK
import { signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, addDoc, getDoc, deleteDoc, onSnapshot, query, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Módulos locais
import { auth, db } from './firebase-config.js';
import { extractPdfImage, callGeminiForAnalysis } from './api.js';
import { getGiroTotal, animateCountUp, formatCurrency } from './utils.js';
import {
    createDashboardHTML, createLancamentosListHTML, createNovoLancamentoFormHTML,
    createLancamentosTableRowsHTML, createLancamentoDetailHTML, showAlertModal,
    showConfirmModal, closeModal, handleConfirm, renderPaginationControls, renderDashboardChart,
    renderNfPieChart
} from './ui.js';

// --- Estado da Aplicação ---
let currentUser = null;
let lancamentosUnsubscribe = null;
let allLancamentosData = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 15;
let selectedMonthFilter = new Date().getMonth();
let selectedYearFilter = new Date().getFullYear();
let searchTerm = '';
let sortState = { key: 'dataEmissao', direction: 'desc' };

// --- Seletores do DOM ---
const loadingView = document.getElementById('loadingView');
const loaderContainer = document.getElementById('loaderContainer');
const loginContainer = document.getElementById('loginContainer');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const appView = document.getElementById('appView');
const allViews = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-link');
const userIdEl = document.getElementById('userId');

// --- Lógica de Autenticação ---
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        userIdEl.textContent = user.uid.substring(0, 8) + '...';
        loadingView.style.display = 'none';
        appView.style.display = 'block';
        if (!lancamentosUnsubscribe) {
            attachLancamentosListener();
        }
    } else {
        currentUser = null;
        appView.style.display = 'none';
        loadingView.style.display = 'flex';
        loaderContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        if (lancamentosUnsubscribe) {
            lancamentosUnsubscribe();
            lancamentosUnsubscribe = null;
        }
    }
});

loginButton.addEventListener('click', () => {
    loaderContainer.classList.remove('hidden');
    loginContainer.classList.add('hidden');
    signInAnonymously(auth).catch(error => {
        showAlertModal('Erro de Autenticação', error.message);
        loaderContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    });
});

logoutButton.addEventListener('click', () => signOut(auth));

// --- Lógica de Dados (Firestore) ---
function attachLancamentosListener() {
    const q = query(collection(db, 'lancamentos'));
    lancamentosUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allLancamentosData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        const viewId = currentViewEl ? currentViewEl.id : 'dashboardView';
        showView(viewId);
    }, (error) => {
        showAlertModal("Erro de Conexão", "Não foi possível carregar os lançamentos.");
    });
}

// --- Lógica de Navegação e Renderização ---
async function showView(viewId, dataId = null) {
    allViews.forEach(v => v.style.display = 'none');
    const viewContainer = document.getElementById(viewId);
    if (viewContainer) {
        viewContainer.style.display = 'block';
    }

    if (viewId === 'lancamentoDetailView' && dataId) {
        viewContainer.innerHTML = `<div class="flex items-center justify-center h-96"><div class="loader"></div></div>`;
        lucide.createIcons();
        
        const docRef = doc(db, "lancamentos", dataId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            renderView(viewId, { firestoreId: docSnap.id, ...docSnap.data() });
        } else {
            showAlertModal("Erro", "Lançamento não encontrado.");
            showView('lancamentosListView');
        }
    } else {
        renderView(viewId, allLancamentosData);
    }

    if (viewId === 'lancamentosListView') {
        populateFiltersAndApply();
    } else if (viewId === 'dashboardView') {
        renderDashboardChart(allLancamentosData);
        renderNfPieChart(allLancamentosData);
        
        const giroEl = document.getElementById('giro-total-mes');
        const faturamentoEl = document.getElementById('faturamento-mes');
        const comissoesEl = document.getElementById('comissoes-mes');

        if (giroEl) animateCountUp(giroEl, parseFloat(giroEl.dataset.value));
        if (faturamentoEl) animateCountUp(faturamentoEl, parseFloat(faturamentoEl.dataset.value));
        if (comissoesEl) animateCountUp(comissoesEl, parseFloat(comissoesEl.dataset.value));
    }
    
    navLinks.forEach(link => {
        const isActive = link.dataset.view === viewId;
        link.classList.toggle('text-indigo-600', isActive);
        link.classList.toggle('border-b-2', isActive);
        link.classList.toggle('border-indigo-600', isActive);
        link.classList.toggle('text-slate-500', !isActive);
    });
}

function renderView(viewId, data) {
    const viewContainer = document.getElementById(viewId);
    if (!viewContainer) return;
    let html = '';
    switch (viewId) {
        case 'dashboardView': html = createDashboardHTML(data); break;
        case 'lancamentosListView': html = createLancamentosListHTML(); break;
        case 'lancamentoDetailView': html = createLancamentoDetailHTML(data); break;
    }
    viewContainer.innerHTML = html;
    lucide.createIcons();
}

// --- Lógica de Filtros e Paginação ---
function getFilteredData() {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const filtered = allLancamentosData.filter(l => {
        const date = l.dataEmissao?.toDate();
        if (!date) return false;

        const monthMatch = selectedMonthFilter == -1 || date.getMonth() === selectedMonthFilter;
        const yearMatch = selectedYearFilter == -1 || date.getFullYear() === selectedYearFilter;

        const searchMatch = !lowerCaseSearchTerm || 
                              (l.cliente && l.cliente.toLowerCase().includes(lowerCaseSearchTerm)) ||
                              (l.numeroNf && l.numeroNf.toLowerCase().includes(lowerCaseSearchTerm)) ||
                              (l.os && l.os.toLowerCase().includes(lowerCaseSearchTerm));
        
        return monthMatch && yearMatch && searchMatch;
    });
    
    filtered.sort((a, b) => {
        const valA = sortState.key === 'dataEmissao' ? a.dataEmissao?.toDate()?.getTime() : (a[sortState.key] || '').toLowerCase();
        const valB = sortState.key === 'dataEmissao' ? b.dataEmissao?.toDate()?.getTime() : (b[sortState.key] || '').toLowerCase();

        if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
    });

    return filtered;
}

function applyFilters() {
    const tableBody = document.getElementById('lancamentosTableBody');
    if(!tableBody) return;

    const filteredData = getFilteredData();
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    currentPage = Math.min(currentPage, totalPages) || 1;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(start, end);

    tableBody.innerHTML = createLancamentosTableRowsHTML(paginatedData);
    renderPaginationControls(currentPage, filteredData.length, totalPages, (direction) => {
        if (direction === 'prev' && currentPage > 1) currentPage--;
        if (direction === 'next' && currentPage < totalPages) currentPage++;
        applyFilters();
    });
    lucide.createIcons();
    updateSortUI();
}

function populateFiltersAndApply() {
    const monthFilter = document.getElementById('monthFilter');
    const yearFilter = document.getElementById('yearFilter');
    if (!monthFilter || !yearFilter) return;

    if (monthFilter.options.length <= 1) {
        const months = ["Todos", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        monthFilter.innerHTML = months.map((month, index) => `<option value="${index - 1}">${month}</option>`).join('');
    }
    
    const years = [...new Set(allLancamentosData.map(l => l.dataEmissao?.toDate().getFullYear()).filter(Boolean))];
    years.sort((a, b) => b - a);
    if (!years.includes(new Date().getFullYear())) {
        years.unshift(new Date().getFullYear());
    }
    yearFilter.innerHTML = `<option value="-1">Todos</option>` + years.map(year => `<option value="${year}">${year}</option>`).join('');
    
    monthFilter.value = selectedMonthFilter;
    yearFilter.value = selectedYearFilter;

    applyFilters();

    monthFilter.onchange = () => { selectedMonthFilter = parseInt(monthFilter.value, 10); currentPage = 1; applyFilters(); };
    yearFilter.onchange = () => { selectedYearFilter = parseInt(yearFilter.value, 10); currentPage = 1; applyFilters(); };

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            currentPage = 1;
            applyFilters();
        });
    }
}

function updateSortUI() {
    const container = document.getElementById('sort-reset-container');
    if (!container) return;
    
    document.querySelectorAll('.sort-btn i').forEach(icon => {
        icon.setAttribute('data-lucide', 'arrow-down-up');
    });

    if (sortState.key !== 'dataEmissao' || sortState.direction !== 'desc') {
        const activeBtn = document.querySelector(`.sort-btn[data-key="${sortState.key}"]`);
        if (activeBtn) {
            const icon = activeBtn.querySelector('i');
            icon.setAttribute('data-lucide', sortState.direction === 'asc' ? 'arrow-up' : 'arrow-down');
        }
        
        container.innerHTML = `
            <span class="text-sm text-slate-600 mr-2">Ordenado por: ${sortState.key}</span>
            <button id="reset-sort" class="text-slate-500 hover:text-red-600 p-1 rounded-full">
                <i data-lucide="x" class="h-4 w-4"></i>
            </button>
        `;
        container.classList.remove('hidden');
    } else {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
    lucide.createIcons();
}


// --- Lógica de Relatórios ---
function generatePrintReport() {
    const filtered = getFilteredData();
    if (filtered.length === 0) {
        showAlertModal('Aviso', 'Não há dados para exportar com os filtros selecionados.');
        return;
    }
    
    const monthName = document.getElementById('monthFilter').options[document.getElementById('monthFilter').selectedIndex].text;
    const yearName = document.getElementById('yearFilter').options[document.getElementById('yearFilter').selectedIndex].text;
    const title = `Relatório de Lançamentos: ${monthName} de ${yearName}`;
    
    let reportHTML = `
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: sans-serif; margin: 1cm; color: #333; } h1 { font-size: 18px; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; } table { width: 100%; border-collapse: collapse; font-size: 10px; } th, td { border: 1px solid #ddd; padding: 6px; text-align: left; } th { background-color: #f2f2f2; } .summary { margin-top: 20px; border-top: 2px solid #333; padding-top: 10px; font-size: 12px; } h2 { font-size: 16px; } @media print { body { -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body><h1>${title}</h1>
    `;

    const totalGiro = filtered.reduce((sum, l) => sum + getGiroTotal(l), 0);
    const totalComissao = filtered.reduce((sum, l) => sum + (l.comissao || 0), 0);

    reportHTML += `<table><thead><tr><th>Data</th><th>Cliente</th><th>NF</th><th>O.S/PC</th><th>Motor</th><th>Valor Total</th><th>Comissão</th><th>Faturado</th></tr></thead><tbody>`;

    filtered.forEach(l => {
        reportHTML += `
            <tr>
                <td>${l.dataEmissao?.toDate().toLocaleDateString('pt-BR')}</td><td>${l.cliente || '-'}</td><td>${l.numeroNf || 'NT'}</td><td>${l.os || ''}</td><td>${l.descricao || '-'}</td><td>${formatCurrency(getGiroTotal(l))}</td><td>${formatCurrency(l.comissao)}</td><td>${l.faturado ? l.faturado.toDate().toLocaleDateString('pt-BR') : 'Pendente'}</td>
            </tr>`;
    });

    reportHTML += `</tbody></table><div class="summary"><h2>Resumo do Período</h2><p><strong>Total Lançado (Giro):</strong> ${formatCurrency(totalGiro)}</p><p><strong>Total em Comissões:</strong> ${formatCurrency(totalComissao)}</p></div><script>window.onload = function() { window.print(); }<\/script></body></html>`;
    
    const printWindow = window.open('', '', 'height=800,width=800');
    printWindow.document.write(reportHTML);
    printWindow.document.close();
}

function generateCsvReport() {
    const filtered = getFilteredData();
      if (filtered.length === 0) {
        showAlertModal('Aviso', 'Não há dados para exportar com os filtros selecionados.');
        return;
    }

    const head = ['Data Emissao', 'Cliente', 'NF', 'OS/PC', 'Motor', 'Valor Total', 'Comissao', 'Faturado', 'Data Faturamento'];
    const body = filtered.map(l => [
        l.dataEmissao?.toDate().toLocaleDateString('pt-BR'), `"${(l.cliente || '').replace(/"/g, '""')}"`, l.numeroNf || '-', `"${(l.os || '').replace(/"/g, '""')}"`, `"${(l.descricao || '').replace(/"/g, '""')}"`, getGiroTotal(l).toFixed(2).replace('.',','), (l.comissao || 0).toFixed(2).replace('.',','), l.faturado ? 'Sim' : 'Nao', l.faturado ? l.faturado.toDate().toLocaleDateString('pt-BR') : ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + head.join(';') + '\n' + body.map(e => e.join(';')).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_lancamentos.csv");
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link);
}


// --- Event Listeners Globais ---
document.addEventListener('DOMContentLoaded', () => {
    showView('dashboardView');
});

appView.addEventListener('click', async (e) => {
    const { target } = e;
    
    const navLink = target.closest('.nav-link');
    if (navLink) {
        e.preventDefault();
        showView(navLink.dataset.view);
        return;
    }

    const sortBtn = target.closest('.sort-btn');
    if (sortBtn) {
        const key = sortBtn.dataset.key;
        if (sortState.key === key) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.key = key;
            sortState.direction = 'asc';
        }
        applyFilters();
    }

    const resetSortBtn = target.closest('#reset-sort');
    if (resetSortBtn) {
        sortState = { key: 'dataEmissao', direction: 'desc' };
        applyFilters();
    }

    if (target.closest('.view-details')) showView('lancamentoDetailView', target.closest('.view-details').dataset.id);
    else if (target.closest('.back-to-list')) showView('lancamentosListView');
    else if (target.id === 'toggleFormBtn') {
        const formContainer = document.getElementById('formContainer');
        if (formContainer.style.maxHeight) {
            formContainer.style.maxHeight = null;
            setTimeout(() => formContainer.innerHTML = '', 500);
        } else {
            formContainer.innerHTML = createNovoLancamentoFormHTML();
            formContainer.style.maxHeight = formContainer.scrollHeight + "px";
        }
    } 
    else if (target.id === 'cancelNewLancamento') {
        const formContainer = document.getElementById('formContainer');
        formContainer.style.maxHeight = null;
        setTimeout(() => formContainer.innerHTML = '', 500);
    } 
    else if (target.id === 'analiseIaBtn') document.getElementById('nfUploadInput').click();
    else if (target.closest('.faturado-toggle')) {
        const button = target.closest('.faturado-toggle');
        const lancamento = allLancamentosData.find(l => l.firestoreId === button.dataset.id);
        if (lancamento) {
            const newStatus = lancamento.faturado ? null : new Date();
            await updateDoc(doc(db, 'lancamentos', button.dataset.id), { faturado: newStatus });
        }
    } 
    else if (target.id === 'deleteLancamentoBtn') {
        const form = target.closest('form');
        if (form) {
            showConfirmModal('Excluir Lançamento', 'Tem certeza?', async () => {
                await deleteDoc(doc(db, "lancamentos", form.dataset.id));
                showAlertModal('Excluído!', 'O lançamento foi removido.');
                showView('lancamentosListView');
            });
        }
    } 
    else if (target.id === 'exportPdfBtn') generatePrintReport();
    else if (target.id === 'exportCsvBtn') generateCsvReport();
});

appView.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        if (form.id === 'novoLancamentoForm') {
            const dateValue = form.querySelector('#newDataEmissao').value;
            const valorTotal = parseFloat(form.querySelector('#newValorTotal').value) || 0;
            const taxaComissao = parseFloat(form.querySelector('#newTaxaComissao').value) || 0;
            
            await addDoc(collection(db, "lancamentos"), {
                dataEmissao: new Date(dateValue + 'T12:00:00Z'),
                cliente: form.querySelector('#newCliente').value,
                numeroNf: form.querySelector('#newNumeroNf').value || 'NT',
                os: form.querySelector('#newOs').value,
                descricao: form.querySelector('#newDescricao').value,
                valorTotal,
                taxaComissao,
                comissao: valorTotal * (taxaComissao / 100),
                faturado: null,
                obs: form.querySelector('#newObs').value
            });
            const formContainer = document.getElementById('formContainer');
            formContainer.style.maxHeight = null;
            setTimeout(() => formContainer.innerHTML = '', 500);

        } else if (form.id === 'editLancamentoForm') {
            const dateValue = form.querySelector('#editDataEmissao').value;
            const valorTotal = parseFloat(form.querySelector('#editValorTotal').value) || 0;
            const taxaComissao = parseFloat(form.querySelector('#editTaxaComissao').value) || 0;

            await updateDoc(doc(db, "lancamentos", form.dataset.id), {
                dataEmissao: new Date(dateValue + 'T12:00:00Z'),
                cliente: form.querySelector('#editCliente').value,
                numeroNf: form.querySelector('#editNumeroNf').value || 'NT',
                os: form.querySelector('#editOs').value,
                descricao: form.querySelector('#editDescricao').value,
                valorTotal,
                taxaComissao,
                comissao: valorTotal * (taxaComissao / 100),
                obs: form.querySelector('#editObs').value,
                valorMaterial: deleteField(),
                valorServico: deleteField()
            });
            showAlertModal('Sucesso', 'Alterações salvas.');
            showView('lancamentoDetailView', form.dataset.id)
        }
    } catch (error) {
        showAlertModal("Erro", `Não foi possível salvar. Erro: ${error.message}`);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
});

appView.addEventListener('change', async (e) => {
    if (e.target.id === 'nfUploadInput') {
        const files = e.target.files;
        if (!files.length) return;
        
        showAlertModal('Processando...', `Analisando ${files.length} arquivo(s). Esta janela fechará ao concluir.`);
        let successCount = 0;
        let errorCount = 0;
        
        for (const file of files) {
            try {
                const imageData = await extractPdfImage(file);
                const data = await callGeminiForAnalysis(imageData);
                
                let os_pc = data.os || '';
                if (data.pc) { os_pc = os_pc ? `${os_pc} / ${data.pc}` : data.pc; }
                const valorTotal = data.valorTotal || 0;
                const taxaComissao = 0.5;

                await addDoc(collection(db, "lancamentos"), {
                    dataEmissao: new Date(data.dataEmissao + 'T12:00:00Z'),
                    cliente: data.cliente,
                    numeroNf: data.numeroNf || 'NT',
                    os: os_pc,
                    descricao: data.observacoes,
                    valorTotal,
                    taxaComissao,
                    comissao: valorTotal * (taxaComissao / 100),
                    faturado: null,
                    obs: `Analisado por IA a partir de ${file.name}`
                });
                successCount++;
            } catch (error) {
                console.error(`Erro ao processar ${file.name}:`, error);
                errorCount++;
            }
        }
        
        closeModal('alertModal');
        showAlertModal('Concluído', `${successCount} arquivo(s) processado(s) com sucesso. ${errorCount > 0 ? `${errorCount} falharam.` : ''}`);
        e.target.value = '';
    }
});

document.getElementById('alertModalCloseButton').addEventListener('click', () => closeModal('alertModal'));
document.getElementById('confirmModalCancelButton').addEventListener('click', () => closeModal('confirmModal'));
document.getElementById('confirmModalConfirmButton').addEventListener('click', handleConfirm);
