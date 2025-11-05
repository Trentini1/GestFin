// js/main.js (COMPLETO, SEM CORTES, PRONTO PARA COPIAR E COLAR)

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, addDoc, getDoc, deleteDoc, onSnapshot, query, updateDoc, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from './firebase-config.js';
import { extractPdfImage, callGeminiForAnalysis } from './api.js';
import { getGiroTotal, animateCountUp, formatCurrency, exportToCSV } from './utils.js';
import {
    createDashboardHTML, createLancamentosListHTML, createNovoLancamentoFormHTML,
    createLancamentosTableRowsHTML, createLancamentoDetailHTML, showAlertModal,
    showConfirmModal, closeModal, handleConfirm, renderPaginationControls, renderDashboardChart,
    renderNfPieChart, createVariaveisViewHTML, createVariaveisTableRowsHTML,
    createClientesViewHTML, createClientesTableRowsHTML, createClienteDetailHTML,
    createNotasFiscaisViewHTML, createNotasCompraTableRowsHTML, createPagamentoRowHTML,
    createNotaCompraDetailHTML
} from './ui.js';

const DEFAULT_COMISSION_RATE = 0.5;

// --- Estado da Aplicação ---
let currentUserProfile = null;
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
let selectedMonthFilter = null;
let selectedYearFilter = null;
let searchTerm = '';
let sortState = { key: 'dataEmissao', direction: 'desc' };

// Filtros da tela de Notas Fiscais
let nfSelectedMonthFilter = null;
let nfSelectedYearFilter = null;
let nfSearchTerm = '';

// Filtros da tela de Variáveis
let variaveisSelectedMonthFilter = null;
let variaveisSelectedYearFilter = null;

// Datas do Dashboard
const hoje = new Date();
const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
let dashboardStartDate = primeiroDiaDoMes;
let dashboardEndDate = hoje;

// --- Seletores do DOM ---
const loadingView = document.getElementById('loadingView');
const loginForm = document.getElementById('loginForm');
const logoutButton = document.getElementById('logoutButton');
const appView = document.getElementById('appView');
const allViews = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-link');
const userNameEl = document.getElementById('userName');

// --- Lógica de Autenticação ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            currentUserProfile = userDocSnap.data();
            userNameEl.textContent = currentUserProfile.nome;
            loadingView.style.display = 'none';
            appView.style.display = 'block';
            if (!lancamentosUnsubscribe) attachLancamentosListener();
            if (currentUserProfile.funcao !== 'padrao' && !variaveisUnsubscribe) attachVariaveisListener();
            if (!clientesUnsubscribe) attachClientesListener();
            if (!notasCompraUnsubscribe) attachNotasCompraListener();
            const variaveisNavLink = document.querySelector('[data-view="variaveisView"]');
            if (variaveisNavLink) {
                variaveisNavLink.style.display = (currentUserProfile.funcao === 'padrao') ? 'none' : 'flex';
            }
            showView('dashboardView');
        } else {
            showAlertModal('Erro de Perfil', 'Seu perfil de usuário não foi encontrado no banco de dados. Contate o administrador.');
            signOut(auth);
        }
    } else {
        currentUserProfile = null;
        appView.style.display = 'none';
        loadingView.style.display = 'flex';
        if (lancamentosUnsubscribe) { lancamentosUnsubscribe(); lancamentosUnsubscribe = null; }
        if (variaveisUnsubscribe) { variaveisUnsubscribe(); variaveisUnsubscribe = null; }
        if (clientesUnsubscribe) { clientesUnsubscribe(); clientesUnsubscribe = null; }
        if (notasCompraUnsubscribe) { notasCompraUnsubscribe(); notasCompraUnsubscribe = null; }
    }
});

logoutButton.addEventListener('click', () => signOut(auth));

// --- Lógica de Dados (Firestore) ---
function attachLancamentosListener() {
    const q = query(collection(db, 'lancamentos'));
    lancamentosUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allLancamentosData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl?.id === 'lancamentosListView') applyFilters();
        if (currentViewEl?.id === 'dashboardView') showView('dashboardView');
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar os lançamentos."));
}

function attachVariaveisListener() {
    const q = query(collection(db, 'variaveis'));
    variaveisUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allVariaveisData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl?.id === 'variaveisView') applyVariaveisFilters();
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar as variáveis."));
}

