// Firebase SDK
import { signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, addDoc, getDoc, deleteDoc, onSnapshot, query, updateDoc, deleteField, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
// ... (variáveis de estado existentes)
let sortState = { key: 'dataEmissao', direction: 'desc' };

// NOVO: Estado para as datas do dashboard
const hoje = new Date();
const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
let dashboardStartDate = primeiroDiaDoMes;
let dashboardEndDate = hoje;

// --- Seletores do DOM ---
// ... (seletores existentes)

// --- Lógica de Autenticação e Dados ---
// ... (código existente sem alteração)

// --- Lógica de Navegação e Renderização ---
async function showView(viewId, dataId = null) {
    allViews.forEach(v => v.style.display = 'none');
    const viewContainer = document.getElementById(viewId);
    if (viewContainer) {
        viewContainer.style.display = 'block';
    }

    // Lógica de Renderização Específica da View
    if (viewId === 'dashboardView') {
        // Filtra os dados ANTES de renderizar qualquer coisa no dashboard
        const dashboardData = allLancamentosData.filter(l => {
            const dataLancamento = l.dataEmissao?.toDate();
            if (!dataLancamento) return false;
            // Ajusta o fim do dia para incluir o dia final completo
            const endDateFinal = new Date(dashboardEndDate);
            endDateFinal.setHours(23, 59, 59, 999);
            return dataLancamento >= dashboardStartDate && dataLancamento <= endDateFinal;
        });

        renderView(viewId, { dashboardData, startDate: dashboardStartDate, endDate: dashboardEndDate });
        renderDashboardChart(allLancamentosData); // Gráfico de 6 meses usa todos os dados
        renderNfPieChart(dashboardData); // Gráfico de pizza usa dados do período
        
        // Dispara animações
        const giroEl = document.getElementById('giro-total-mes');
        const faturamentoEl = document.getElementById('faturamento-mes');
        const comissoesEl = document.getElementById('comissoes-mes');

        if (giroEl) animateCountUp(giroEl, parseFloat(giroEl.dataset.value));
        if (faturamentoEl) animateCountUp(faturamentoEl, parseFloat(faturamentoEl.dataset.value));
        if (comissoesEl) animateCountUp(comissoesEl, parseFloat(comissoesEl.dataset.value));

    } else if (viewId === 'lancamentoDetailView' && dataId) {
        // ... (lógica existente)
    } else {
        renderView(viewId, allLancamentosData);
    }

    if (viewId === 'lancamentosListView') {
        populateFiltersAndApply();
    }
    
    // ... (lógica de navegação existente)
}

function renderView(viewId, data) {
    const viewContainer = document.getElementById(viewId);
    if (!viewContainer) return;
    let html = '';
    switch (viewId) {
        case 'dashboardView': 
            html = createDashboardHTML(data.dashboardData, data.startDate, data.endDate); 
            break;
        // ... (resto do switch)
    }
    viewContainer.innerHTML = html;
    lucide.createIcons();
}

// ... (Resto do arquivo com as lógicas de filtro, paginação, etc.)

// --- NOVAS FUNÇÕES: Backup e Restauração ---

function generateBackupFile() {
    if (allLancamentosData.length === 0) {
        showAlertModal('Aviso', 'Não há dados para fazer backup.');
        return;
    }

    // Converte Timestamps para um formato de texto (string ISO)
    const backupData = allLancamentosData.map(lancamento => {
        const serializable = { ...lancamento };
        if (serializable.dataEmissao) {
            serializable.dataEmissao = serializable.dataEmissao.toDate().toISOString();
        }
        if (serializable.faturado) {
            serializable.faturado = serializable.faturado.toDate().toISOString();
        }
        delete serializable.firestoreId; // Remove o ID do Firestore
        return serializable;
    });

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `backup-gestao-pro-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function handleRestoreFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const dataToRestore = JSON.parse(event.target.result);
            if (!Array.isArray(dataToRestore)) {
                throw new Error("O arquivo de backup não é um array válido.");
            }

            showConfirmModal(
                'Restaurar Backup?',
                `Você está prestes a adicionar ${dataToRestore.length} lançamentos do arquivo. Isso não apagará os dados existentes. Deseja continuar?`,
                async () => {
                    showAlertModal('Processando...', 'Restaurando backup. Isso pode levar um momento.');
                    const batch = writeBatch(db);

                    dataToRestore.forEach(lancamento => {
                        const newDocRef = doc(collection(db, "lancamentos"));
                        const restoredLancamento = { ...lancamento };
                        // Converte as strings de data de volta para objetos Date do Firebase
                        if (restoredLancamento.dataEmissao) {
                            restoredLancamento.dataEmissao = new Date(restoredLancamento.dataEmissao);
                        }
                        if (restoredLancamento.faturado) {
                            restoredLancamento.faturado = new Date(restoredLancamento.faturado);
                        }
                        batch.set(newDocRef, restoredLancamento);
                    });

                    await batch.commit();
                    closeModal('alertModal');
                    showAlertModal('Sucesso!', `${dataToRestore.length} lançamentos foram restaurados.`);
                }
            );

        } catch (error) {
            showAlertModal('Erro de Restauração', `Não foi possível ler o arquivo de backup. Verifique se o arquivo JSON é válido. Erro: ${error.message}`);
        }
    };
    reader.readAsText(file);
}

// --- Event Listeners Globais ---
// ...
appView.addEventListener('click', async (e) => {
    // ... (listeners existentes: navLink, sortBtn, deleteBtn, etc.)

    // NOVO: Listener para o filtro do dashboard
    if (target.id === 'dashboardFilterBtn') {
        const startDateInput = document.getElementById('dashboardStartDate');
        const endDateInput = document.getElementById('dashboardEndDate');
        dashboardStartDate = new Date(startDateInput.value + 'T00:00:00');
        dashboardEndDate = new Date(endDateInput.value + 'T00:00:00');
        showView('dashboardView');
    }

    // NOVO: Listeners para backup e restauração
    if (target.id === 'backupBtn') {
        generateBackupFile();
    }

    if (target.id === 'restoreBtn') {
        document.getElementById('restoreInput').click();
    }
});

// ... (listener de 'submit' existente)

appView.addEventListener('change', async (e) => {
    // ... (listener de upload de NF existente)
    
    // NOVO: Listener para o input de restauração de backup
    if (e.target.id === 'restoreInput') {
        const file = e.target.files[0];
        handleRestoreFile(file);
        e.target.value = ''; // Limpa o input para poder selecionar o mesmo arquivo novamente
    }
});
