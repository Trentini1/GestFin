// Firebase SDK
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, addDoc, getDoc, deleteDoc, onSnapshot, query, updateDoc, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
    createNotasFiscaisViewHTML, createNotasCompraTableRowsHTML, createPagamentoRowHTML
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
let nfSelectedMonthFilter = null;
let nfSelectedYearFilter = null;
let variaveisSelectedMonthFilter = null;
let variaveisSelectedYearFilter = null;
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

// --- Lógica de Navegação e Renderização ---
async function showView(viewId, dataId = null) {
    if (!currentUserProfile) return;
    if (viewId === 'variaveisView' && currentUserProfile.funcao === 'padrao') {
        showAlertModal('Acesso Negado', 'Você não tem permissão para acessar esta área.');
        viewId = 'dashboardView';
    }
    allViews.forEach(v => v.style.display = 'none');
    const viewContainer = document.getElementById(viewId);
    if (viewContainer) {
        viewContainer.style.display = 'block';
        viewContainer.dataset.id = dataId;
    }

    renderView(viewId, { isLoading: true });

    try {
        if (viewId === 'lancamentoDetailView' && dataId) {
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
        } else {
            renderView(viewId);
            if (viewId === 'lancamentosListView') populateFiltersAndApply();
            if (viewId === 'notasFiscaisView') populateNfFiltersAndApply();
            if (viewId === 'variaveisView') populateVariaveisFiltersAndApply();
            if (viewId === 'notasFiscaisView' && currentUserProfile.funcao !== 'leitura') {
                setTimeout(() => document.getElementById('addItemBtn')?.click(), 100);
            }
        }
    } catch (e) {
        showAlertModal("Erro ao carregar a visão", e.message);
        renderView(viewId);
    }

    navLinks.forEach(link => {
        const linkView = link.dataset.view;
        const isActive = linkView === viewId ||
            (linkView === 'lancamentosListView' && viewId === 'lancamentoDetailView') ||
            (linkView === 'clientesView' && viewId === 'clienteDetailView');

        link.classList.toggle('text-indigo-600', isActive);
        link.classList.toggle('border-b-2', isActive);
        link.classList.toggle('border-indigo-600', isActive);
        link.classList.toggle('text-slate-500', !isActive);
    });
}

function renderView(viewId, data = {}) {
    const viewContainer = document.getElementById(viewId);
    if (!viewContainer) return;

    if (data.isLoading) {
        viewContainer.innerHTML = `<div class="flex items-center justify-center h-96"><div class="loader"></div></div>`;
        return;
    }

    let html = '';
    switch (viewId) {
        case 'dashboardView':
            const endDateFinal = new Date(dashboardEndDate);
            endDateFinal.setHours(23, 59, 59, 999);
            const dashboardLancamentos = allLancamentosData.filter(l => l.dataEmissao?.toDate() >= dashboardStartDate && l.dataEmissao?.toDate() <= endDateFinal);
            const dashboardVariaveis = allVariaveisData.filter(v => v.data?.toDate() >= dashboardStartDate && v.data?.toDate() <= endDateFinal);
            const totalVariaveis = dashboardVariaveis.reduce((sum, v) => sum + v.valor, 0);
            html = createDashboardHTML(dashboardLancamentos, totalVariaveis, dashboardStartDate, dashboardEndDate, currentUserProfile);
            break;
        case 'variaveisView':
            html = createVariaveisViewHTML(currentUserProfile);
            break;
        case 'clientesView':
            html = createClientesViewHTML(currentUserProfile);
            break;
        case 'lancamentosListView':
            html = createLancamentosListHTML(currentUserProfile);
            break;
        case 'lancamentoDetailView':
            html = createLancamentoDetailHTML(data, currentUserProfile);
            break;
        case 'notasFiscaisView':
            html = createNotasFiscaisViewHTML(allLancamentosData, currentUserProfile);
            break;
        case 'clienteDetailView':
            html = createClienteDetailHTML(data, currentUserProfile);
            break;
    }
    viewContainer.innerHTML = html;
    lucide.createIcons();

    // Pós-renderização
    if (viewId === 'dashboardView') {
        renderDashboardComponents();
    } else if (viewId === 'lancamentoDetailView' && data.lancamento) {
        updatePagamentosSummary('lancamento');
    } else if (viewId === 'clientesView') {
        const tableBody = document.getElementById('clientesTableBody');
        if (tableBody) tableBody.innerHTML = createClientesTableRowsHTML(allClientesData);
    }
}