function attachClientesListener() {
    const q = query(collection(db, 'clientes'));
    clientesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allClientesData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl?.id === 'clientesView') {
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
        if (currentViewEl?.id === 'notasFiscaisView') applyNfFilters();
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar as notas de compra."));
}

// --- Funções de Filtro e Paginação ---
function getFilteredLancamentos() {
    let filtered = [...allLancamentosData];
    if (selectedMonthFilter !== null) {
        filtered = filtered.filter(l => l.dataEmissao.toDate().getMonth() + 1 === selectedMonthFilter);
    }
    if (selectedYearFilter !== null) {
        filtered = filtered.filter(l => l.dataEmissao.toDate().getFullYear() === selectedYearFilter);
    }
    if (searchTerm) {
        filtered = filtered.filter(l =>
            (l.cliente?.toLowerCase().includes(searchTerm)) ||
            (l.numeroNf?.toLowerCase().includes(searchTerm)) ||
            (l.os?.toLowerCase().includes(searchTerm))
        );
    }
    filtered.sort((a, b) => {
        const dir = sortState.direction === 'asc' ? 1 : -1;
        if (sortState.key === 'dataEmissao') {
            return dir * (a.dataEmissao.toDate() - b.dataEmissao.toDate());
        } else if (['valorTotal', 'comissao'].includes(sortState.key)) {
            return dir * ((a[sortState.key] || 0) - (b[sortState.key] || 0));
        } else {
            return dir * ((a[sortState.key] || '').localeCompare(b[sortState.key] || ''));
        }
    });
    return filtered;
}

function applyFilters() {
    const filtered = getFilteredLancamentos();
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);
    const tableBody = document.getElementById('lancamentosTableBody');
    if (tableBody) tableBody.innerHTML = createLancamentosTableRowsHTML(paginated);
    renderPaginationControls(currentPage, totalItems, totalPages, (direction) => {
        currentPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
        applyFilters();
    });
}

function applyNfFilters() {
    let filtered = [...allNotasCompraData];
    if (nfSelectedMonthFilter !== null) {
        filtered = filtered.filter(n => n.dataEmissao.toDate().getMonth() + 1 === nfSelectedMonthFilter);
    }
    if (nfSelectedYearFilter !== null) {
        filtered = filtered.filter(n => n.dataEmissao.toDate().getFullYear() === nfSelectedYearFilter);
    }
    if (nfSearchTerm) {
        filtered = filtered.filter(n =>
            (n.numeroNf?.toLowerCase().includes(nfSearchTerm)) ||
            (n.osId?.toLowerCase().includes(nfSearchTerm)) ||
            (n.comprador?.toLowerCase().includes(nfSearchTerm))
        );
    }
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);
    const tableBody = document.getElementById('notasCompraTableBody');
    if (tableBody) tableBody.innerHTML = createNotasCompraTableRowsHTML(paginated);
    const pagination = document.getElementById('nfPagination');
    if (pagination) renderPaginationControls(currentPage, totalItems, totalPages, (direction) => {
        currentPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
        applyNfFilters();
    });
}

function applyVariaveisFilters() {
    let filtered = [...allVariaveisData];
    if (variaveisSelectedMonthFilter !== null) {
        filtered = filtered.filter(v => v.data.toDate().getMonth() + 1 === variaveisSelectedMonthFilter);
    }
    if (variaveisSelectedYearFilter !== null) {
        filtered = filtered.filter(v => v.data.toDate().getFullYear() === variaveisSelectedYearFilter);
    }
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);
    const tableBody = document.getElementById('variaveisTableBody');
    if (tableBody) tableBody.innerHTML = createVariaveisTableRowsHTML(paginated);
    const pagination = document.getElementById('variaveisPagination');
    if (pagination) renderPaginationControls(currentPage, totalItems, totalPages, (direction) => {
        currentPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
        applyVariaveisFilters();
    });
}

