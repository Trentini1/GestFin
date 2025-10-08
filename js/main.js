// Firebase SDK
import { signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, addDoc, getDoc, deleteDoc, onSnapshot, query, updateDoc, deleteField, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Módulos locais
import { auth, db } from './firebase-config.js';
import { extractPdfImage, callGeminiForAnalysis } from './api.js';
import { getGiroTotal, animateCountUp, formatCurrency } from './utils.js';
import {
    createDashboardHTML, createLancamentosListHTML, createNovoLancamentoFormHTML,
    createLancamentosTableRowsHTML, createLancamentoDetailHTML, showAlertModal,
    showConfirmModal, closeModal, handleConfirm, renderPaginationControls, renderDashboardChart,
    renderNfPieChart, createVariaveisViewHTML, createVariaveisTableRowsHTML,
    createClientesViewHTML, createClientesTableRowsHTML, createClienteDetailHTML,
    createNotasFiscaisViewHTML, createNotasCompraTableRowsHTML
} from './ui.js';

// --- Estado da Aplicação ---
let currentUser = null;
let lancamentosUnsubscribe = null;
let allLancamentosData = [];
let variaveisUnsubscribe = null;
let allVariaveisData = [];
let clientesUnsubscribe = null;
let allClientesData = [];
let notasCompraUnsubscribe = null;
let allNotasCompraData = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 15;
let selectedMonthFilter = new Date().getMonth();
let selectedYearFilter = new Date().getFullYear();
let searchTerm = '';
let sortState = { key: 'dataEmissao', direction: 'desc' };
const hoje = new Date();
const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
let dashboardStartDate = primeiroDiaDoMes;
let dashboardEndDate = hoje;

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
        if (!lancamentosUnsubscribe) attachLancamentosListener();
        if (!variaveisUnsubscribe) attachVariaveisListener();
        if (!clientesUnsubscribe) attachClientesListener();
        if (!notasCompraUnsubscribe) attachNotasCompraListener();
        showView('dashboardView');
    } else {
        currentUser = null;
        appView.style.display = 'none';
        loadingView.style.display = 'flex';
        if (loaderContainer) loaderContainer.classList.add('hidden');
        if (loginContainer) loginContainer.classList.remove('hidden');
        if (lancamentosUnsubscribe) { lancamentosUnsubscribe(); lancamentosUnsubscribe = null; }
        if (variaveisUnsubscribe) { variaveisUnsubscribe(); variaveisUnsubscribe = null; }
        if (clientesUnsubscribe) { clientesUnsubscribe(); clientesUnsubscribe = null; }
        if (notasCompraUnsubscribe) { notasCompraUnsubscribe(); notasCompraUnsubscribe = null; }
    }
});

loginButton.addEventListener('click', () => {
    if(loaderContainer) loaderContainer.classList.remove('hidden');
    if(loginContainer) loginContainer.classList.add('hidden');
    signInAnonymously(auth).catch(error => {
        showAlertModal('Erro de Autenticação', error.message);
        if(loaderContainer) loaderContainer.classList.add('hidden');
        if(loginContainer) loginContainer.classList.remove('hidden');
    });
});

logoutButton.addEventListener('click', () => signOut(auth));

// --- Lógica de Dados (Firestore) ---
function attachLancamentosListener() {
    const q = query(collection(db, 'lancamentos'));
    lancamentosUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allLancamentosData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl && currentViewEl.id === 'lancamentosListView') {
            applyFilters();
        }
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar os lançamentos."));
}

function attachVariaveisListener() {
    const q = query(collection(db, 'variaveis'));
    variaveisUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allVariaveisData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl && currentViewEl.id === 'variaveisView') {
            const tableBody = document.getElementById('variaveisTableBody');
            if (tableBody) tableBody.innerHTML = createVariaveisTableRowsHTML(allVariaveisData);
        }
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar as variáveis."));
}

