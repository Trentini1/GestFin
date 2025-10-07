// js/main.js

// Firebase SDK
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDoc, deleteDoc, onSnapshot, query, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Módulos locais
import { auth, db } from './firebase-config.js';
import { extractPdfImage, callGeminiForAnalysis } from './api.js';
import { getGiroTotal, animateCountUp } from './utils.js'; // Importa a nova função de animação
import {
    createDashboardHTML, createLancamentosListHTML, createNovoLancamentoFormHTML,
    createLancamentosTableRowsHTML, createLancamentoDetailHTML, showAlertModal,
    showConfirmModal, closeModal, handleConfirm, renderPaginationControls, renderDashboardChart
} from './ui.js';

// --- Estado da Aplicação ---
let currentUser = null;
let lancamentosUnsubscribe = null;
let allLancamentosData = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 15;
let selectedMonthFilter = new Date().getMonth();
let selectedYearFilter = new Date().getFullYear();
let searchTerm = ''; // NOVO: Estado para o termo de busca

// --- Seletores do DOM ---
// ... (seletores existentes)

// --- Lógica de Autenticação ---
// ... (código existente, sem alterações aqui)

// --- Lógica de Dados (Firestore) ---
// ... (código existente, sem alterações aqui)

// --- Lógica de Navegação e Renderização ---
async function showView(viewId, dataId = null) {
    allViews.forEach(v => v.style.display = 'none');
    const viewContainer = document.getElementById(viewId);
    viewContainer.style.display = 'block';

    if (viewId === 'lancamentoDetailView' && dataId) {
        // ... (código existente)
    } else {
        renderView(viewId, allLancamentosData);
    }

    if (viewId === 'lancamentosListView') {
        populateFiltersAndApply();
    } else if (viewId === 'dashboardView') {
        renderDashboardChart(allLancamentosData);
        
        // NOVO: Dispara a animação dos cards do dashboard
        const giroEl = document.getElementById('giro-total-mes');
        const faturamentoEl = document.getElementById('faturamento-mes');
        const comissoesEl = document.getElementById('comissoes-mes');

        if (giroEl) animateCountUp(giroEl, parseFloat(giroEl.dataset.value));
        if (faturamentoEl) animateCountUp(faturamentoEl, parseFloat(faturamentoEl.dataset.value));
        if (comissoesEl) animateCountUp(comissoesEl, parseFloat(comissoesEl.dataset.value));
    }
    
    // ... (código de navegação existente)
}

function renderView(viewId, data) {
    // ... (código existente, sem alterações aqui)
}


// --- Lógica de Filtros e Paginação ---
function getFilteredData() {
    // Converte o termo de busca para minúsculas para busca case-insensitive
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    return allLancamentosData.filter(l => {
        const date = l.dataEmissao?.toDate();
        if (!date) return false;

        // Filtros de data
        const monthMatch = selectedMonthFilter == -1 || date.getMonth() === selectedMonthFilter;
        const yearMatch = selectedYearFilter == -1 || date.getFullYear() === selectedYearFilter;

        // NOVO: Filtro de busca
        const searchMatch = !lowerCaseSearchTerm || 
                              (l.cliente && l.cliente.toLowerCase().includes(lowerCaseSearchTerm)) ||
                              (l.numeroNf && l.numeroNf.toLowerCase().includes(lowerCaseSearchTerm)) ||
                              (l.os && l.os.toLowerCase().includes(lowerCaseSearchTerm));
        
        return monthMatch && yearMatch && searchMatch;
    }).sort((a, b) => b.dataEmissao.toDate() - a.dataEmissao.toDate());
}

function applyFilters() {
    // ... (código existente, sem alterações aqui)
}

function populateFiltersAndApply() {
    // ... (código existente)

    // NOVO: Adiciona o listener para o campo de busca
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = searchTerm; // Mantém o valor da busca ao re-renderizar
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            currentPage = 1; // Reseta para a primeira página ao buscar
            applyFilters();
        });
    }
}

// --- Lógica de Relatórios ---
// ... (código existente, sem alterações aqui)

// --- Event Listeners Globais ---
// ... (código existente, sem alterações aqui)
