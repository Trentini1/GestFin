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
const loginContainer = document.getElementById('loginContainer');
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
            
            document.querySelector('[data-view="variaveisView"]').style.display = (currentUserProfile.funcao === 'padrao') ? 'none' : 'flex';

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
        if (currentViewEl && currentViewEl.id === 'lancamentosListView') {
            applyFilters();
        }
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar os lançamentos."));
}

function attachVariaveisListener() {
    const q = query(collection(db, 'variaveis'));
    variaveisUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allVariaveisData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl && currentViewEl.id === 'variaveisView') {
            renderView('variaveisView');
        }
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar as variáveis."));
}

function attachClientesListener() {
    const q = query(collection(db, 'clientes'));
    clientesUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allClientesData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        if (currentViewEl && currentViewEl.id === 'clientesView') {
            renderView('clientesView');
        }
    }, (error) => showAlertModal("Erro de Conexão", "Não foi possível carregar os clientes."));
}

function attachNotasCompraListener() {
    const q = query(collection(db, 'notasCompra'));
    notasCompraUnsubscribe = onSnapshot(q, (querySnapshot) => {
        allNotasCompraData = querySnapshot.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
        const currentViewEl = document.querySelector('.view[style*="block"]');
        const currentForm = currentViewEl ? currentViewEl.querySelector('form') : null;
        const dataId = currentForm ? currentForm.dataset.id : null;
        
        if (currentViewEl && (currentViewEl.id === 'notasFiscaisView' || currentViewEl.id === 'lancamentoDetailView')) {
             showView(currentViewEl.id, dataId);
        }
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
    if (viewContainer) viewContainer.style.display = 'block';

    if (viewId === 'dashboardView') {
        renderView(viewId);
    } else if (viewId === 'variaveisView') {
        renderView(viewId);
    } else if (viewId === 'clientesView') {
        renderView(viewId);
    } else if (viewId === 'notasFiscaisView') {
        renderView(viewId);
        if (currentUserProfile.funcao !== 'leitura') document.getElementById('addItemBtn')?.click();
    } else if (viewId === 'lancamentoDetailView' && dataId) {
        renderView(viewId, { isLoading: true });
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
    } else if (viewId === 'lancamentosListView') {
        renderView(viewId);
        populateFiltersAndApply();
    } else {
        renderView(viewId);
    }

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
            html = createDashboardHTML(dashboardLancamentos, totalVariaveis, startDate, endDate, currentUserProfile);
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
function getFilteredData() { /* ... */ }
function applyFilters() { /* ... */ }
function populateFiltersAndApply() { /* ... */ }
function updateSortUI() { /* ... */ }

// --- Lógica de Relatórios e Backup ---
function generatePrintReport() { /* ... */ }
function generateCsvReport() { /* ... */ }
function generateBackupFile() { /* ... */ }
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
            const taxaComissao = parseFloat(form.querySelector(`#${prefix}TaxaComissao`)?.value) || 0;
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