function attachClientesListener() {
    const q = query(collection(db, 'clientes'));
    clientesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allClientesData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl && currentViewEl.id === 'clientesView') {
            const tableBody = document.getElementById('clientesTableBody');
            if (tableBody) tableBody.innerHTML = createClientesTableRowsHTML(allClientesData);
        }
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar os clientes."));
}

function attachNotasCompraListener() {
    const q = query(collection(db, 'notasCompra'));
    notasCompraUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allNotasCompraData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl && (currentViewEl.id === 'notasFiscaisView' || currentViewEl.id === 'lancamentoDetailView')) {
            showView(currentViewEl.id, currentViewEl.querySelector('form')?.dataset.id);
        }
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar as notas de compra."));
}


// --- Lógica de Navegação e Renderização ---
async function showView(viewId, dataId = null) {
    allViews.forEach(v => v.style.display = 'none');
    const viewContainer = document.getElementById(viewId);
    if (viewContainer) viewContainer.style.display = 'block';

    if (viewId === 'dashboardView') {
        const endDateFinal = new Date(dashboardEndDate);
        endDateFinal.setHours(23, 59, 59, 999);
        const dashboardLancamentos = allLancamentosData.filter(l => l.dataEmissao?.toDate() >= dashboardStartDate && l.dataEmissao?.toDate() <= endDateFinal);
        const dashboardVariaveis = allVariaveisData.filter(v => v.data?.toDate() >= dashboardStartDate && v.data?.toDate() <= endDateFinal);
        const totalVariaveis = dashboardVariaveis.reduce((sum, v) => sum + v.valor, 0);
        renderView(viewId, { dashboardLancamentos, totalVariaveis, startDate: dashboardStartDate, endDate: dashboardEndDate });
        renderDashboardChart(allLancamentosData);
        renderNfPieChart(dashboardLancamentos);
        document.querySelectorAll('.dashboard-value').forEach(el => animateCountUp(el, parseFloat(el.dataset.value)));
    } else if (viewId === 'variaveisView') {
        renderView(viewId);
        const tableBody = document.getElementById('variaveisTableBody');
        if (tableBody) tableBody.innerHTML = createVariaveisTableRowsHTML(allVariaveisData);
    } else if (viewId === 'clientesView') {
        renderView(viewId);
        const tableBody = document.getElementById('clientesTableBody');
        if (tableBody) tableBody.innerHTML = createClientesTableRowsHTML(allClientesData);
    } else if (viewId === 'notasFiscaisView') {
        renderView(viewId, allLancamentosData);
        const tableBody = document.getElementById('notasCompraTableBody');
        if (tableBody) tableBody.innerHTML = createNotasCompraTableRowsHTML(allNotasCompraData, allLancamentosData);
        document.getElementById('addItemBtn')?.click();
    } else if (viewId === 'lancamentoDetailView' && dataId) {
        viewContainer.innerHTML = `<div class="flex items-center justify-center h-96"><div class="loader"></div></div>`;
        lucide.createIcons();
        const docRef = doc(db, "lancamentos", dataId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const lancamento = { firestoreId: docSnap.id, ...docSnap.data() };
            const custosDaOs = allNotasCompraData.filter(nota => nota.osId === lancamento.os);
            renderView(viewId, { lancamento, custosDaOs });
        } else {
            showAlertModal("Erro", "Lançamento não encontrado.");
            showView('lancamentosListView');
        }
    } else if (viewId === 'clienteDetailView' && dataId) {
        const cliente = allClientesData.find(c => c.firestoreId === dataId);
        if (cliente) {
            renderView(viewId, cliente);
        } else {
            showAlertModal('Erro', 'Cliente não encontrado.');
            showView('clientesView');
        }
    } else if (viewId === 'lancamentosListView') {
        renderView(viewId);
        populateFiltersAndApply();
    } else {
        renderView(viewId);
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
        case 'dashboardView': html = createDashboardHTML(data.dashboardLancamentos, data.totalVariaveis, data.startDate, data.endDate); break;
        case 'variaveisView': html = createVariaveisViewHTML(); break;
        case 'clientesView': html = createClientesViewHTML(); break;
        case 'lancamentosListView': html = createLancamentosListHTML(); break;
        case 'lancamentoDetailView': html = createLancamentoDetailHTML(data); break;
        case 'notasFiscaisView': html = createNotasFiscaisViewHTML(data); break;
        case 'clienteDetailView': html = createClienteDetailHTML(data); break;
    }
    viewContainer.innerHTML = html;
    lucide.createIcons();
}