function populateMonthYearFilters(monthId, yearId, data, dateField = 'dataEmissao') {
    const months = [...new Set(data.map(d => d[dateField]?.toDate().getMonth() + 1).filter(Boolean))].sort((a, b) => a - b);
    const years = [...new Set(data.map(d => d[dateField]?.toDate().getFullYear()).filter(Boolean))].sort((a, b) => b - a);
    const monthSelect = document.getElementById(monthId);
    const yearSelect = document.getElementById(yearId);
    if (monthSelect) monthSelect.innerHTML = '<option value="">Todos</option>' + months.map(m => `<option value="${m}">${m.toString().padStart(2, '0')}</option>`).join('');
    if (yearSelect) yearSelect.innerHTML = '<option value="">Todos</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}

// --- Funções de Pagamentos ---
function initializePagamentos(listId, addBtnId, hiddenInputId) {
    const list = document.getElementById(listId);
    const addBtn = document.getElementById(addBtnId);
    const hiddenInput = document.getElementById(hiddenInputId);
    let pagamentos = [];

    function updateHidden() {
        hiddenInput.value = JSON.stringify(pagamentos);
    }

    function addRow(data = { metodo: 'PIX', valor: '', parcelas: 1 }) {
        const index = pagamentos.length;
        const rowHTML = createPagamentoRowHTML(data, index);
        const row = document.createElement('div');
        row.innerHTML = rowHTML;
        list.appendChild(row.firstChild);

        const metodoSelect = row.querySelector('.pagamento-metodo');
        const valorInput = row.querySelector('.pagamento-valor');
        const parcelasInput = row.querySelector('.pagamento-parcelas');
        const removeBtn = row.querySelector('.remove-pagamento-btn');

        metodoSelect.addEventListener('change', () => {
            if (metodoSelect.value === 'Cartão de Crédito' || metodoSelect.value === 'Boleto') {
                parcelasInput.classList.remove('hidden');
            } else {
                parcelasInput.classList.add('hidden');
                parcelasInput.value = '';
            }
            pagamentos[index].metodo = metodoSelect.value;
            updateHidden();
        });

        valorInput.addEventListener('input', () => {
            pagamentos[index].valor = valorInput.value;
            updateHidden();
        });

        parcelasInput.addEventListener('input', () => {
            pagamentos[index].parcelas = parcelasInput.value;
            updateHidden();
        });

        removeBtn.addEventListener('click', () => {
            list.removeChild(row);
            pagamentos.splice(index, 1);
            updateHidden();
            reindexRows();
        });

        pagamentos.push(data);
        updateHidden();
    }

    function reindexRows() {
        const rows = list.querySelectorAll('.pagamento-row');
        rows.forEach((row, i) => row.dataset.index = i);
    }

    addBtn.addEventListener('click', () => addRow());

    // Adiciona primeira linha
    addRow();
}

// --- Navegação e Renderização ---
async function showView(viewId, dataId = null) {
    if (!currentUserProfile) return;
    if (viewId === 'variaveisView' && currentUserProfile.funcao === 'padrao') {
        showAlertModal('Acesso Negado', 'Você não tem permissão para acessar esta área.');
        viewId = 'dashboardView';
    }
    allViews.forEach(v => v.style.display = 'none');
    const targetView = document.getElementById(viewId);
    targetView.style.display = 'block';

    if (viewId === 'dashboardView') {
        const dashboardData = allLancamentosData.filter(l => {
            const emissaoDate = l.dataEmissao?.toDate();
            return emissaoDate >= dashboardStartDate && emissaoDate <= dashboardEndDate;
        });
        const totalVariaveis = allVariaveisData.reduce((sum, v) => sum + (v.valor || 0), 0);
        targetView.innerHTML = createDashboardHTML(dashboardData, totalVariaveis, dashboardStartDate, dashboardEndDate, currentUserProfile);
        lucide.createIcons();
        document.querySelectorAll('.dashboard-value').forEach(el => animateCountUp(el, parseFloat(el.dataset.value)));
        renderDashboardChart(allLancamentosData);
        renderNfPieChart(dashboardData);
        document.getElementById('dashboardFilterBtn').addEventListener('click', () => {
            dashboardStartDate = new Date(document.getElementById('dashboardStartDate').value);
            dashboardEndDate = new Date(document.getElementById('dashboardEndDate').value);
            showView('dashboardView');
        });
        document.getElementById('exportDashboardBtn').addEventListener('click', () => {
            const headers = ['Data Emissão', 'Cliente', 'Valor Total', 'Comissão', 'Faturado'];
            const data = dashboardData.map(l => ({
                'Data Emissão': l.dataEmissao.toDate().toLocaleDateString('pt-BR'),
                Cliente: l.cliente,
                'Valor Total': l.valorTotal,
                Comissão: l.comissao,
                Faturado: l.faturado ? 'Sim' : 'Não'
            }));
            exportToCSV(Object.keys(data[0] || {}).map(k => [k, ...data.map(d => d[k])]), 'dashboard.csv', Object.keys(data[0] || {}));
        });
    } else if (viewId === 'lancamentosListView') {
        currentPage = 1;
        targetView.innerHTML = createLancamentosListHTML(currentUserProfile);
        lucide.createIcons();
        populateMonthYearFilters('monthFilter', 'yearFilter', allLancamentosData);
        applyFilters();
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', () => {
            searchTerm = searchInput.value.toLowerCase();
            currentPage = 1;
            applyFilters();
        });
        document.getElementById('monthFilter').addEventListener('change', (e) => {
            selectedMonthFilter = parseInt(e.target.value) || null;
            currentPage = 1;
            applyFilters();
        });
        document.getElementById('yearFilter').addEventListener('change', (e) => {
            selectedYearFilter = parseInt(e.target.value) || null;
            currentPage = 1;
            applyFilters();
        });
        document.getElementById('exportLancamentosBtn').addEventListener('click', () => {
            const headers = ['Data Emissão', 'Cliente', 'Número NF', 'OS', 'Valor Total', 'Comissão'];
            const data = getFilteredLancamentos().map(l => ({
                'Data Emissão': l.dataEmissao.toDate().toLocaleDateString('pt-BR'),
                Cliente: l.cliente,
                'Número NF': l.numeroNf,
                OS: l.os,
                'Valor Total': l.valorTotal,
                Comissão: l.comissao
            }));
            exportToCSV(Object.keys(data[0] || {}).map(k => [k, ...data.map(d => d[k])]), 'lancamentos.csv', Object.keys(data[0] || {}));
        });
        targetView.addEventListener('click', handleLancamentosClick);
    } else if (viewId === 'lancamentoDetailView') {
        const lancamento = allLancamentosData.find(l => l.firestoreId === dataId);
        if (lancamento) {
            targetView.innerHTML = createLancamentoDetailHTML(lancamento, currentUserProfile);
            lucide.createIcons();
            document.getElementById('backToListBtn')?.addEventListener('click', () => showView('lancamentosListView'));
            document.getElementById('editLancamentoBtn')?.addEventListener('click', () => editLancamento(dataId));
            document.getElementById('deleteLancamentoBtn')?.addEventListener('click', () => deleteLancamento(dataId));
            document.getElementById('editPagamentosBtn')?.addEventListener('click', () => editPagamentos(dataId));
        }
    } else if (viewId === 'notasFiscaisView') {
        currentPage = 1;
        targetView.innerHTML = createNotasFiscaisViewHTML();
        lucide.createIcons();
        populateMonthYearFilters('nfMonthFilter', 'nfYearFilter', allNotasCompraData, 'dataEmissao');
        applyNfFilters();
        const nfSearchInput = document.getElementById('nfSearchInput');
        nfSearchInput.addEventListener('input', () => {
            nfSearchTerm = nfSearchInput.value.toLowerCase();
            currentPage = 1;
            applyNfFilters();
        });
        document.getElementById('nfMonthFilter').addEventListener('change', (e) => {
            nfSelectedMonthFilter = parseInt(e.target.value) || null;
            currentPage = 1;
            applyNfFilters();
        });
        document.getElementById('nfYearFilter').addEventListener('change', (e) => {
            nfSelectedYearFilter = parseInt(e.target.value) || null;
            currentPage = 1;
            applyNfFilters();
        });
        document.getElementById('addNotaCompraBtn').addEventListener('click', addNotaCompra);
        targetView.addEventListener('click', handleNotasCompraClick);
    } else if (viewId === 'notaCompraDetailView') {
        const nota = allNotasCompraData.find(n => n.firestoreId === dataId);
        if (nota) {
            targetView.innerHTML = createNotaCompraDetailHTML(nota);
            lucide.createIcons();
            document.getElementById('backToNotasBtn')?.addEventListener('click', () => showView('notasFiscaisView'));
            document.getElementById('editNotaCompraBtn')?.addEventListener('click', () => editNotaCompra(dataId));
            document.getElementById('deleteNotaCompraBtn')?.addEventListener('click', () => deleteNotaCompra(dataId));
            document.getElementById('editPagamentosCompraBtn')?.addEventListener('click', () => editPagamentosCompra(dataId));
        }
    } else if (viewId === 'variaveisView') {
        currentPage = 1;
        targetView.innerHTML = createVariaveisViewHTML();
        lucide.createIcons();
        populateMonthYearFilters('variaveisMonthFilter', 'variaveisYearFilter', allVariaveisData, 'data');
        applyVariaveisFilters();
        document.getElementById('variaveisMonthFilter').addEventListener('change', (e) => {
            variaveisSelectedMonthFilter = parseInt(e.target.value) || null;
            currentPage = 1;
            applyVariaveisFilters();
        });
        document.getElementById('variaveisYearFilter').addEventListener('change', (e) => {
            variaveisSelectedYearFilter = parseInt(e.target.value) || null;
            currentPage = 1;
            applyVariaveisFilters();
        });
        targetView.addEventListener('click', handleVariaveisClick);
    } else if (viewId === 'clientesView') {
        targetView.innerHTML = createClientesViewHTML();
        lucide.createIcons();
        const tableBody = document.getElementById('clientesTableBody');
        if (tableBody) tableBody.innerHTML = createClientesTableRowsHTML(allClientesData);
        targetView.addEventListener('click', handleClientesClick);
    } else if (viewId === 'clienteDetailView') {
        const cliente = allClientesData.find(c => c.firestoreId === dataId);
        if (cliente) {
            targetView.innerHTML = createClienteDetailHTML(cliente);
            lucide.createIcons();
            document.getElementById('backToClientesBtn')?.addEventListener('click', () => showView('clientesView'));
            document.getElementById('editClienteBtn')?.addEventListener('click', () => editCliente(dataId));
            document.getElementById('deleteClienteBtn')?.addEventListener('click', () => deleteCliente(dataId));
        }
    }
}