// --- Funções de Componentes (Gráficos, etc.) ---
function renderDashboardComponents() {
    const endDateFinal = new Date(dashboardEndDate);
    endDateFinal.setHours(23, 59, 59, 999);
    const dashboardLancamentos = allLancamentosData.filter(l => l.dataEmissao?.toDate() >= dashboardStartDate && l.dataEmissao?.toDate() <= endDateFinal);
    renderDashboardChart(allLancamentosData);
    renderNfPieChart(dashboardLancamentos);
    document.querySelectorAll('.dashboard-value').forEach(el => animateCountUp(el, parseFloat(el.dataset.value)));
}

// --- Lógica de Filtros e Paginação ---
function getFilteredData() {
    let filtered = [...allLancamentosData];
    if (selectedYearFilter !== null) {
        filtered = filtered.filter(l => l.dataEmissao?.toDate().getFullYear() === selectedYearFilter);
    }
    if (selectedMonthFilter !== null) {
        filtered = filtered.filter(l => l.dataEmissao?.toDate().getMonth() === selectedMonthFilter);
    }
    if (searchTerm) {
        const lowerCaseSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(l =>
            l.cliente?.toLowerCase().includes(lowerCaseSearch) ||
            l.numeroNf?.toLowerCase().includes(lowerCaseSearch) ||
            l.os?.toLowerCase().includes(lowerCaseSearch)
        );
    }
    filtered.sort((a, b) => {
        let valA = a[sortState.key];
        let valB = b[sortState.key];
        if (sortState.key === 'dataEmissao') {
            valA = valA?.toDate() || 0;
            valB = valB?.toDate() || 0;
        }
        if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
    });
    return filtered;
}

function applyFilters() {
    const filteredData = getFilteredData();
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    currentPage = Math.max(1, Math.min(currentPage, totalPages));
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(start, end);
    const tableBody = document.getElementById('lancamentosTableBody');
    if (tableBody) {
        tableBody.innerHTML = createLancamentosTableRowsHTML(paginatedData, currentUserProfile);
    }
    renderPaginationControls(currentPage, totalItems, totalPages, (direction) => {
        if (direction === 'prev') currentPage--;
        if (direction === 'next') currentPage++;
        applyFilters();
    });
    updateSortUI();
}

function populateFiltersAndApply() {
    const monthFilter = document.getElementById('monthFilter');
    const yearFilter = document.getElementById('yearFilter');
    const searchInput = document.getElementById('searchInput');
    if (!monthFilter || !yearFilter || !searchInput) return;

    const years = [...new Set(allLancamentosData.map(l => l.dataEmissao?.toDate().getFullYear()))].filter(Boolean).sort((a, b) => b - a);
    yearFilter.innerHTML = '<option value="">Todos os Anos</option>' + years.map(year => `<option value="${year}">${year}</option>`).join('');
    yearFilter.value = selectedYearFilter === null ? '' : selectedYearFilter;

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthFilter.innerHTML = '<option value="">Todos os Meses</option>' + monthNames.map((name, index) => `<option value="${index}">${name}</option>`).join('');
    monthFilter.value = selectedMonthFilter === null ? '' : selectedMonthFilter;

    monthFilter.onchange = () => { selectedMonthFilter = monthFilter.value === '' ? null : parseInt(monthFilter.value); currentPage = 1; applyFilters(); };
    yearFilter.onchange = () => { selectedYearFilter = yearFilter.value === '' ? null : parseInt(yearFilter.value); currentPage = 1; applyFilters(); };
    searchInput.oninput = () => { searchTerm = searchInput.value; currentPage = 1; applyFilters(); };
    applyFilters();
}