// --- Lógica de Filtros, Ordenação e Paginação ---
function getFilteredData() {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = allLancamentosData.filter(l => {
        const date = l.dataEmissao?.toDate();
        if (!date) return false;
        const monthMatch = selectedMonthFilter == -1 || date.getMonth() === selectedMonthFilter;
        const yearMatch = selectedYearFilter == -1 || date.getFullYear() === selectedYearFilter;
        const searchMatch = !lowerCaseSearchTerm || (l.cliente && l.cliente.toLowerCase().includes(lowerCaseSearchTerm)) || (l.numeroNf && l.numeroNf.toLowerCase().includes(lowerCaseSearchTerm)) || (l.os && l.os.toLowerCase().includes(lowerCaseSearchTerm));
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
    if (!tableBody) return;
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

    const years = [...new Set(allLancamentosData.map(l => l.dataEmissao?.toDate().getFullYear()).filter(Boolean))].sort((a, b) => b - a);
    if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear());
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
    document.querySelectorAll('.sort-btn i').forEach(icon => icon.setAttribute('data-lucide', 'arrow-down-up'));
    if (sortState.key !== 'dataEmissao' || sortState.direction !== 'desc') {
        const activeBtn = document.querySelector(`.sort-btn[data-key="${sortState.key}"]`);
        if (activeBtn) activeBtn.querySelector('i').setAttribute('data-lucide', sortState.direction === 'asc' ? 'arrow-up' : 'arrow-down');
        container.innerHTML = `
            <span class="text-sm text-slate-600 mr-2">Ordenado por: ${sortState.key}</span>
            <button id="reset-sort" class="text-slate-500 hover:text-red-600 p-1 rounded-full"><i data-lucide="x" class="h-4 w-4"></i></button>`;
        container.classList.remove('hidden');
    } else {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
    lucide.createIcons();
}

// --- Lógica de Relatórios e Backup ---
function generatePrintReport() {
    const filtered = getFilteredData();
    if (filtered.length === 0) return showAlertModal('Aviso', 'Não há dados para exportar.');
    const title = `Relatório de Lançamentos`;
    let reportHTML = `<html><head><title>${title}</title><style>body{font-family:sans-serif;margin:1cm;color:#333}h1{font-size:18px;border-bottom:1px solid #ccc;padding-bottom:10px;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background-color:#f2f2f2}.summary{margin-top:20px;border-top:2px solid #333;padding-top:10px;font-size:12px}h2{font-size:16px}@media print{body{-webkit-print-color-adjust:exact}}</style></head><body><h1>${title}</h1>`;
    const totalGiro = filtered.reduce((sum, l) => sum + getGiroTotal(l), 0);
    const totalComissao = filtered.reduce((sum, l) => sum + (l.comissao || 0), 0);
    reportHTML += `<table><thead><tr><th>Data</th><th>Cliente</th><th>NF</th><th>O.S/PC</th><th>Motor</th><th>Valor Total</th><th>Comissão</th><th>Faturado</th></tr></thead><tbody>`;
    filtered.forEach(l => {
        reportHTML += `<tr><td>${l.dataEmissao?.toDate().toLocaleDateString('pt-BR')}</td><td>${l.cliente || '-'}</td><td>${l.numeroNf || 'NT'}</td><td>${l.os || ''}</td><td>${l.descricao || '-'}</td><td>${formatCurrency(getGiroTotal(l))}</td><td>${formatCurrency(l.comissao)}</td><td>${l.faturado ? l.faturado.toDate().toLocaleDateString('pt-BR') : 'Pendente'}</td></tr>`;
    });
    reportHTML += `</tbody></table><div class="summary"><h2>Resumo do Período</h2><p><strong>Total Lançado (Giro):</strong> ${formatCurrency(totalGiro)}</p><p><strong>Total em Comissões:</strong> ${formatCurrency(totalComissao)}</p></div><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const printWindow = window.open('', '', 'height=800,width=800');
    printWindow.document.write(reportHTML);
    printWindow.document.close();
}

function generateCsvReport() {
    const filtered = getFilteredData();
    if (filtered.length === 0) return showAlertModal('Aviso', 'Não há dados para exportar.');
    const head = ['Data Emissao', 'Cliente', 'NF', 'OS/PC', 'Motor', 'Valor Total', 'Comissao', 'Faturado', 'Data Faturamento'];
    const body = filtered.map(l => [ l.dataEmissao?.toDate().toLocaleDateString('pt-BR'), `"${(l.cliente || '').replace(/"/g, '""')}"`, l.numeroNf || 'NT', `"${(l.os || '').replace(/"/g, '""')}"`, `"${(l.descricao || '').replace(/"/g, '""')}"`, getGiroTotal(l).toFixed(2).replace('.',','), (l.comissao || 0).toFixed(2).replace('.',','), l.faturado ? 'Sim' : 'Nao', l.faturado ? l.faturado.toDate().toLocaleDateString('pt-BR') : '' ]);
    const csvContent = "data:text/csv;charset=utf-8," + head.join(';') + '\n' + body.map(e => e.join(';')).join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "relatorio_lancamentos.csv");
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link);
}

