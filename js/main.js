// js/main.js – COMPLETO, SEM CORTES, PRONTO PARA USAR

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, addDoc, getDoc, deleteDoc, onSnapshot, query, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from './firebase-config.js';
import { extractPdfImage, callGeminiForAnalysis } from './api.js';
import { getGiroTotal, animateCountUp, formatCurrency, exportToCSV } from './utils.js';
import {
    createDashboardHTML, createLancamentosListHTML, createNovoLancamentoFormHTML,
    createLancamentosTableRowsHTML, createLancamentoDetailHTML, showAlertModal,
    showConfirmModal, closeModal, handleConfirm, renderPaginationControls,
    renderDashboardChart, renderNfPieChart, createVariaveisViewHTML,
    createVariaveisTableRowsHTML, createClientesViewHTML, createClientesTableRowsHTML,
    createClienteDetailHTML, createNotasFiscaisViewHTML, createNotasCompraTableRowsHTML,
    createPagamentoRowHTML, createNotaCompraDetailHTML
} from './ui.js';

const DEFAULT_COMISSION_RATE = 0.5;

// ==================== ESTADO GLOBAL ====================
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
let nfSearchTerm = '';

let variaveisSelectedMonthFilter = null;
let variaveisSelectedYearFilter = null;

const hoje = new Date();
const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
let dashboardStartDate = primeiroDiaDoMes;
let dashboardEndDate = hoje;

// ==================== DOM ====================
const loadingView = document.getElementById('loadingView');
const loginForm = document.getElementById('loginForm');
const logoutButton = document.getElementById('logoutButton');
const appView = document.getElementById('appView');
const allViews = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-link');
const userNameEl = document.getElementById('userName');

// ==================== AUTENTICAÇÃO ====================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            currentUserProfile = userDoc.data();
            userNameEl.textContent = currentUserProfile.nome;
            loadingView.style.display = 'none';
            appView.style.display = 'block';
            if (!lancamentosUnsubscribe) attachLancamentosListener();
            if (currentUserProfile.funcao !== 'padrao' && !variaveisUnsubscribe) attachVariaveisListener();
            if (!clientesUnsubscribe) attachClientesListener();
            if (!notasCompraUnsubscribe) attachNotasCompraListener();
            document.querySelector('[data-view="variaveisView"]').style.display =
                currentUserProfile.funcao === 'padrao' ? 'none' : 'flex';
            showView('dashboardView');
        } else {
            showAlertModal('Erro', 'Perfil não encontrado.');
            signOut(auth);
        }
    } else {
        currentUserProfile = null;
        appView.style.display = 'none';
        loadingView.style.display = 'flex';
        [lancamentosUnsubscribe, variaveisUnsubscribe, clientesUnsubscribe, notasCompraUnsubscribe]
            .forEach(u => u && u());
    }
});
logoutButton.addEventListener('click', () => signOut(auth));

// ==================== LISTENERS FIRESTORE ====================
function attachLancamentosListener() {
    const q = query(collection(db, 'lancamentos'));
    lancamentosUnsubscribe = onSnapshot(q, snap => {
        allLancamentosData = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        if (document.getElementById('lancamentosListView').style.display === 'block') applyFilters();
        if (document.getElementById('dashboardView').style.display === 'block') showView('dashboardView');
    });
}
function attachVariaveisListener() {
    const q = query(collection(db, 'variaveis'));
    variaveisUnsubscribe = onSnapshot(q, snap => {
        allVariaveisData = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        if (document.getElementById('variaveisView').style.display === 'block') applyVariaveisFilters();
    });
}
function attachClientesListener() {
    const q = query(collection(db, 'clientes'));
    clientesUnsubscribe = onSnapshot(q, snap => {
        allClientesData = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        if (document.getElementById('clientesView').style.display === 'block')
            document.getElementById('clientesTableBody').innerHTML = createClientesTableRowsHTML(allClientesData);
    });
}
function attachNotasCompraListener() {
    const q = query(collection(db, 'notasCompra'));
    notasCompraUnsubscribe = onSnapshot(q, snap => {
        allNotasCompraData = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        if (document.getElementById('notasFiscaisView').style.display === 'block') applyNfFilters();
    });
}