function updateSortUI() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        const existingIcon = btn.querySelector('svg');
        if (existingIcon) {
            existingIcon.remove();
        }
        const key = btn.dataset.key;
        let iconName = 'arrow-down-up';
        if (key === sortState.key) {
            iconName = sortState.direction === 'asc' ? 'arrow-up' : 'arrow-down';
        }
        btn.insertAdjacentHTML('beforeend', `<i data-lucide="${iconName}" class="h-4 w-4"></i>`);
    });
    lucide.createIcons();
}

function applyNfFilters() {
    let filteredData = [...allNotasCompraData];
    if (nfSelectedYearFilter !== null) {
        filteredData = filteredData.filter(nf => nf.dataEmissao?.toDate().getFullYear() === nfSelectedYearFilter);
    }
    if (nfSelectedMonthFilter !== null) {
        filteredData = filteredData.filter(nf => nf.dataEmissao?.toDate().getMonth() === nfSelectedMonthFilter);
    }
    filteredData.sort((a, b) => b.dataEmissao.toDate() - a.dataEmissao.toDate());
    const tableBody = document.getElementById('notasCompraTableBody');
    if (tableBody) tableBody.innerHTML = createNotasCompraTableRowsHTML(filteredData, allLancamentosData);
}

function populateNfFiltersAndApply() {
    const monthFilter = document.getElementById('nfMonthFilter');
    const yearFilter = document.getElementById('nfYearFilter');
    if (!monthFilter || !yearFilter) return;

    const years = [...new Set(allNotasCompraData.map(l => l.dataEmissao?.toDate().getFullYear()))].filter(Boolean).sort((a, b) => b - a);
    yearFilter.innerHTML = '<option value="">Todos os Anos</option>' + years.map(year => `<option value="${year}">${year}</option>`).join('');
    yearFilter.value = nfSelectedYearFilter === null ? '' : nfSelectedYearFilter;

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthFilter.innerHTML = '<option value="">Todos os Meses</option>' + monthNames.map((name, index) => `<option value="${index}">${name}</option>`).join('');
    monthFilter.value = nfSelectedMonthFilter === null ? '' : nfSelectedMonthFilter;

    monthFilter.onchange = () => { nfSelectedMonthFilter = monthFilter.value === '' ? null : parseInt(monthFilter.value); applyNfFilters(); };
    yearFilter.onchange = () => { nfSelectedYearFilter = yearFilter.value === '' ? null : parseInt(yearFilter.value); applyNfFilters(); };
    applyNfFilters();
}

function applyVariaveisFilters() {
    let filteredData = [...allVariaveisData];
    if (variaveisSelectedYearFilter !== null) {
        filteredData = filteredData.filter(v => v.data?.toDate().getFullYear() === variaveisSelectedYearFilter);
    }
    if (variaveisSelectedMonthFilter !== null) {
        filteredData = filteredData.filter(v => v.data?.toDate().getMonth() === variaveisSelectedMonthFilter);
    }
    filteredData.sort((a, b) => b.data.toDate() - a.data.toDate());
    const tableBody = document.getElementById('variaveisTableBody');
    if (tableBody) tableBody.innerHTML = createVariaveisTableRowsHTML(filteredData, currentUserProfile);
}

