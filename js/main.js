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
    createClientesViewHTML, createClientesTableRowsHTML,
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
        loaderContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        if (lancamentosUnsubscribe) { lancamentosUnsubscribe(); lancamentosUnsubscribe = null; }
        if (variaveisUnsubscribe) { variaveisUnsubscribe(); variaveisUnsubscribe = null; }
        if (clientesUnsubscribe) { clientesUnsubscribe(); clientesUnsubscribe = null; }
        if (notasCompraUnsubscribe) { notasCompraUnsubscribe(); notasCompraUnsubscribe = null; }
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
        if (currentViewEl) showView(currentViewEl.id);
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar os lançamentos."));
}

function attachVariaveisListener() {
    const q = query(collection(db, 'variaveis'));
    variaveisUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allVariaveisData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl) showView(currentViewEl.id);
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar as variáveis."));
}

function attachClientesListener() {
    const q = query(collection(db, 'clientes'));
    clientesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allClientesData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl && (currentViewEl.id === 'clientesView' || currentViewEl.id === 'lancamentosListView')) {
            showView(currentViewEl.id);
        }
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar os clientes."));
}

function attachNotasCompraListener() {
    const q = query(collection(db, 'notasCompra'));
    notasCompraUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allNotasCompraData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl && currentViewEl.id === 'notasFiscaisView') {
            showView(currentViewEl.id);
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
        const dashboardLancamentos = allLancamentosData.filter(l => {
            const dataLancamento = l.dataEmissao?.toDate();
            return dataLancamento && dataLancamento >= dashboardStartDate && dataLancamento <= endDateFinal;
        });
        const dashboardVariaveis = allVariaveisData.filter(v => {
            const dataVariavel = v.data?.toDate();
            return dataVariavel && dataVariavel >= dashboardStartDate && dataVariavel <= endDateFinal;
        });
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
    } else {
        renderView(viewId, allLancamentosData);
    }

    if (viewId === 'lancamentosListView') populateFiltersAndApply();

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

    const years = [...new Set(allLancamentosData.map(l => l.dataEmissao?.toDate().getFullYear()).filter(Boolean))];
    years.sort((a, b) => b - a);
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

// --- Lógica de Relatórios e Backup (Sem alterações) ---
// function generatePrintReport() { ... }
// function generateCsvReport() { ... }
// function generateBackupFile() { ... }
// function handleRestoreFile() { ... }


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
    else if (target.closest('#reset-sort')) { sortState = { key: 'dataEmissao', direction: 'desc' }; applyFilters(); }
    else if (target.closest('.view-details')) { showView('lancamentoDetailView', target.closest('.view-details').dataset.id); }
    else if (target.closest('.back-to-list')) { showView('lancamentosListView'); }
    else if (target.id === 'toggleFormBtn') { /* ... */ }
    else if (target.id === 'cancelNewLancamento') { /* ... */ }
    else if (target.id === 'analiseIaBtn') { /* ... */ }
    else if (target.closest('.faturado-toggle')) { /* ... */ }
    else if (target.id === 'deleteLancamentoBtn') { /* ... */ }
    else if (target.id === 'exportPdfBtn') { /* ... */ }
    else if (target.id === 'exportCsvBtn') { /* ... */ }
    else if (target.id === 'dashboardFilterBtn') { /* ... */ }
    else if (target.id === 'backupBtn') { /* ... */ }
    else if (target.id === 'restoreBtn') { /* ... */ }
    else if (target.closest('.delete-variavel-btn')) { /* ... */ }
    else if (target.closest('.delete-cliente-btn')) { /* ... */ }
    
    // CORREÇÃO AQUI: O .link-to-os agora é um bloco 'else if' independente
    else if (target.closest('.link-to-os')) {
        const lancamentoId = target.closest('.link-to-os').dataset.lancamentoId;
        if (lancamentoId) {
            showView('lancamentoDetailView', lancamentoId);
        }
    }
    
    else if (target.id === 'addItemBtn') {
        const container = document.getElementById('itens-container');
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
});

appView.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
        if (form.id === 'addVariavelForm') { /* ... */ }
        else if (form.id === 'addClienteForm') { /* ... */ }
        else if (form.id === 'novoLancamentoForm' || form.id === 'editLancamentoForm') { /* ... */ }

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
                // Retornamos aqui, mas a reabilitação do botão é feita no 'finally'
                return;
            }

            const data = new Date(form.querySelector('#newNotaData').value + 'T12:00:00Z');
            await addDoc(collection(db, "notasCompra"), {
                osId: form.querySelector('#newNotaOsId').value,
                numeroNf: form.querySelector('#newNotaNumeroNf').value,
                dataEmissao: Timestamp.fromDate(data),
                chaveAcesso: form.querySelector('#newNotaChaveAcesso').value,
                valorTotal: valorTotal,
                itens: itens
            });
            form.reset();
            document.getElementById('itens-container').innerHTML = '';
            document.getElementById('addItemBtn').click();
            showAlertModal('Sucesso!', 'Nota Fiscal de compra salva.');
        }
    } catch (error) {
        showAlertModal("Erro ao Salvar", error.message);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
});

appView.addEventListener('change', async (e) => {
    if (e.target.id === 'nfUploadInput') { /* ... */ }
    if (e.target.id === 'restoreInput') { /* ... */ }
});
