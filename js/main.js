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
    createNotasFiscaisViewHTML, createNotasCompraTableRowsHTML
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

// Filtros de Lançamentos
let selectedMonthFilter = null;
let selectedYearFilter = null;
let searchTerm = '';
let sortState = { key: 'dataEmissao', direction: 'desc' };

// Filtros de Notas Fiscais
let nfSelectedMonthFilter = null;
let nfSelectedYearFilter = null;

// Filtros de Variáveis
let variaveisSelectedMonthFilter = null;
let variaveisSelectedYearFilter = null;

// Filtro de Dashboard
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
            if(variaveisNavLink) {
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
            if(tableBody) tableBody.innerHTML = createClientesTableRowsHTML(allClientesData);
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
    } catch(e) {
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

function renderView(viewId, data) {
    const viewContainer = document.getElementById(viewId);
    if (!viewContainer) return;
    let html = '';
    
    if (data?.isLoading) {
        viewContainer.innerHTML = `<div class="flex items-center justify-center h-96"><div class="loader"></div></div>`;
        lucide.createIcons();
        return;
    }

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
     if (viewId === 'dashboardView') {
        renderDashboardComponents();
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

// --- Lógica de Filtros, Ordenação e Paginação ---
function getFilteredData() {
    let filtered = [...allLancamentosData];

    // Filtro de Mês/Ano
    if (selectedMonthFilter !== null && selectedYearFilter !== null) {
        filtered = filtered.filter(l => {
            const data = l.dataEmissao?.toDate();
            return data && data.getMonth() === selectedMonthFilter && data.getFullYear() === selectedYearFilter;
        });
    }

    // Filtro de Busca
    if (searchTerm) {
        const lowerCaseSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(l =>
            l.cliente?.toLowerCase().includes(lowerCaseSearch) ||
            l.numeroNf?.toLowerCase().includes(lowerCaseSearch) ||
            l.os?.toLowerCase().includes(lowerCaseSearch)
        );
    }

    // Ordenação
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

    // Popula Anos
    const years = [...new Set(allLancamentosData.map(l => l.dataEmissao?.toDate().getFullYear()))].filter(Boolean).sort((a, b) => b - a);
    yearFilter.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
    if (years.includes(selectedYearFilter)) {
        yearFilter.value = selectedYearFilter;
    }

    // Popula Meses
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthFilter.innerHTML = monthNames.map((name, index) => `<option value="${index}">${name}</option>`).join('');
    monthFilter.value = selectedMonthFilter;

    // Adiciona Event Listeners
    monthFilter.onchange = () => { selectedMonthFilter = parseInt(monthFilter.value); currentPage = 1; applyFilters(); };
    yearFilter.onchange = () => { selectedYearFilter = parseInt(yearFilter.value); currentPage = 1; applyFilters(); };
    searchInput.oninput = () => { searchTerm = searchInput.value; currentPage = 1; applyFilters(); };

    applyFilters();
}

function updateSortUI() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        // 1. Remove o ícone SVG antigo, se existir
        const existingIcon = btn.querySelector('svg');
        if (existingIcon) {
            existingIcon.remove();
        }

        // 2. Define qual o nome do novo ícone
        const key = btn.dataset.key;
        let iconName = 'arrow-down-up';
        if (key === sortState.key) {
            iconName = sortState.direction === 'asc' ? 'arrow-up' : 'arrow-down';
        }

        // 3. Adiciona a nova tag <i> de volta ao botão
        btn.insertAdjacentHTML('beforeend', `<i data-lucide="${iconName}" class="h-4 w-4"></i>`);
    });
    // 4. Renderiza todos os novos ícones que foram adicionados
    lucide.createIcons();
}
function applyNfFilters() {
    let filteredData = [...allNotasCompraData];
    if (nfSelectedYearFilter !== null) {
        filteredData = filteredData.filter(nf => nf.dataEmissao?.toDate().getFullYear() === nfSelectedYearFilter);
        if (nfSelectedMonthFilter !== null) {
            filteredData = filteredData.filter(nf => nf.dataEmissao?.toDate().getMonth() === nfSelectedMonthFilter);
        }
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

// ADICIONADO: Funções de filtro para Variáveis
function applyVariaveisFilters() {
    let filteredData = [...allVariaveisData];
    if (variaveisSelectedYearFilter !== null) {
        filteredData = filteredData.filter(v => v.data?.toDate().getFullYear() === variaveisSelectedYearFilter);
        if (variaveisSelectedMonthFilter !== null) {
            filteredData = filteredData.filter(v => v.data?.toDate().getMonth() === variaveisSelectedMonthFilter);
        }
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

// --- Lógica de Relatórios e Backup ---
Exato! Os botões voltaram, mas as funções que eles chamam estavam vazias, como "cascas" sem funcionalidade. Agora vamos adicionar a "inteligência" a cada um deles.

O seu arquivo ui.js está perfeito, não precisa mexer nele. Todas as alterações serão no arquivo main.js.

O que Vamos Fazer
Exportar PDF: Criaremos uma função que gera uma tabela limpa com os dados filtrados e abre a janela de impressão do navegador (que tem a opção "Salvar como PDF").

Exportar CSV: Criaremos uma função que converte os dados filtrados em um arquivo .csv, que pode ser aberto no Excel, Google Sheets, etc., e inicia o download.

Fazer Backup: Criaremos uma função que pega todos os seus dados (lançamentos, clientes, etc.) e os salva em um único arquivo .json, que serve como um ponto de restauração seguro.

Abaixo estão as implementações completas dessas funções. Para facilitar, no final, vou te dar o arquivo main.js completo já com tudo isso incluído.

1. Exportar para PDF (generatePrintReport)
Esta função cria uma nova janela com uma tabela estilizada e chama o comando de impressão.

JavaScript

function generatePrintReport() {
    const dataToPrint = getFilteredData(); // Pega os dados já filtrados na tela
    if (dataToPrint.length === 0) {
        showAlertModal('Aviso', 'Não há dados para imprimir.');
        return;
    }

    const reportWindow = window.open('', '', 'height=800,width=1200');
    reportWindow.document.write('<html><head><title>Relatório de Lançamentos</title>');
    reportWindow.document.write(`
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { text-align: center; }
        </style>
    `);
    reportWindow.document.write('</head><body>');
    reportWindow.document.write(`<h1>Relatório de Lançamentos</h1>`);
    reportWindow.document.write(`<p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>`);
    reportWindow.document.write('<table><thead><tr>');
    reportWindow.document.write('<th>Data</th><th>Cliente</th><th>NF</th><th>O.S/PC</th><th>Valor Total</th><th>Comissão</th><th>Faturado</th>');
    reportWindow.document.write('</tr></thead><tbody>');

    dataToPrint.forEach(l => {
        reportWindow.document.write('<tr>');
        reportWindow.document.write(`<td>${l.dataEmissao?.toDate().toLocaleDateString('pt-BR') || ''}</td>`);
        reportWindow.document.write(`<td>${l.cliente || ''}</td>`);
        reportWindow.document.write(`<td>${l.numeroNf || 'NT'}</td>`);
        reportWindow.document.write(`<td>${l.os || ''}</td>`);
        reportWindow.document.write(`<td>${formatCurrency(getGiroTotal(l))}</td>`);
        reportWindow.document.write(`<td>${currentUserProfile.funcao !== 'padrao' ? formatCurrency(l.comissao) : 'N/A'}</td>`);
        reportWindow.document.write(`<td>${l.faturado ? l.faturado.toDate().toLocaleDateString('pt-BR') : 'Pendente'}</td>`);
        reportWindow.document.write('</tr>');
    });

    reportWindow.document.write('</tbody></table></body></html>');
    reportWindow.document.close();
    reportWindow.focus(); 
    reportWindow.print();
}
function generateCsvReport() {
    const dataToExport = getFilteredData();
    if (dataToExport.length === 0) {
        showAlertModal('Aviso', 'Não há dados para exportar.');
        return;
    }

    // Função auxiliar para garantir que o texto com vírgulas não quebre o CSV
    const escapeCsv = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

    const headers = ['Data Emissao', 'Cliente', 'Numero NF', 'O.S/PC', 'Descricao', 'Valor Total', 'Comissao', 'Data Faturamento', 'Observacoes'];
    
    const csvRows = [headers.join(',')]; // Inicia com os cabeçalhos

    dataToExport.forEach(l => {
        const row = [
            l.dataEmissao?.toDate().toLocaleDateString('pt-BR') || '',
            l.cliente || '',
            l.numeroNf || 'NT',
            l.os || '',
            l.descricao || '',
            getGiroTotal(l) || 0,
            currentUserProfile.funcao !== 'padrao' ? (l.comissao || 0) : 'N/A',
            l.faturado ? l.faturado.toDate().toLocaleDateString('pt-BR') : 'Pendente',
            l.obs || ''
        ];
        csvRows.push(row.map(escapeCsv).join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); // \uFEFF para Excel entender acentos
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
    const backupData = {
        lancamentos: allLancamentosData,
        clientes: allClientesData,
        variaveis: allVariaveisData,
        notasCompra: allNotasCompraData,
        backupDate: new Date().toISOString()
    };

    const jsonString = JSON.stringify(backupData, null, 2); // O 'null, 2' formata o arquivo para ficar legível
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement("a");

    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `backup_gestao_pro_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
async function handleRestoreFile(file) { /* ... */ }

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
});

appView.addEventListener('click', async (e) => {
    if (!currentUserProfile) return;
    const isReadOnly = currentUserProfile.funcao === 'leitura';
    const actionElement = e.target.closest('button, .faturado-toggle');
    const isAllowedForReadOnly = e.target.closest('.nav-link, .view-details, .back-to-list, .back-to-list-clientes, #exportPdfBtn, #exportCsvBtn, .sort-btn, #dashboardFilterBtn');

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
        const newItemHTML = `<div class="item-row grid grid-cols-12 gap-2 items-center"><div class="col-span-8"><input type="text" placeholder="Descrição do item" class="item-descricao mt-1 block w-full rounded-md border-slate-300 shadow-sm" required></div><div class="col-span-3"><input type="number" step="0.01" placeholder="Valor" class="item-valor mt-1 block w-full rounded-md border-slate-300 shadow-sm" required></div><div class="col-span-1 text-right"><button type="button" class="remove-item-btn text-red-500 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>`;
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
        
        let taxaComissao;
       
        if (currentUserProfile.funcao === 'padrao' && !isEdit) {
            taxaComissao = DEFAULT_COMISSION_RATE;
        } else {
           
            taxaComissao = parseFloat(form.querySelector(`#${prefix}TaxaComissao`)?.value) || 0;
        }

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
    if (!currentUserProfile || currentUserProfile.funcao === 'leitura') {
        showAlertModal('Acesso Negado', 'Você não tem permissão para alterar dados.');
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