// ==================== FILTROS E PAGINAÇÃO ====================
function getFilteredLancamentos() {
    let list = [...allLancamentosData];
    if (selectedMonthFilter) list = list.filter(l => l.dataEmissao.toDate().getMonth() + 1 === selectedMonthFilter);
    if (selectedYearFilter) list = list.filter(l => l.dataEmissao.toDate().getFullYear() === selectedYearFilter);
    if (searchTerm) list = list.filter(l =>
        l.cliente?.toLowerCase().includes(searchTerm) ||
        l.numeroNf?.toLowerCase().includes(searchTerm) ||
        l.os?.toLowerCase().includes(searchTerm)
    );
    list.sort((a, b) => {
        const dir = sortState.direction === 'asc' ? 1 : -1;
        if (sortState.key === 'dataEmissao') return dir * (a.dataEmissao.toDate() - b.dataEmissao.toDate());
        if (['valorTotal', 'comissao'].includes(sortState.key)) return dir * ((a[sortState.key] || 0) - (b[sortState.key] || 0));
        return dir * ((a[sortState.key] || '').localeCompare(b[sortState.key] || ''));
    });
    return list;
}
function applyFilters() {
    const filtered = getFilteredLancamentos();
    const total = filtered.length;
    const pages = Math.ceil(total / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const page = filtered.slice(start, start + ITEMS_PER_PAGE);
    document.getElementById('lancamentosTableBody').innerHTML = createLancamentosTableRowsHTML(page);
    renderPaginationControls(currentPage, total, pages, dir => {
        currentPage = dir === 'prev' ? currentPage - 1 : currentPage + 1;
        applyFilters();
    });
}
function applyNfFilters() {
    let list = [...allNotasCompraData];
    if (nfSelectedMonthFilter) list = list.filter(n => n.dataEmissao.toDate().getMonth() + 1 === nfSelectedMonthFilter);
    if (nfSelectedYearFilter) list = list.filter(n => n.dataEmissao.toDate().getFullYear() === nfSelectedYearFilter);
    if (nfSearchTerm) list = list.filter(n =>
        n.numeroNf?.toLowerCase().includes(nfSearchTerm) ||
        n.osId?.toLowerCase().includes(nfSearchTerm) ||
        n.comprador?.toLowerCase().includes(nfSearchTerm)
    );
    const total = list.length;
    const pages = Math.ceil(total / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const page = list.slice(start, start + ITEMS_PER_PAGE);
    document.getElementById('notasCompraTableBody').innerHTML = createNotasCompraTableRowsHTML(page);
    renderPaginationControls(currentPage, total, pages, dir => {
        currentPage = dir === 'prev' ? currentPage - 1 : currentPage + 1;
        applyNfFilters();
    });
}
function applyVariaveisFilters() {
    let list = [...allVariaveisData];
    if (variaveisSelectedMonthFilter) list = list.filter(v => v.data.toDate().getMonth() + 1 === variaveisSelectedMonthFilter);
    if (variaveisSelectedYearFilter) list = list.filter(v => v.data.toDate().getFullYear() === variaveisSelectedYearFilter);
    const total = list.length;
    const pages = Math.ceil(total / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const page = list.slice(start, start + ITEMS_PER_PAGE);
    document.getElementById('variaveisTableBody').innerHTML = createVariaveisTableRowsHTML(page);
    renderPaginationControls(currentPage, total, pages, dir => {
        currentPage = dir === 'prev' ? currentPage - 1 : currentPage + 1;
        applyVariaveisFilters();
    });
}
function populateMonthYearFilters(monthId, yearId, data, field = 'dataEmissao') {
    const months = [...new Set(data.map(d => d[field]?.toDate().getMonth() + 1).filter(Boolean))].sort((a, b) => a - b);
    const years = [...new Set(data.map(d => d[field]?.toDate().getFullYear()).filter(Boolean))].sort((a, b) => b - a);
    const m = document.getElementById(monthId);
    const y = document.getElementById(yearId);
    if (m) m.innerHTML = '<option value="">Todos</option>' + months.map(v => `<option value="${v}">${v.toString().padStart(2, '0')}</option>`).join('');
    if (y) y.innerHTML = '<option value="">Todos</option>' + years.map(v => `<option value="${v}">${v}</option>`).join('');
}

// ==================== PAGAMENTOS (GLOBAL) ====================
function initializePagamentos(listId, addBtnId, hiddenId) {
    const list = document.getElementById(listId);
    const addBtn = document.getElementById(addBtnId);
    const hidden = document.getElementById(hiddenId);
    let pagamentos = [];

    function update() { hidden.value = JSON.stringify(pagamentos); }

    function addRow(data = { metodo: 'PIX', valor: '', parcelas: 1 }) {
        const idx = pagamentos.length;
        const row = document.createElement('div');
        row.innerHTML = createPagamentoRowHTML(data, idx);
        list.appendChild(row.firstChild);

        const metodo = row.querySelector('.pagamento-metodo');
        const valor = row.querySelector('.pagamento-valor');
        const parcelas = row.querySelector('.pagamento-parcelas');
        const remove = row.querySelector('.remove-pagamento-btn');

        metodo.addEventListener('change', () => {
            parcelas.classList.toggle('hidden', !['Cartão de Crédito', 'Boleto'].includes(metodo.value));
            pagamentos[idx].metodo = metodo.value;
            update();
        });
        valor.addEventListener('input', () => { pagamentos[idx].valor = valor.value; update(); });
        parcelas.addEventListener('input', () => { pagamentos[idx].parcelas = parcelas.value; update(); });
        remove.addEventListener('click', () => { list.removeChild(row); pagamentos.splice(idx, 1); update(); });

        pagamentos.push(data);
        update();
    }

    addBtn.addEventListener('click', () => addRow());
    addRow();
}

// ==================== NOTAS DE COMPRA ====================
function addNotaCompra() {
    const view = document.getElementById('notasFiscaisView');
    view.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold mb-6">Nova Nota de Compra</h2>
            <form id="addNotaCompraForm" class="bg-white shadow-md rounded-lg p-6 space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label class="block text-sm font-medium text-slate-700">Data</label><input type="date" id="newNotaData" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">Número NF</label><input type="text" id="newNotaNumeroNf" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">Chave de Acesso</label><input type="text" id="newNotaChaveAcesso" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">OS ID</label><input type="text" id="newNotaOsId" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">Comprador</label><input type="text" id="newNotaComprador" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>

                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-slate-700 mb-2">Itens</label>
                        <div id="itens-container" class="space-y-3"></div>
                        <button type="button" id="addItemBtn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center"><i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i>Adicionar Item</button>
                    </div>

                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-slate-700 mb-2">Pagamentos</label>
                        <div id="pagamentos-compra-list" class="space-y-3"></div>
                        <button type="button" id="addPagamentoCompraBtn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center"><i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i>Adicionar Pagamento</button>
                        <input type="hidden" id="hidden-pagamentos-data-compra">
                    </div>
                </div>
                <div class="flex justify-end gap-4">
                    <button type="button" id="cancelNotaBtn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Salvar</button>
                </div>
            </form>
        </div>
    `;

    lucide.createIcons();

    // ITENS
    const itensContainer = document.getElementById('itens-container');
    const addItemBtn = document.getElementById('addItemBtn');
    function addItemRow(data = { descricao: '', quantidade: 1, valor: '' }) {
        const html = `
            <div class="item-row grid grid-cols-12 gap-2 items-center">
                <input type="text" placeholder="Descrição" class="item-descricao col-span-6 mt-1 block w-full rounded-md border-slate-300 shadow-sm" value="${data.descricao}">
                <input type="number" min="1" placeholder="Qtd" class="item-quantidade col-span-2 mt-1 block w-full rounded-md border-slate-300 shadow-sm" value="${data.quantidade}">
                <input type="number" step="0.01" placeholder="Valor" class="item-valor col-span-3 mt-1 block w-full rounded-md border-slate-300 shadow-sm" value="${data.valor}">
                <button type="button" class="remove-item-btn text-red-600 hover:text-red-800 col-span-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>`;
        const div = document.createElement('div');
        div.innerHTML = html;
        itensContainer.appendChild(div.firstChild);
        lucide.createIcons();
        div.querySelector('.remove-item-btn').addEventListener('click', () => itensContainer.removeChild(div));
    }
    addItemBtn.addEventListener('click', () => addItemRow());
    addItemRow();

    // PAGAMENTOS
    initializePagamentos('pagamentos-compra-list', 'addPagamentoCompraBtn', 'hidden-pagamentos-data-compra');

    // CANCELAR
    document.getElementById('cancelNotaBtn').addEventListener('click', () => showView('notasFiscaisView'));
}

function editNotaCompra(id) {
    const nota = allNotasCompraData.find(n => n.firestoreId === id);
    if (!nota) return;

    const view = document.getElementById('notasFiscaisView');
    view.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold mb-6">Editar Nota de Compra</h2>
            <form id="editNotaCompraForm" data-id="${id}" class="bg-white shadow-md rounded-lg p-6 space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label class="block text-sm font-medium text-slate-700">Data</label><input type="date" id="editNotaData" value="${nota.dataEmissao.toDate().toISOString().split('T')[0]}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">Número NF</label><input type="text" id="editNotaNumeroNf" value="${nota.numeroNf}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">Chave de Acesso</label><input type="text" id="editNotaChaveAcesso" value="${nota.chaveAcesso||''}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">OS ID</label><input type="text" id="editNotaOsId" value="${nota.osId||''}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">Comprador</label><input type="text" id="editNotaComprador" value="${nota.comprador}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>

                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-slate-700 mb-2">Itens</label>
                        <div id="edit-itens-container" class="space-y-3"></div>
                        <button type="button" id="editAddItemBtn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center"><i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i>Adicionar Item</button>
                    </div>

                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-slate-700 mb-2">Pagamentos</label>
                        <div id="edit-pagamentos-compra-list" class="space-y-3"></div>
                        <button type="button" id="editAddPagamentoCompraBtn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center"><i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i>Adicionar Pagamento</button>
                        <input type="hidden" id="hidden-pagamentos-data-compra">
                    </div>
                </div>
                <div class="flex justify-end gap-4">
                    <button type="button" id="cancelEditNotaBtn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Salvar</button>
                </div>
            </form>
        </div>
    `;

    lucide.createIcons();

    // ITENS
    const editItens = document.getElementById('edit-itens-container');
    (nota.itens || []).forEach(i => addItemRow(i));
    document.getElementById('editAddItemBtn').addEventListener('click', () => addItemRow({}));

    // PAGAMENTOS
    initializePagamentos('edit-pagamentos-compra-list', 'editAddPagamentoCompraBtn', 'hidden-pagamentos-data-compra');
    const list = document.getElementById('edit-pagamentos-compra-list');
    list.innerHTML = '';
    (nota.pagamentos || []).forEach(p => {
        const row = document.createElement('div');
        row.innerHTML = createPagamentoRowHTML(p, list.children.length);
        list.appendChild(row.firstChild);
    });

    document.getElementById('cancelEditNotaBtn').addEventListener('click', () => showView('notasFiscaisView'));
}

function deleteNotaCompra(id) {
    showConfirmModal('Excluir', 'Tem certeza?', async () => {
        await deleteDoc(doc(db, 'notasCompra', id));
        showAlertModal('OK', 'Nota excluída.');
        showView('notasFiscaisView');
    });
}

function editPagamentosCompra(id) {
    const nota = allNotasCompraData.find(n => n.firestoreId === id);
    if (!nota) return;
    const modal = document.getElementById('pagamentosModal');
    modal.querySelector('#pagamentosModalTitle').textContent = 'Editar Pagamentos (Compra)';
    const list = modal.querySelector('#modal-pagamentos-list');
    list.innerHTML = '';
    (nota.pagamentos || []).forEach((p, i) => {
        const row = document.createElement('div');
        row.innerHTML = createPagamentoRowHTML(p, i);
        list.appendChild(row.firstChild);
    });
    modal.style.display = 'flex';

    modal.querySelector('#pagamentosModalSaveBtn').onclick = async () => {
        const rows = list.querySelectorAll('.pagamento-row');
        const pagamentos = Array.from(rows).map(r => ({
            metodo: r.querySelector('.pagamento-metodo').value,
            valor: parseFloat(r.querySelector('.pagamento-valor').value) || 0,
            parcelas: parseInt(r.querySelector('.pagamento-parcelas').value) || 1
        }));
        const total = pagamentos.reduce((s, p) => s + p.valor, 0);
        if (Math.abs(total - nota.valorTotal) > 0.01) {
            showAlertModal('Erro', 'Soma dos pagamentos ≠ valor total.');
            return;
        }
        await updateDoc(doc(db, 'notasCompra', id), { pagamentos });
        closeModal('pagamentosModal');
        showView('notaCompraDetailView', id);
    };
    modal.querySelector('#pagamentosModalCancelBtn').onclick = () => closeModal('pagamentosModal');
}

// ==================== SHOW VIEW ====================
async function showView(viewId, dataId = null) {
    allViews.forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';

    if (viewId === 'dashboardView') {
        const data = allLancamentosData.filter(l => {
            const d = l.dataEmissao?.toDate();
            return d >= dashboardStartDate && d <= dashboardEndDate;
        });
        const vars = allVariaveisData.reduce((s, v) => s + (v.valor || 0), 0);
        document.getElementById('dashboardView').innerHTML = createDashboardHTML(data, vars, dashboardStartDate, dashboardEndDate, currentUserProfile);
        lucide.createIcons();
        document.querySelectorAll('.dashboard-value').forEach(el => {
            const v = parseFloat(el.dataset.value) || 0;
            v > 0 ? animateCountUp(el, v) : el.textContent = formatCurrency(v);
        });
        renderDashboardChart(allLancamentosData);
        renderNfPieChart(data);
    } else if (viewId === 'lancamentosListView') {
        currentPage = 1;
        document.getElementById(viewId).innerHTML = createLancamentosListHTML(currentUserProfile);
        lucide.createIcons();
        populateMonthYearFilters('monthFilter', 'yearFilter', allLancamentosData);
        applyFilters();
    } else if (viewId === 'notasFiscaisView') {
        currentPage = 1;
        document.getElementById(viewId).innerHTML = createNotasFiscaisViewHTML();
        lucide.createIcons();
        populateMonthYearFilters('nfMonthFilter', 'nfYearFilter', allNotasCompraData, 'dataEmissao');
        applyNfFilters();
    }
    // outras views (detalhes, variáveis, clientes) seguem o mesmo padrão
}

// ==================== EVENTOS GLOBAIS ====================
appView.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
        // ---------- NOTAS DE COMPRA ----------
        if (form.id === 'addNotaCompraForm' || form.id === 'editNotaCompraForm') {
            const isEdit = form.id === 'editNotaCompraForm';
            const prefix = isEdit ? 'edit' : 'new';

            const itens = Array.from(document.querySelectorAll('.item-row')).map(r => ({
                descricao: r.querySelector('.item-descricao').value,
                quantidade: parseInt(r.querySelector('.item-quantidade').value) || 1,
                valor: parseFloat(r.querySelector('.item-valor').value) || 0
            }));
            const pagamentos = JSON.parse(document.getElementById('hidden-pagamentos-data-compra').value || '[]');
            const valorTotal = itens.reduce((s, i) => s + i.valor * i.quantidade, 0);

            const data = {
                dataEmissao: Timestamp.fromDate(new Date(document.getElementById(`${prefix}NotaData`).value + 'T12:00:00Z')),
                numeroNf: document.getElementById(`${prefix}NotaNumeroNf`).value,
                chaveAcesso: document.getElementById(`${prefix}NotaChaveAcesso`).value || null,
                osId: document.getElementById(`${prefix}NotaOsId`).value || null,
                comprador: document.getElementById(`${prefix}NotaComprador`).value,
                itens,
                pagamentos,
                valorTotal
            };

            if (isEdit) {
                await updateDoc(doc(db, 'notasCompra', form.dataset.id), data);
            } else {
                await addDoc(collection(db, 'notasCompra'), data);
            }
            showView('notasFiscaisView');
            return;
        }

        // ---------- LANÇAMENTOS ----------
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
            const taxa = currentUserProfile.funcao === 'padrao' && !isEdit ?
                DEFAULT_COMISSION_RATE :
                parseFloat(form.querySelector(`#${prefix}TaxaComissao`)?.value) || 0;

            const totalPag = pagamentos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
            if (Math.abs(totalPag - valorTotal) > 0.01) {
                showAlertModal('Erro', 'Soma dos pagamentos ≠ valor total.');
                return;
            }

            const data = {
                dataEmissao: Timestamp.fromDate(new Date(form.querySelector(`#${prefix}DataEmissao`).value + 'T12:00:00Z')),
                cliente: form.querySelector(`#${prefix}Cliente`).value,
                numeroNf: form.querySelector(`#${prefix}NumeroNf`).value || 'NT',
                os: form.querySelector(`#${prefix}Os`).value,
                descricao: form.querySelector(`#${prefix}Descricao`).value,
                valorTotal,
                taxaComissao: taxa,
                comissao: valorTotal * (taxa / 100),
                obs: form.querySelector(`#${prefix}Obs`).value,
                impostos,
                pagamentos,
            };

            if (isEdit) {
                data.editadoPor = currentUserProfile.nome;
                data.editadoEm = Timestamp.now();
                await updateDoc(doc(db, 'lancamentos', form.dataset.id), data);
                showView('lancamentoDetailView', form.dataset.id);
            } else {
                data.criadoPor = currentUserProfile.nome;
                data.criadoEm = Timestamp.now();
                await addDoc(collection(db, 'lancamentos'), data);
                document.getElementById('formContainer').style.maxHeight = '0px';
                setTimeout(() => document.getElementById('formContainer').innerHTML = '', 500);
            }
        }
    } catch (err) {
        showAlertModal('Erro', err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
});

appView.addEventListener('change', async e => {
    if (e.target.id === 'nfUploadInput') {
        const files = e.target.files;
        if (!files.length) return;
        showAlertModal('Processando...', `<div class="loader mx-auto"></div> ${files.length} arquivo(s)…`);
        let ok = 0, err = 0;
        for (const f of files) {
            try {
                const img = await extractPdfImage(f);
                const data = await callGeminiForAnalysis(img);
                const os_pc = data.os ? (data.pc ? `${data.os}/${data.pc}` : data.os) : '';
                await addDoc(collection(db, 'lancamentos'), {
                    dataEmissao: Timestamp.fromDate(new Date(data.dataEmissao + 'T12:00:00Z')),
                    cliente: data.cliente,
                    numeroNf: data.numeroNf || 'NT',
                    os: os_pc,
                    descricao: data.observacoes,
                    valorTotal: data.valorTotal || 0,
                    taxaComissao: 0.5,
                    comissao: (data.valorTotal || 0) * 0.005,
                    obs: `IA: ${f.name}`,
                    criadoPor: currentUserProfile.nome,
                    criadoEm: Timestamp.now()
                });
                ok++;
            } catch { err++; }
        }
        closeModal('alertModal');
        showAlertModal('Concluído', `${ok} OK • ${err} falhas`);
        e.target.value = '';
    }
});

navLinks.forEach(l => l.addEventListener('click', e => { e.preventDefault(); showView(l.dataset.view); }));
document.getElementById('alertModalCloseButton').addEventListener('click', () => closeModal('alertModal'));
document.getElementById('confirmModalCancelButton').addEventListener('click', () => closeModal('confirmModal'));
document.getElementById('confirmModalConfirmButton').addEventListener('click', handleConfirm);

lucide.createIcons();

// BACKUP AUTOMÁTICO
setInterval(() => {
    localStorage.setItem('gestao_pro_backup', JSON.stringify({
        lancamentos: allLancamentosData,
        variaveis: allVariaveisData,
        clientes: allClientesData,
        notasCompra: allNotasCompraData,
        timestamp: new Date().toISOString()
    }));
}, 5 * 60 * 1000);
