// --- VERSÃO DE DEPURAÇÃO ---
console.log('[Checkpoint 1] Módulo main.js carregado.');

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

console.log('[Checkpoint 2] Todos os módulos foram importados.');

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

console.log('[Checkpoint 3] Variáveis e seletores do DOM prontos.');

// --- Lógica de Autenticação ---
onAuthStateChanged(auth, user => {
    console.log('[Checkpoint 4] onAuthStateChanged foi disparado. Usuário:', user ? `ID: ${user.uid}` : 'null');
    if (user) {
        currentUser = user;
        userIdEl.textContent = user.uid.substring(0, 8) + '...';
        loadingView.style.display = 'none';
        appView.style.display = 'block';
        console.log('[Checkpoint 5] Usuário autenticado. UI principal visível.');
        if (!lancamentosUnsubscribe) {
            console.log('[Checkpoint 6] Chamando attachLancamentosListener...');
            attachLancamentosListener();
        }
    } else {
        currentUser = null;
        appView.style.display = 'none';
        loadingView.style.display = 'flex';
        loaderContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        console.log('[Checkpoint 5.1] Usuário deslogado. Tela de login visível.');
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
    console.log('[Checkpoint 7] Dentro de attachLancamentosListener.');
    const q = query(collection(db, 'lancamentos'));
    lancamentosUnsubscribe = onSnapshot(q, (querySnapshot) => {
        console.log(`[Checkpoint 8] onSnapshot (Firestore) recebeu dados. ${querySnapshot.docs.length} documentos.`);
        allLancamentosData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        const viewId = currentViewEl ? currentViewEl.id : 'dashboardView';
        showView(viewId);
    }, (error) => {
        console.error('[ERRO] Falha no onSnapshot:', error);
        showAlertModal("Erro de Conexão", "Não foi possível carregar os lançamentos.");
    });
}

// --- Lógica de Navegação e Renderização ---
async function showView(viewId, dataId = null) {
    console.log(`[Checkpoint 9] showView chamada para a view: '${viewId}'`);
    allViews.forEach(v => v.style.display = 'none');
    const viewContainer = document.getElementById(viewId);
    if (viewContainer) {
        viewContainer.style.display = 'block';
    } else {
        console.error(`[ERRO] A view com ID '${viewId}' não foi encontrada.`);
        return;
    }

    if (viewId === 'lancamentoDetailView' && dataId) {
        // ... (lógica de detalhe - não relevante para o bug atual)
    } else {
        renderView(viewId, allLancamentosData);
    }
    
    console.log(`[Checkpoint 10] renderView concluída para '${viewId}'. Iniciando lógicas específicas.`);
    
    if (viewId === 'lancamentosListView') {
        populateFiltersAndApply();
    } else if (viewId === 'dashboardView') {
        
        console.log("--> [DASHBOARD] Iniciando renderDashboardChart...");
        renderDashboardChart(allLancamentosData);
        console.log("<-- [DASHBOARD] renderDashboardChart CONCLUÍDO.");

        console.log("--> [DASHBOARD] Iniciando renderNfPieChart...");
        renderNfPieChart(allLancamentosData);
        console.log("<-- [DASHBOARD] renderNfPieChart CONCLUÍDO.");

        console.log("--> [DASHBOARD] Iniciando animações...");
        document.querySelectorAll('.dashboard-value').forEach(el => {
            animateCountUp(el, parseFloat(el.dataset.value));
        });
        console.log("<-- [DASHBOARD] Animações CONCLUÍDAS.");
    }
    
    navLinks.forEach(link => {
        const isActive = link.dataset.view === viewId;
        link.classList.toggle('text-indigo-600', isActive);
        link.classList.toggle('border-b-2', isActive);
        link.classList.toggle('border-indigo-600', isActive);
        link.classList.toggle('text-slate-500', !isActive);
    });
    console.log(`[Checkpoint 11] Lógicas específicas e navegação atualizadas para '${viewId}'.`);
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


// --- Funções restantes (filtros, relatórios, event listeners...) ---
// (O resto do código é a versão funcional que já tínhamos)
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

function generatePrintReport() {
    // ... (função de gerar PDF)
}

function generateCsvReport() {
    // ... (função de gerar CSV)
}

document.addEventListener('DOMContentLoaded', () => {
    // ...
});

appView.addEventListener('click', async (e) => {
    // ... (listeners de clique)
});

appView.addEventListener('submit', async (e) => {
    // ... (listeners de submit)
});

appView.addEventListener('change', async (e) => {
    // ... (listeners de change)
});