// --- Handlers de Cliques ---
function handleLancamentosClick(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest('.view-btn')) {
        showView('lancamentoDetailView', id);
    } else if (e.target.closest('.edit-btn')) {
        editLancamento(id);
    } else if (e.target.closest('.delete-btn')) {
        deleteLancamento(id);
    } else if (e.target.closest('.sort-btn')) {
        const key = e.target.dataset.key;
        sortState.direction = sortState.key === key && sortState.direction === 'asc' ? 'desc' : 'asc';
        sortState.key = key;
        currentPage = 1;
        applyFilters();
    } else if (e.target.id === 'toggleFormBtn') {
        const formContainer = document.getElementById('formContainer');
        if (formContainer.style.maxHeight && formContainer.style.maxHeight !== '0px') {
            formContainer.style.maxHeight = '0px';
            setTimeout(() => formContainer.innerHTML = '', 500);
        } else {
            formContainer.innerHTML = createNovoLancamentoFormHTML();
            lucide.createIcons();
            formContainer.style.maxHeight = formContainer.scrollHeight + 'px';
            initializePagamentos('pagamentos-list', 'addPagamentoBtn', 'hidden-pagamentos-data');
            document.getElementById('cancelFormBtn').addEventListener('click', () => {
                formContainer.style.maxHeight = '0px';
                setTimeout(() => formContainer.innerHTML = '', 500);
            });
        }
    } else if (e.target.id === 'analiseIaBtn') {
        document.getElementById('nfUploadInput').click();
    }
}