function generateBackupFile() {
    if (allLancamentosData.length === 0 && allVariaveisData.length === 0 && allClientesData.length === 0 && allNotasCompraData.length === 0) return showAlertModal('Aviso', 'Não há dados para fazer backup.');
    const backupData = {
        lancamentos: allLancamentosData.map(l => ({ ...l, dataEmissao: l.dataEmissao.toDate().toISOString(), faturado: l.faturado ? l.faturado.toDate().toISOString() : null, firestoreId: undefined })),
        variaveis: allVariaveisData.map(v => ({ ...v, data: v.data.toDate().toISOString(), firestoreId: undefined })),
        clientes: allClientesData.map(c => ({...c, firestoreId: undefined })),
        notasCompra: allNotasCompraData.map(n => ({...n, dataEmissao: n.dataEmissao.toDate().toISOString(), firestoreId: undefined }))
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-gestao-pro-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function handleRestoreFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            const { lancamentos = [], variaveis = [], clientes = [], notasCompra = [] } = data;
            if (![lancamentos, variaveis, clientes, notasCompra].every(Array.isArray)) throw new Error("Formato de arquivo inválido.");

            showConfirmModal('Restaurar Backup?', `Isso adicionará novos dados e não apagará os existentes. Continuar?`, async () => {
                showAlertModal('Processando...', 'Restaurando backup...');
                const batch = writeBatch(db);
                lancamentos.forEach(l => batch.set(doc(collection(db, "lancamentos")), { ...l, dataEmissao: new Date(l.dataEmissao), faturado: l.faturado ? new Date(l.faturado) : null }));
                variaveis.forEach(v => batch.set(doc(collection(db, "variaveis")), { ...v, data: new Date(v.data) }));
                clientes.forEach(c => batch.set(doc(collection(db, "clientes")), c));
                notasCompra.forEach(n => batch.set(doc(collection(db, "notasCompra")), { ...n, dataEmissao: new Date(n.dataEmissao) }));
                await batch.commit();
                closeModal('alertModal');
                showAlertModal('Sucesso!', 'Backup restaurado com sucesso.');
            });
        } catch (error) {
            showAlertModal('Erro de Restauração', `Arquivo de backup inválido. Erro: ${error.message}`);
        }
    };
    reader.readAsText(file);
}

// --- Event Listeners Globais ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('alertModalCloseButton').addEventListener('click', () => closeModal('alertModal'));
    document.getElementById('confirmModalCancelButton').addEventListener('click', () => closeModal('confirmModal'));
    document.getElementById('confirmModalConfirmButton').addEventListener('click', handleConfirm);
});