function populateVariaveisFiltersAndApply() {
    const monthFilter = document.getElementById('variaveisMonthFilter');
    const yearFilter = document.getElementById('variaveisYearFilter');
    if (!monthFilter || !yearFilter) return;

    const years = [...new Set(allVariaveisData.map(v => v.data?.toDate().getFullYear()))].filter(Boolean).sort((a, b) => b - a);
    yearFilter.innerHTML = '<option value="">Todos os Anos</option>' + years.map(year => `<option value="${year}">${year}</option>`).join('');
    yearFilter.value = variaveisSelectedYearFilter === null ? '' : variaveisSelectedYearFilter;

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthFilter.innerHTML = '<option value="">Todos os Meses</option>' + monthNames.map((name, index) => `<option value="${index}">${name}</option>`).join('');
    monthFilter.value = variaveisSelectedMonthFilter === null ? '' : variaveisSelectedMonthFilter;

    monthFilter.onchange = () => { variaveisSelectedMonthFilter = monthFilter.value === '' ? null : parseInt(monthFilter.value); applyVariaveisFilters(); };
    yearFilter.onchange = () => { variaveisSelectedYearFilter = yearFilter.value === '' ? null : parseInt(yearFilter.value); applyVariaveisFilters(); };
    applyVariaveisFilters();
}

// --- LÓGICA DO MODAL DE PAGAMENTOS ---
let activeModalTarget = null;

function openPagamentosModal(target) {
    activeModalTarget = target;
    const hiddenInputId = `hidden-pagamentos-data${target === 'compra' ? '-compra' : ''}`;
    const hiddenInput = document.getElementById(hiddenInputId);
    const pagamentosList = document.getElementById('modal-pagamentos-list');
    pagamentosList.innerHTML = '';

    try {
        const pagamentos = JSON.parse(hiddenInput.value || '[]');
        if (pagamentos.length > 0) {
            pagamentos.forEach(p => pagamentosList.innerHTML += createPagamentoRowHTML(p));
        } else {
            pagamentosList.innerHTML += createPagamentoRowHTML();
        }
    } catch (e) {
        pagamentosList.innerHTML += createPagamentoRowHTML();
    }
    
    lucide.createIcons();
    document.getElementById('pagamentosModal').classList.remove('hidden');
}

function savePagamentosFromModal() {
    const hiddenInputId = `hidden-pagamentos-data${activeModalTarget === 'compra' ? '-compra' : ''}`;
    const hiddenInput = document.getElementById(hiddenInputId);
    const pagamentosList = document.getElementById('modal-pagamentos-list');
    
    const pagamentos = [];
    pagamentosList.querySelectorAll('.pagamento-row').forEach(row => {
        const metodo = row.querySelector('.pagamento-metodo').value;
        const valor = parseFloat(row.querySelector('.pagamento-valor').value);
        const parcelasInput = row.querySelector('.pagamento-parcelas');
        const parcelas = parcelasInput.classList.contains('hidden') ? 1 : (parseInt(parcelasInput.value) || 1);
        
        if(metodo && !isNaN(valor) && valor > 0) {
            pagamentos.push({ metodo, valor, parcelas });
        }
    });

    hiddenInput.value = JSON.stringify(pagamentos);
    updatePagamentosSummary(activeModalTarget);
    closePagamentosModal();
}

function updatePagamentosSummary(target) {
    const summaryId = `pagamentos-summary${target === 'compra' ? '-compra' : ''}`;
    const hiddenInputId = `hidden-pagamentos-data${target === 'compra' ? '-compra' : ''}`;
    const summaryEl = document.getElementById(summaryId);
    const hiddenInput = document.getElementById(hiddenInputId);

    if (!summaryEl || !hiddenInput) return;

    try {
        const pagamentos = JSON.parse(hiddenInput.value || '[]');
        if (pagamentos.length === 0) {
            summaryEl.textContent = 'Nenhum pagamento adicionado.';
            return;
        }
        const total = pagamentos.reduce((sum, p) => sum + p.valor, 0);
        summaryEl.textContent = `${pagamentos.length} pagamento(s) adicionado(s). Total: ${formatCurrency(total)}`;
    } catch (e) {
        summaryEl.textContent = 'Erro ao ler pagamentos.';
    }
}

function closePagamentosModal() {
    document.getElementById('pagamentosModal').classList.add('hidden');
    activeModalTarget = null;
}
    
