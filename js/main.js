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
    renderNfPieChart, createVariaveisViewHTML, createVariaveisTableRowsHTML
} from './ui.js';

// --- Estado da Aplicação ---
let currentUser = null;
let lancamentosUnsubscribe = null;
let allLancamentosData = [];
let variaveisUnsubscribe = null;
let allVariaveisData = [];
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
    } else {
        currentUser = null;
        appView.style.display = 'none';
        loadingView.style.display = 'flex';
        loaderContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        if (lancamentosUnsubscribe) { lancamentosUnsubscribe(); lancamentosUnsubscribe = null; }
        if (variaveisUnsubscribe) { variaveisUnsubscribe(); variaveisUnsubscribe = null; }
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
        
        document.querySelectorAll('.dashboard-value').forEach(el => {
            animateCountUp(el, parseFloat(el.dataset.value));
        });

    } else if (viewId === 'variaveisView') {
        renderView(viewId);
        const tableBody = document.getElementById('variaveisTableBody');
        if (tableBody) {
            tableBody.innerHTML = createVariaveisTableRowsHTML(allVariaveisData);
        }

    } else if (viewId === 'lancamentoDetailView' && dataId) {
        // ... (lógica de detalhe)
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
        case 'dashboardView': 
            html = createDashboardHTML(data.dashboardLancamentos, data.totalVariaveis, data.startDate, data.endDate); 
            break;
        case 'variaveisView':
            html = createVariaveisViewHTML();
            break;
        case 'lancamentosListView': html = createLancamentosListHTML(); break;
        case 'lancamentoDetailView': html = createLancamentoDetailHTML(data); break;
    }
    viewContainer.innerHTML = html;
    lucide.createIcons();
}

// ... (todas as outras funções como getFilteredData, applyFilters, generatePrintReport, etc., continuam aqui)

// --- Event Listeners Globais ---
appView.addEventListener('click', async (e) => {
    const { target } = e;
    
    // ... (listeners de clique para navegação, ordenação, etc.)

    if (target.id === 'dashboardFilterBtn') {
        const startDateInput = document.getElementById('dashboardStartDate');
        const endDateInput = document.getElementById('dashboardEndDate');
        dashboardStartDate = new Date(startDateInput.value + 'T00:00:00');
        dashboardEndDate = new Date(endDateInput.value + 'T00:00:00');
        showView('dashboardView');
    }

    const deleteVariavelBtn = target.closest('.delete-variavel-btn');
    if (deleteVariavelBtn) {
        const id = deleteVariavelBtn.dataset.id;
        showConfirmModal('Excluir Variável?', 'Esta ação não pode ser desfeita.', async () => {
            await deleteDoc(doc(db, 'variaveis', id));
            showAlertModal('Sucesso', 'Variável excluída.');
        });
    }

    // ... (outros listeners de clique)
});

appView.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    
    if (form.id === 'addVariavelForm') {
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        try {
            const data = new Date(form.querySelector('#newVariavelData').value + 'T12:00:00Z');
            const nome = form.querySelector('#newVariavelNome').value;
            const valor = parseFloat(form.querySelector('#newVariavelValor').value);
            const descricao = form.querySelector('#newVariavelDescricao').value;

            await addDoc(collection(db, "variaveis"), { data: Timestamp.fromDate(data), nome, valor, descricao });
            form.reset();

        } catch (error) {
            showAlertModal("Erro", `Não foi possível salvar a variável. Erro: ${error.message}`);
        } finally {
            submitButton.disabled = false;
        }
        return;
    }

    // ... (lógica de submit para formulário de lançamentos)
});

// ... (Resto do arquivo com todos os outros listeners e funções)