appView.addEventListener('click', async (e) => {
    const { target } = e;

    if (target.closest('.nav-link')) { e.preventDefault(); showView(target.closest('.nav-link').dataset.view); }
    else if (target.closest('.sort-btn')) { 
        const key = target.closest('.sort-btn').dataset.key;
        sortState.direction = (sortState.key === key && sortState.direction === 'asc') ? 'desc' : 'asc';
        sortState.key = key;
        applyFilters();
    }
    else if (target.closest('#reset-sort')) { 
        sortState = { key: 'dataEmissao', direction: 'desc' }; 
        applyFilters(); 
    }
    else if (target.closest('.view-details')) { showView('lancamentoDetailView', target.closest('.view-details').dataset.id); }
    else if (target.closest('.back-to-list')) { showView('lancamentosListView'); }
    else if (target.closest('.edit-cliente-btn')) { showView('clienteDetailView', target.closest('.edit-cliente-btn').dataset.id); }
    else if (target.closest('.back-to-list-clientes')) { showView('clientesView'); }
    else if (target.id === 'dashboardFilterBtn') {
        const startDateValue = document.getElementById('dashboardStartDate').value;
        const endDateValue = document.getElementById('dashboardEndDate').value;
        dashboardStartDate = new Date(startDateValue + 'T00:00:00');
        dashboardEndDate = new Date(endDateValue + 'T00:00:00');
        showView('dashboardView');
    }
    else if (target.closest('.delete-cliente-btn')) {
        const id = target.closest('.delete-cliente-btn').dataset.id;
        showConfirmModal('Excluir Cliente?', 'Esta ação não pode ser desfeita.', async () => {
            await deleteDoc(doc(db, 'clientes', id));
            showAlertModal('Sucesso', 'Cliente excluído.');
        });
    }
    else if (target.closest('.delete-notacompra-btn')) {
        const id = target.closest('.delete-notacompra-btn').dataset.id;
        showConfirmModal('Excluir Nota de Compra?', 'Esta ação é permanente.', async () => {
            await deleteDoc(doc(db, 'notasCompra', id));
            showAlertModal('Sucesso', 'A nota fiscal de compra foi excluída.');
        });
    }
    else if (target.id === 'addItemBtn') {
        const container = document.getElementById('itens-container');
        if (!container) return;
        const newItemHTML = `
            <div class="item-row grid grid-cols-12 gap-2 items-center">
                <div class="col-span-8">
                    <input type="text" placeholder="Descrição do item" class="item-descricao mt-1 block w-full rounded-md border-slate-300 shadow-sm" required>
                </div>
                <div class="col-span-3">
                    <input type="number" step="0.01" placeholder="Valor" class="item-valor mt-1 block w-full rounded-md border-slate-300 shadow-sm" required>
                </div>
                <div class="col-span-1 text-right">
                    <button type="button" class="remove-item-btn text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', newItemHTML);
        lucide.createIcons();
    } 
    else if (target.closest('.remove-item-btn')) {
        target.closest('.item-row').remove();
    }
    else if (target.closest('.link-to-os')) {
        const lancamentoId = target.closest('.link-to-os').dataset.lancamentoId;
        if (lancamentoId) {
            showView('lancamentoDetailView', lancamentoId);
        }
    }
    else if (target.id === 'toggleFormBtn') {
        const formContainer = document.getElementById('formContainer');
        if (formContainer.style.maxHeight) {
            formContainer.style.maxHeight = null;
            setTimeout(() => { if (formContainer) formContainer.innerHTML = ''; }, 500);
        } else {
            formContainer.innerHTML = createNovoLancamentoFormHTML();
            const clientList = document.getElementById('client-list');
            if (clientList) clientList.innerHTML = allClientesData.map(c => `<option value="${c.nome}"></option>`).join('');
            document.getElementById('newDataEmissao').valueAsDate = new Date();
            formContainer.style.maxHeight = formContainer.scrollHeight + "px";
        }
    }
    else if (target.id === 'cancelNewLancamento') {
        const formContainer = document.getElementById('formContainer');
        if(formContainer) {
            formContainer.style.maxHeight = null;
            setTimeout(() => formContainer.innerHTML = '', 500);
        }
    }
    else if (target.id === 'analiseIaBtn') {
        document.getElementById('nfUploadInput').click();
    }
    else if (target.closest('.faturado-toggle')) {
        const button = target.closest('.faturado-toggle');
        const lancamento = allLancamentosData.find(l => l.firestoreId === button.dataset.id);
        if (lancamento) await updateDoc(doc(db, 'lancamentos', button.dataset.id), { faturado: lancamento.faturado ? null : new Date() });
    } 
    else if (target.id === 'deleteLancamentoBtn') {
        const form = target.closest('form');
        if (form) showConfirmModal('Excluir Lançamento?', 'Esta ação é permanente.', async () => {
            await deleteDoc(doc(db, "lancamentos", form.dataset.id));
            showAlertModal('Excluído!', 'O lançamento foi removido.');
            showView('lancamentosListView');
        });
    }
    else if (target.id === 'exportPdfBtn') { generatePrintReport(); }
    else if (target.id === 'exportCsvBtn') { generateCsvReport(); }
    else if (target.id === 'backupBtn') { generateBackupFile(); }
    else if (target.id === 'restoreBtn') { document.getElementById('restoreInput').click(); }
});

appView.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
        if (form.id === 'addClienteForm') {
            await addDoc(collection(db, "clientes"), {
                nome: form.querySelector('#newClienteNome').value,
                cnpj: form.querySelector('#newClienteCnpj').value,
                endereco: form.querySelector('#newClienteEndereco').value,
                telefone: form.querySelector('#newClienteTelefone').value,
                email: form.querySelector('#newClienteEmail').value,
            });
            showAlertModal('Sucesso', 'Novo cliente cadastrado!');
            form.reset();
        }
        else if (form.id === 'editClienteForm') {
            const clienteId = form.dataset.id;
            await updateDoc(doc(db, "clientes", clienteId), {
                nome: form.querySelector('#editClienteNome').value,
                cnpj: form.querySelector('#editClienteCnpj').value,
                endereco: form.querySelector('#editClienteEndereco').value,
                telefone: form.querySelector('#editClienteTelefone').value,
                email: form.querySelector('#editClienteEmail').value,
            });
            showAlertModal('Sucesso', 'Dados do cliente atualizados!');
            showView('clientesView');
        }
        else if (form.id === 'novoLancamentoForm' || form.id === 'editLancamentoForm') {
            const isEdit = form.id === 'editLancamentoForm';
            const prefix = isEdit ? 'edit' : 'new';
            
            const impostos = {
                iss: parseFloat(form.querySelector(`#${prefix}ImpostoIss`).value) || 0,
                pis: parseFloat(form.querySelector(`#${prefix}ImpostoPis`).value) || 0,
                cofins: parseFloat(form.querySelector(`#${prefix}ImpostoCofins`).value) || 0,
                icms: parseFloat(form.querySelector(`#${prefix}ImpostoIcms`).value) || 0,
            };
            const valorTotal = parseFloat(form.querySelector(`#${prefix}ValorTotal`).value) || 0;
            const taxaComissao = parseFloat(form.querySelector(`#${prefix}TaxaComissao`).value) || 0;
            const data = {
                dataEmissao: Timestamp.fromDate(new Date(form.querySelector(`#${prefix}DataEmissao`).value + 'T12:00:00Z')),
                cliente: form.querySelector(`#${prefix}Cliente`).value,
                numeroNf: form.querySelector(`#${prefix}NumeroNf`).value || 'NT',
                os: form.querySelector(`#${prefix}Os`).value,
                descricao: form.querySelector(`#${prefix}Descricao`).value,
                valorTotal: valorTotal,
                taxaComissao: taxaComissao,
                comissao: valorTotal * (taxaComissao / 100),
                obs: form.querySelector(`#${prefix}Obs`).value,
                impostos: impostos,
                ...(isEdit ? {} : { faturado: null })
            };
            
            if(isEdit) {
                await updateDoc(doc(db, "lancamentos", form.dataset.id), data);
                showAlertModal('Sucesso', 'Alterações salvas.');
                showView('lancamentoDetailView', form.dataset.id);
            } else {
                await addDoc(collection(db, "lancamentos"), data);
                const formContainer = document.getElementById('formContainer');
                if (formContainer) {
                    formContainer.style.maxHeight = null;
                    setTimeout(() => formContainer.innerHTML = '', 500);
                }
            }
        }
        else if (form.id === 'addNotaCompraForm') {
            const itens = [];
            let valorTotal = 0;
            form.querySelectorAll('.item-row').forEach(row => {
                const descricao = row.querySelector('.item-descricao').value;
                const valor = parseFloat(row.querySelector('.item-valor').value);
                if (descricao && !isNaN(valor)) {
                    itens.push({ descricao, valor });
                    valorTotal += valor;
                }
            });

            if (itens.length === 0) {
                showAlertModal('Erro', 'Você precisa adicionar pelo menos um item válido.');
                return;
            }

            const impostosCompra = {
                icms: parseFloat(form.querySelector('#newCompraImpostoIcms').value) || 0,
                ipi: parseFloat(form.querySelector('#newCompraImpostoIpi').value) || 0,
                pis: parseFloat(form.querySelector('#newCompraImpostoPis').value) || 0,
                cofins: parseFloat(form.querySelector('#newCompraImpostoCofins').value) || 0,
            };

            const data = new Date(form.querySelector('#newNotaData').value + 'T12:00:00Z');
            await addDoc(collection(db, "notasCompra"), {
                osId: form.querySelector('#newNotaOsId').value,
                numeroNf: form.querySelector('#newNotaNumeroNf').value,
                dataEmissao: Timestamp.fromDate(data),
                chaveAcesso: form.querySelector('#newNotaChaveAcesso').value,
                valorTotal: valorTotal,
                itens: itens,
                impostos: impostosCompra
            });
            form.reset();
            const itensContainer = document.getElementById('itens-container');
            if(itensContainer) itensContainer.innerHTML = '';
            document.getElementById('addItemBtn')?.click();
            showAlertModal('Sucesso!', 'Nota Fiscal de compra salva.');
        }
    } catch (error) {
        showAlertModal("Erro ao Salvar", error.message);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
});

