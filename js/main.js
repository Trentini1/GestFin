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
        if (currentViewEl && (currentViewEl.id === 'notasFiscaisView' || currentViewEl.id === 'lancamentoDetailView')) {
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

// --- Lógica de Filtros, Ordenação e Paginação (sem alterações) ---
// ...

// --- Lógica de Relatórios e Backup (sem alterações) ---
// ...

// --- Event Listeners Globais ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('alertModalCloseButton').addEventListener('click', () => closeModal('alertModal'));
    document.getElementById('confirmModalCancelButton').addEventListener('click', () => closeModal('confirmModal'));
    document.getElementById('confirmModalConfirmButton').addEventListener('click', handleConfirm);
});

appView.addEventListener('click', async (e) => {
    const { target } = e;

    if (target.closest('.nav-link')) { e.preventDefault(); showView(target.closest('.nav-link').dataset.view); }
    else if (target.closest('.sort-btn')) { /* ... */ }
    else if (target.closest('#reset-sort')) { /* ... */ }
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
    else if (target.closest('.link-to-os')) {
        const lancamentoId = target.closest('.link-to-os').dataset.lancamentoId;
        if (lancamentoId) {
            showView('lancamentoDetailView', lancamentoId);
        }
    }
    else if (target.closest('.delete-notacompra-btn')) {
        const id = target.closest('.delete-notacompra-btn').dataset.id;
        showConfirmModal('Excluir Nota de Compra?', 'Esta ação é permanente e não pode ser desfeita.', async () => {
            await deleteDoc(doc(db, 'notasCompra', id));
            showAlertModal('Sucesso', 'A nota fiscal de compra foi excluída.');
        });
    }
    else if (target.id === 'addItemBtn') { /* ... */ } 
    else if (target.closest('.remove-item-btn')) { /* ... */ }
});

appView.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
        if (form.id === 'addVariavelForm') { /* ... */ }
        else if (form.id === 'addClienteForm') { /* ... */ }
        
        else if (form.id === 'novoLancamentoForm' || form.id === 'editLancamentoForm') {
            const isEdit = form.id === 'editLancamentoForm';
            const prefix = isEdit ? 'edit' : 'new';
            
            const impostos = {
                iss: parseFloat(form.querySelector(`#${prefix}ImpostoIss`).value) || 0,
                pis: parseFloat(form.querySelector(`#${prefix}ImpostoPis`).value) || 0,
                cofins: parseFloat(form.querySelector(`#${prefix}ImpostoCofins`).value) || 0,
                icms: parseFloat(form.querySelector(`#${prefix}ImpostoIcms`).value) || 0,
            };

            const data = {
                dataEmissao: Timestamp.fromDate(new Date(form.querySelector(`#${prefix}DataEmissao`).value + 'T12:00:00Z')),
                cliente: form.querySelector(`#${prefix}Cliente`).value,
                numeroNf: form.querySelector(`#${prefix}NumeroNf`).value || 'NT',
                os: form.querySelector(`#${prefix}Os`).value,
                descricao: form.querySelector(`#${prefix}Descricao`).value,
                valorTotal: parseFloat(form.querySelector(`#${prefix}ValorTotal`).value) || 0,
                taxaComissao: parseFloat(form.querySelector(`#${prefix}TaxaComissao`).value) || 0,
                comissao: (parseFloat(form.querySelector(`#${prefix}ValorTotal`).value) || 0) * ((parseFloat(form.querySelector(`#${prefix}TaxaComissao`).value) || 0) / 100),
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
                formContainer.style.maxHeight = null;
                setTimeout(() => formContainer.innerHTML = '', 500);
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
    // ... (código existente sem alterações)
});