function handleNotasCompraClick(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest('.view-nota-btn')) {
        showView('notaCompraDetailView', id);
    } else if (e.target.closest('.edit-nota-btn')) {
        editNotaCompra(id);
    } else if (e.target.closest('.delete-nota-btn')) {
        deleteNotaCompra(id);
    }
}

function handleVariaveisClick(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest('.edit-variavel-btn')) {
        editVariavel(id);
    } else if (e.target.closest('.delete-variavel-btn')) {
        deleteVariavel(id);
    }
}

function handleClientesClick(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest('.view-cliente-btn')) {
        showView('clienteDetailView', id);
    } else if (e.target.closest('.edit-cliente-btn')) {
        editCliente(id);
    } else if (e.target.closest('.delete-cliente-btn')) {
        deleteCliente(id);
    }
}

// --- Ações de CRUD ---
function editLancamento(id) {
    const l = allLancamentosData.find(x => x.firestoreId === id);
    if (!l) return;
    const formHTML = `
        <form id="editLancamentoForm" data-id="${id}" class="bg-white shadow-md rounded-lg p-6 space-y-6">
            <!-- Campos iguais ao createNovoLancamentoFormHTML, mas com valores preenchidos -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label class="block text-sm font-medium text-slate-700">Data de Emissão</label><input type="date" id="editDataEmissao" value="${l.dataEmissao.toDate().toISOString().split('T')[0]}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required></div>
                <div><label class="block text-sm font-medium text-slate-700">Cliente</label><input type="text" id="editCliente" value="${l.cliente}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required></div>
                <div><label class="block text-sm font-medium text-slate-700">Número NF</label><input type="text" id="editNumeroNf" value="${l.numeroNf}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                <div><label class="block text-sm font-medium text-slate-700">OS</label><input type="text" id="editOs" value="${l.os}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700">Descrição</label><textarea id="editDescricao" rows="3" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">${l.descricao}</textarea></div>
                <div><label class="block text-sm font-medium text-slate-700">Valor Total</label><input type="number" step="0.01" id="editValorTotal" value="${l.valorTotal}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required></div>
                <div><label class="block text-sm font-medium text-slate-700">Taxa de Comissão (%)</label><input type="number" step="0.01" id="editTaxaComissao" value="${l.taxaComissao}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700 mb-2">Impostos (%)</label><div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><label class="block text-xs text-slate-600">ISS</label><input type="number" step="0.01" id="editImpostoIss" value="${l.impostos?.iss || 0}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-xs text-slate-600">PIS</label><input type="number" step="0.01" id="editImpostoPis" value="${l.impostos?.pis || 0}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-xs text-slate-600">COFINS</label><input type="number" step="0.01" id="editImpostoCofins" value="${l.impostos?.cofins || 0}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-xs text-slate-600">ICMS</label><input type="number" step="0.01" id="editImpostoIcms" value="${l.impostos?.icms || 0}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                </div></div>
                <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700 mb-2">Pagamentos</label><div id="edit-pagamentos-list" class="space-y-3"></div><button type="button" id="editAddPagamentoBtn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"><i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i> Adicionar Pagamento</button><input type="hidden" id="hidden-pagamentos-data" name="pagamentos"></div>
                <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700">Observações</label><textarea id="editObs" rows="3" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">${l.obs || ''}</textarea></div>
            </div>
            <div class="flex justify-end gap-4">
                <button type="button" id="cancelEditBtn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
                <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Salvar</button>
            </div>
        </form>
    `;
    const detailView = document.getElementById('lancamentoDetailView');
    detailView.innerHTML = formHTML;
    lucide.createIcons();
    initializePagamentos('edit-pagamentos-list', 'editAddPagamentoBtn', 'hidden-pagamentos-data');
    const pagamentosList = document.getElementById('edit-pagamentos-list');
    pagamentosList.innerHTML = '';
    (l.pagamentos || []).forEach(p => {
        const index = pagamentosList.children.length;
        const row = document.createElement('div');
        row.innerHTML = createPagamentoRowHTML(p, index);
        pagamentosList.appendChild(row.firstChild);
    });
    document.getElementById('cancelEditBtn').addEventListener('click', () => showView('lancamentoDetailView', id));
}