appView.addEventListener('change', async (e) => {
    if (e.target.id === 'nfUploadInput') {
        const files = e.target.files;
        if (!files.length) return;
        showAlertModal('Processando...', `Analisando ${files.length} arquivo(s). Aguarde...`);
        let successCount = 0, errorCount = 0;
        for (const file of files) {
            try {
                const imageData = await extractPdfImage(file);
                const data = await callGeminiForAnalysis(imageData);
                let os_pc = data.os || '';
                if (data.pc) { os_pc = os_pc ? `${os_pc} / ${data.pc}` : data.pc; }
                const valorTotal = data.valorTotal || 0;
                await addDoc(collection(db, "lancamentos"), {
                    dataEmissao: Timestamp.fromDate(new Date(data.dataEmissao + 'T12:00:00Z')),
                    cliente: data.cliente,
                    numeroNf: data.numeroNf || 'NT',
                    os: os_pc,
                    descricao: data.observacoes,
                    valorTotal, taxaComissao: 0.5, comissao: valorTotal * (0.5 / 100),
                    faturado: null, obs: `Analisado por IA a partir de ${file.name}`
                });
                successCount++;
            } catch (error) {
                console.error(`Erro ao processar ${file.name}:`, error);
                errorCount++;
            }
        }
        closeModal('alertModal');
        showAlertModal('Concluído', `${successCount} arquivo(s) processado(s) com sucesso.${errorCount > 0 ? ` ${errorCount} falharam.` : ''}`);
        e.target.value = '';
    }
    if (e.target.id === 'restoreInput') {
        handleRestoreFile(e.target.files[0]);
        e.target.value = '';
    }
});