// --- Lógica de Relatórios e Backup ---
function generatePrintReport() {
    const dataToPrint = getFilteredData();
    if (dataToPrint.length === 0) {
        showAlertModal('Aviso', 'Não há dados para imprimir com os filtros atuais.');
        return;
    }
    const reportWindow = window.open('', '', 'height=800,width=1200');
    reportWindow.document.write('<html><head><title>Relatório de Lançamentos</title>');
    reportWindow.document.write('<style>@media print { body { -webkit-print-color-adjust: exact; } } body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #333; } h1 { text-align: center; margin-bottom: 10px; font-size: 16pt; color: #000; } p { font-size: 8pt; color: #777; margin-bottom: 20px; text-align: center; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; word-wrap: break-word; } th { background-color: #f0f0f0; font-weight: bold; color: #000; } tr:nth-child(even) { background-color: #f9f9f9; }</style>');
    reportWindow.document.write('</head><body>');
    reportWindow.document.write(`<h1>Relatório de Lançamentos</h1><p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>`);
    reportWindow.document.write('<table><thead><tr><th>Data</th><th>Cliente</th><th>NF</th><th>O.S/PC</th><th>Valor Total</th><th>Comissão</th><th>Faturado</th></tr></thead><tbody>');
    dataToPrint.forEach(l => {
        reportWindow.document.write(`<tr><td>${l.dataEmissao?.toDate().toLocaleDateString('pt-BR') || ''}</td><td>${l.cliente || ''}</td><td>${l.numeroNf || 'NT'}</td><td>${l.os || ''}</td><td>${formatCurrency(getGiroTotal(l))}</td><td>${currentUserProfile.funcao !== 'padrao' ? formatCurrency(l.comissao || 0) : 'N/A'}</td><td>${l.faturado ? l.faturado.toDate().toLocaleDateString('pt-BR') : 'Pendente'}</td></tr>`);
    });
    reportWindow.document.write('</tbody></table></body></html>');
    reportWindow.document.close();
    reportWindow.focus(); 
    reportWindow.print();
}