function deleteLancamento(id) {
    showConfirmModal('Confirmar Exclusão', 'Tem certeza que deseja excluir este lançamento?', async () => {
        await deleteDoc(doc(db, 'lancamentos', id));
        showAlertModal('Sucesso', 'Lançamento excluído com sucesso.');
        showView('lancamentosListView');
    });
}

function editPagamentos(id) {
    const l = allLancamentosData.find(x => x.firestoreId === id);
    if (!l) return;
    const modal = document.getElementById('pagamentosModal');
    modal.querySelector('#pagamentosModalTitle').textContent = 'Editar Pagamentos';
    const list = modal.querySelector('#modal-pagamentos-list');
    list.innerHTML = '';
    (l.pagamentos || []).forEach((p, i) => {
        const row = document.createElement('div');
        row.innerHTML = createPagamentoRowHTML(p, i);
        list.appendChild(row.firstChild);
    });
    modal.style.display = 'flex';
    const saveBtn = modal.querySelector('#pagamentosModalSaveBtn');
    const cancelBtn = modal.querySelector('#pagamentosModalCancelBtn');
    const addBtn = modal.querySelector('#addModalPagamentoBtn');

    const pagamentos = [...(l.pagamentos || [])];
    function updatePagamentos() {
        const rows = list.querySelectorAll('.pagamento-row');
        pagamentos.length = 0;
        rows.forEach(row => {
            const metodo = row.querySelector('.pagamento-metodo').value;
            const valor = parseFloat(row.querySelector('.pagamento-valor').value) || 0;
            const parcelas = parseInt(row.querySelector('.pagamento-parcelas').value) || 1;
            pagamentos.push({ metodo, valor, parcelas });
        });
    }

    addBtn.onclick = () => {
        const index = list.children.length;
        const row = document.createElement('div');
        row.innerHTML = createPagamentoRowHTML({ metodo: 'PIX', valor: '', parcelas: 1 }, index);
        list.appendChild(row.firstChild);
    };

    saveBtn.onclick = async () => {
        updatePagamentos();
        const totalPagamentos = pagamentos.reduce((s, p) => s + p.valor, 0);
        if (Math.abs(totalPagamentos - l.valorTotal) > 0.01) {
            showAlertModal('Erro', 'A soma dos pagamentos deve igualar o valor total.');
            return;
        }
        await updateDoc(doc(db, 'lancamentos', id), { pagamentos });
        closeModal('pagamentosModal');
        showView('lancamentoDetailView', id);
    };

    cancelBtn.onclick = () => closeModal('pagamentosModal');
}

