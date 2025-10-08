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
        // ... (lógica de detalhe)
    } else {
        renderView(viewId, allLancamentosData);
    }
    
    console.log(`[Checkpoint 10] renderView concluída para '${viewId}'. Iniciando lógicas específicas.`);
    
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
    console.log(`[Checkpoint 11] Lógicas específicas e navegação atualizadas para '${viewId}'.`);
}

function renderView(viewId, data) {
    // ... (função renderView existente, sem checkpoints necessários por enquanto)
}

// --- Funções restantes (filtros, relatórios, event listeners...) ---
// (O resto do seu código main.js continua aqui, sem alterações)