function generateCsvReport() {
    const dataToExport = getFilteredData();
    if (dataToExport.length === 0) {
        showAlertModal('Aviso', 'Não há dados para exportar com os filtros atuais.');
        return;
    }
    const escapeCsv = (str) => `"${(str === null || str === undefined ? '' : str).toString().replace(/"/g, '""')}"`;
    const headers = ['Data Emissao', 'Cliente', 'Numero NF', 'O.S/PC', 'Descricao', 'Valor Total', 'Comissao', 'Data Faturamento', 'Observacoes'];
    const csvRows = [headers.join(',')];
    dataToExport.forEach(l => {
        const row = [l.dataEmissao?.toDate().toLocaleDateString('pt-BR') || '', l.cliente || '', l.numeroNf || 'NT', l.os || '', l.descricao || '', getGiroTotal(l) || 0, currentUserProfile.funcao !== 'padrao' ? (l.comissao || 0) : 'N/A', l.faturado ? l.faturado.toDate().toLocaleDateString('pt-BR') : 'Pendente', l.obs || ''];
        csvRows.push(row.map(escapeCsv).join(','));
    });
    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_lancamentos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function generateBackupFile() {
    showConfirmModal('Fazer Backup Completo?', 'Isso irá gerar um arquivo JSON com todos os dados do sistema.', () => {
        const backupData = { lancamentos: allLancamentosData, clientes: allClientesData, variaveis: allVariaveisData, notasCompra: allNotasCompraData, backupDate: new Date().toISOString() };
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `backup_gestao_pro_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlertModal('Sucesso', 'O download do arquivo de backup foi iniciado.');
    });
}

async function handleRestoreFile(file) {
    showAlertModal('Aviso', 'A função de restaurar backup ainda não foi implementada.');
}

// --- Event Listeners Globais ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const loginButton = document.getElementById('loginButton');
            loginButton.disabled = true;
            loginButton.textContent = 'Entrando...';
        
            signInWithEmailAndPassword(auth, email, password)
                .catch(error => {
                    showAlertModal('Erro de Login', 'E-mail ou senha inválidos.');
                })
                .finally(() => {
                    loginButton.disabled = false;
                    loginButton.textContent = 'Entrar';
                });
        });
    }

    document.getElementById('alertModalCloseButton')?.addEventListener('click', () => closeModal('alertModal'));
    document.getElementById('confirmModalCancelButton')?.addEventListener('click', () => closeModal('confirmModal'));
    document.getElementById('confirmModalConfirmButton')?.addEventListener('click', handleConfirm);
    document.getElementById('pagamentosModalCancelBtn')?.addEventListener('click', closePagamentosModal);
    document.getElementById('pagamentosModalSaveBtn')?.addEventListener('click', savePagamentosFromModal);
});

appView.addEventListener('click', async (e) => {
    if (!currentUserProfile) return;
    const isReadOnly = currentUserProfile.funcao === 'leitura';
    const actionElement = e.target.closest('button, .faturado-toggle');
    const isAllowedForReadOnly = e.target.closest('.nav-link, .view-details, .back-to-list, .back-to-list-clientes, #exportPdfBtn, #exportCsvBtn, .sort-btn, #dashboardFilterBtn, #managePagamentosBtn, #managePagamentosCompraBtn');

    if (isReadOnly && actionElement && !isAllowedForReadOnly) {
        e.preventDefault();
        e.stopPropagation();
        showAlertModal('Acesso Negado', 'Você tem permissão apenas para visualização.');
        return;
    }
    
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
    else if (target.id === 'toggleFormBtn') {
        const formContainer = document.getElementById('formContainer');
        if (formContainer.style.maxHeight) {
            formContainer.style.maxHeight = null;
            setTimeout(() => { if (formContainer) formContainer.innerHTML = ''; }, 500);
        } else {
            formContainer.innerHTML = createNovoLancamentoFormHTML(currentUserProfile);
            updatePagamentosSummary('lancamento'); // Limpa o resumo
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
    else if (target.closest('.delete-variavel-btn')) {
        const id = target.closest('.delete-variavel-btn').dataset.id;
        showConfirmModal('Excluir Variável?', 'Esta ação não pode ser desfeita.', async () => {
            await deleteDoc(doc(db, 'variaveis', id));
            showAlertModal('Sucesso', 'Variável excluída.');
        });
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
                <div class="col-span-6"><input type="text" placeholder="Descrição do item" class="item-descricao mt-1 block w-full rounded-md border-slate-300 shadow-sm" required></div>
                <div class="col-span-2"><input type="number" value="1" class="item-quantidade mt-1 block w-full rounded-md border-slate-300 shadow-sm" required></div>
                <div class="col-span-3"><input type="number" step="0.01" placeholder="Valor Unit." class="item-valor mt-1 block w-full rounded-md border-slate-300 shadow-sm" required></div>
                <div class="col-span-1 text-right"><button type="button" class="remove-item-btn text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>
            </div>`;
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
    else if (target.id === 'managePagamentosBtn' || target.id === 'managePagamentosCompraBtn') {
        openPagamentosModal(target.dataset.modalTarget);
    }
    else if (target.id === 'addModalPagamentoBtn') {
        document.getElementById('modal-pagamentos-list').insertAdjacentHTML('beforeend', createPagamentoRowHTML());
        lucide.createIcons();
    }
    else if (target.closest('.remove-pagamento-btn')) {
        target.closest('.pagamento-row').remove();
    }
});

appView.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserProfile || currentUserProfile.funcao === 'leitura') {
        showAlertModal('Acesso Negado', 'Você não tem permissão para salvar ou alterar dados.');
        return;
    }
    
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
        if (form.id === 'addVariavelForm') {
            await addDoc(collection(db, "variaveis"), {
                data: Timestamp.fromDate(new Date(form.querySelector('#newVariavelData').value + 'T12:00:00Z')),
                descricao: form.querySelector('#newVariavelDescricao').value,
                valor: parseFloat(form.querySelector('#newVariavelValor').value),
            });
            showAlertModal('Sucesso', 'Nova variável cadastrada!');
            form.reset();
        }
        else if (form.id === 'addClienteForm') {
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
            const pagamentos = JSON.parse(form.querySelector('#hidden-pagamentos-data').value || '[]');
            const impostos = {
                iss: parseFloat(form.querySelector(`#${isEdit ? 'edit' : 'new'}ImpostoIss`)?.value) || 0,
                pis: parseFloat(form.querySelector(`#${isEdit ? 'edit' : 'new'}ImpostoPis`)?.value) || 0,
                cofins: parseFloat(form.querySelector(`#${isEdit ? 'edit' : 'new'}ImpostoCofins`)?.value) || 0,
                icms: parseFloat(form.querySelector(`#${isEdit ? 'edit' : 'new'}ImpostoIcms`)?.value) || 0,
            };
            const valorTotal = parseFloat(form.querySelector(`#${isEdit ? 'edit' : 'new'}ValorTotal`).value) || 0;
            let taxaComissao;
            if (currentUserProfile.funcao === 'padrao' && !isEdit) {
                taxaComissao = DEFAULT_COMISSION_RATE;
            } else {
                taxaComissao = parseFloat(form.querySelector(`#${isEdit ? 'edit' : 'new'}TaxaComissao`)?.value) || 0;
            }
            const data = {
                dataEmissao: Timestamp.fromDate(new Date(form.querySelector(`#${isEdit ? 'edit' : 'new'}DataEmissao`).value + 'T12:00:00Z')),
                cliente: form.querySelector(`#${isEdit ? 'edit' : 'new'}Cliente`).value,
                numeroNf: form.querySelector(`#${isEdit ? 'edit' : 'new'}NumeroNf`).value || 'NT',
                os: form.querySelector(`#${isEdit ? 'edit' : 'new'}Os`).value,
                descricao: form.querySelector(`#${isEdit ? 'edit' : 'new'}Descricao`).value,
                valorTotal: valorTotal,
                taxaComissao: taxaComissao,
                comissao: valorTotal * (taxaComissao / 100),
                obs: form.querySelector(`#${isEdit ? 'edit' : 'new'}Obs`).value,
                impostos: impostos,
                pagamentos: pagamentos,
                ...(isEdit ? {} : { faturado: null })
            };
            if (isEdit) {
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
            const pagamentosCompra = JSON.parse(form.querySelector('#hidden-pagamentos-data-compra').value || '[]');
            const itens = [];
            let valorTotal = 0;
            form.querySelectorAll('.item-row').forEach(row => {
                const descricao = row.querySelector('.item-descricao').value;
                const quantidade = parseFloat(row.querySelector('.item-quantidade').value) || 1;
                const valor = parseFloat(row.querySelector('.item-valor').value);
                if (descricao && !isNaN(valor)) {
                    itens.push({ descricao, quantidade, valor });
                    valorTotal += (quantidade * valor);
                }
            });
            if (itens.length === 0) {
                showAlertModal('Erro', 'Você precisa adicionar pelo menos um item válido.');
                submitButton.disabled = false; return;
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
                impostos: impostosCompra,
                pagamentos: pagamentosCompra
            });
            form.reset();
            const itensContainer = document.getElementById('itens-container');
            if (itensContainer) itensContainer.innerHTML = '';
            updatePagamentosSummary('compra');
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
    if (!currentUserProfile || currentUserProfile.funcao === 'leitura') {
        if(e.target.id === 'nfUploadInput' || e.target.id === 'restoreInput') {
             showAlertModal('Acesso Negado', 'Você não tem permissão para alterar dados.');
        }
        return;
    }
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