// --- Backup Automático ---
setInterval(() => {
    const backupData = {
        lancamentos: allLancamentosData,
        variaveis: allVariaveisData,
        clientes: allClientesData,
        notasCompra: allNotasCompraData,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('gestao_pro_backup', JSON.stringify(backupData));
    console.log('Backup automático salvo no localStorage.');
}, 5 * 60 * 1000);

// --- Eventos Globais ---
appView.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
        if (form.id === 'newLancamentoForm' || form.id === 'editLancamentoForm') {
            const isEdit = form.id === 'editLancamentoForm';
            const prefix = isEdit ? 'edit' : 'new';
            const pagamentos = JSON.parse(form.querySelector('#hidden-pagamentos-data').value || '[]');
            const impostos = {
                iss: parseFloat(form.querySelector(`#${prefix}ImpostoIss`)?.value) || 0,
                pis: parseFloat(form.querySelector(`#${prefix}ImpostoPis`)?.value) || 0,
                cofins: parseFloat(form.querySelector(`#${prefix}ImpostoCofins`)?.value) || 0,
                icms: parseFloat(form.querySelector(`#${prefix}ImpostoIcms`)?.value) || 0,
            };
            const valorTotal = parseFloat(form.querySelector(`#${prefix}ValorTotal`).value) || 0;
            let taxaComissao;
            if (currentUserProfile.funcao === 'padrao' && !isEdit) {
                taxaComissao = DEFAULT_COMISSION_RATE;
            } else {
                taxaComissao = parseFloat(form.querySelector(`#${prefix}TaxaComissao`)?.value) || 0;
            }

            const totalPagamentos = pagamentos.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
            if (Math.abs(totalPagamentos - valorTotal) > 0.01) {
                showAlertModal('Erro de Pagamentos', 'A soma dos pagamentos deve ser igual ao valor total (tolerância de R$ 0,01).');
                submitButton.disabled = false;
                return;
            }

            const osValue = form.querySelector(`#${prefix}Os`).value;
            if (osValue && !/^\d+$/.test(osValue)) {
                showAlertModal('Aviso OS', 'O campo OS deve ser numérico. Verifique se está correto.');
            }

            const data = {
                dataEmissao: Timestamp.fromDate(new Date(form.querySelector(`#${prefix}DataEmissao`).value + 'T12:00:00Z')),
                cliente: form.querySelector(`#${prefix}Cliente`).value,
                numeroNf: form.querySelector(`#${prefix}NumeroNf`).value || 'NT',
                os: osValue,
                descricao: form.querySelector(`#${prefix}Descricao`).value,
                valorTotal: valorTotal,
                taxaComissao: taxaComissao,
                comissao: valorTotal * (taxaComissao / 100),
                obs: form.querySelector(`#${prefix}Obs`).value,
                impostos: impostos,
                pagamentos: pagamentos,
            };

            if (isEdit) {
                data.editadoPor = currentUserProfile.nome;
                data.editadoEm = Timestamp.now();
                await updateDoc(doc(db, "lancamentos", form.dataset.id), data);
                showAlertModal('Sucesso', 'Alterações salvas.');
                showView('lancamentoDetailView', form.dataset.id);
            } else {
                data.criadoPor = currentUserProfile.nome;
                data.criadoEm = Timestamp.now();
                data.faturado = null;
                await addDoc(collection(db, "lancamentos"), data);
                const formContainer = document.getElementById('formContainer');
                if (formContainer) {
                    formContainer.style.maxHeight = '0px';
                    setTimeout(() => formContainer.innerHTML = '', 500);
                }
            }
        }
    } catch (error) {
        showAlertModal("Erro ao Salvar", error.message);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
});

appView.addEventListener('change', async (e) => {
    if (e.target.classList.contains('pagamento-metodo')) {
        const row = e.target.closest('.pagamento-row');
        const parcelasInput = row.querySelector('.pagamento-parcelas');
        if (e.target.value === 'Cartão de Crédito' || e.target.value === 'Boleto') {
            parcelasInput.classList.remove('hidden');
            parcelasInput.value = parcelasInput.value || 1;
        } else {
            parcelasInput.classList.add('hidden');
            parcelasInput.value = '';
        }
    }
    if (e.target.id === 'nfUploadInput') {
        const files = e.target.files;
        if (!files.length) return;
        showAlertModal('Processando...', `<div class="loader mx-auto"></div> Analisando ${files.length} arquivo(s). Aguarde...`);
        let successCount = 0, errorCount = 0, processed = 0;
        for (const file of files) {
            processed++;
            showAlertModal('Processando...', `<div class="loader mx-auto"></div> Processando ${processed}/${files.length}: ${file.name}`);
            try {
                const imageData = await extractPdfImage(file);
                const data = await callGeminiForAnalysis(imageData);
                let os_pc = data.os || '';
                if (data.pc) os_pc = os_pc ? `${os_pc} / ${data.pc}` : data.pc;
                const valorTotal = data.valorTotal || 0;
                await addDoc(collection(db, "lancamentos"), {
                    dataEmissao: Timestamp.fromDate(new Date(data.dataEmissao + 'T12:00:00Z')),
                    cliente: data.cliente,
                    numeroNf: data.numeroNf || 'NT',
                    os: os_pc,
                    descricao: data.observacoes,
                    valorTotal, taxaComissao: 0.5, comissao: valorTotal * 0.005,
                    faturado: null, obs: `IA: ${file.name}`,
                    criadoPor: currentUserProfile.nome,
                    criadoEm: Timestamp.now()
                });
                successCount++;
            } catch (error) {
                console.error(`Erro em ${file.name}:`, error);
                errorCount++;
            }
        }
        closeModal('alertModal');
        showAlertModal('Concluído', `${successCount} processados. ${errorCount} falharam.`);
        e.target.value = '';
    }
});

// --- Login e Navegação ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showAlertModal('Erro de Login', 'Credenciais inválidas ou erro de rede.');
    }
});

navLinks.forEach(link => link.addEventListener('click', (e) => {
    e.preventDefault();
    showView(link.dataset.view);
}));

document.getElementById('alertModalCloseButton').addEventListener('click', () => closeModal('alertModal'));
document.getElementById('confirmModalCancelButton').addEventListener('click', () => closeModal('confirmModal'));
document.getElementById('confirmModalConfirmButton').addEventListener('click', handleConfirm);

lucide.createIcons();
