// js/ui.js

import { formatCurrency, getGiroTotal } from './utils.js';

const DEFAULT_COMISSION_RATE = 0,05; // Em porcentagem (ex: 5 para 5%)

// --- Funções de criação de HTML ---

export const createDashboardHTML = (lancamentos) => {
    // ... (código existente, sem alterações aqui)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const faturadosNoMes = lancamentos.filter(l => {
        const faturadoDate = l.faturado?.toDate();
        return faturadoDate && faturadoDate.getMonth() === currentMonth && faturadoDate.getFullYear() === currentYear;
    });

    const faturamentoMes = faturadosNoMes.reduce((sum, l) => sum + getGiroTotal(l), 0);
    const comissoesMes = faturadosNoMes.reduce((sum, l) => sum + (l.comissao || 0), 0);
    const giroTotalMes = lancamentos
        .filter(l => {
            const emissaoDate = l.dataEmissao?.toDate();
            return emissaoDate && emissaoDate.getMonth() === currentMonth && emissaoDate.getFullYear() === currentYear;
        })
        .reduce((sum, l) => sum + getGiroTotal(l), 0);

    // ADICIONADO: IDs únicos para os parágrafos com os valores para a animação
    return `<h2 class="text-2xl font-bold mb-6">Dashboard</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="bg-blue-100 p-3 rounded-full"><i data-lucide="trending-up" class="w-6 h-6 text-blue-600"></i></div><div class="ml-4"><p class="text-sm text-slate-500">Giro Total do Mês</p><p id="giro-total-mes" data-value="${giroTotalMes}" class="text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="bg-green-100 p-3 rounded-full"><i data-lucide="dollar-sign" class="w-6 h-6 text-green-600"></i></div><div class="ml-4"><p class="text-sm text-slate-500">Faturamento do Mês</p><p id="faturamento-mes" data-value="${faturamentoMes}" class="text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="bg-yellow-100 p-3 rounded-full"><i data-lucide="percent" class="w-6 h-6 text-yellow-600"></i></div><div class="ml-4"><p class="text-sm text-slate-500">Comissões do Mês</p><p id="comissoes-mes" data-value="${comissoesMes}" class="text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
        </div>
        <div class="mt-8 bg-white p-6 rounded-lg shadow">
            <h3 class="text-lg font-medium mb-4">Desempenho dos Últimos 6 Meses</h3>
            <div class="relative h-96">
                <canvas id="dashboardChart"></canvas>
            </div>
        </div>`;
};

export const createLancamentosListHTML = () => {
    // ALTERAÇÃO: Adicionado o campo de busca logo abaixo do container do formulário
    return `
    <div class="space-y-6">
        <div class="flex space-x-4">
            <button id="toggleFormBtn" class="w-full flex justify-center items-center py-3 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:bg-slate-200 hover:border-slate-400 transition-colors">
                <i data-lucide="plus" class="w-5 h-5 mr-2"></i> Adicionar Lançamento Manual
            </button>
            <button id="analiseIaBtn" class="w-full flex justify-center items-center py-3 px-4 bg-indigo-100 text-indigo-700 border-2 border-dashed border-indigo-300 rounded-lg hover:bg-indigo-200 hover:border-indigo-400 transition-colors font-semibold">
                <i data-lucide="scan-line" class="w-5 h-5 mr-2"></i> Analisar NF com IA
            </button>
            <input type="file" id="nfUploadInput" class="hidden" accept="application/pdf" multiple>
        </div>
        <div id="formContainer"></div>

        <div class="relative">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"></i>
            <input type="search" id="searchInput" placeholder="Buscar por cliente, NF ou O.S..." class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
        </div>
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 class="text-2xl font-bold">Histórico de Lançamentos</h2>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <label for="monthFilter" class="text-sm font-medium">Mês:</label>
                    <select id="monthFilter" class="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></select>
                </div>
                <div class="flex items-center gap-2">
                    <label for="yearFilter" class="text-sm font-medium">Ano:</label>
                    <select id="yearFilter" class="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></select>
                </div>
            </div>
        </div>
        <div class="bg-white shadow overflow-x-auto sm:rounded-lg">
            <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Data Emissão</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Cliente</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">NF</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">O.S/PC</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Giro Total</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Comissão</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Faturado</th>
                        <th class="relative px-6 py-3"><span class="sr-only">Ações</span></th>
                    </tr>
                </thead>
                <tbody id="lancamentosTableBody" class="bg-white divide-y divide-slate-200"></tbody>
            </table>
        </div>
        <div id="pagination-controls" class="flex justify-between items-center text-sm"></div>
        <div class="mt-8 bg-white p-6 rounded-lg shadow">
            <h3 class="text-lg font-medium mb-4">Exportar Relatório</h3>
            <div class="flex space-x-4">
                <button id="exportPdfBtn" class="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg flex items-center">
                    <i data-lucide="printer" class="w-4 h-4 mr-2"></i> Imprimir / Salvar PDF
                </button>
                <button id="exportCsvBtn" class="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-4 rounded-lg flex items-center">
                    <i data-lucide="file-spreadsheet" class="w-4 h-4 mr-2"></i> Exportar para CSV (Excel)
                </button>
            </div>
        </div>
    </div>`;
};


// O resto do arquivo ui.js continua o mesmo
// ...
export const createLancamentosTableRowsHTML = (lancamentos) => { /* ...código existente... */ };
export const createLancamentoDetailHTML = (lancamento) => { /* ...código existente... */ };
let confirmCallback = null;
export const showAlertModal = (title, message) => { /* ...código existente... */ };
export const showConfirmModal = (title, message, onConfirm) => { /* ...código existente... */ };
export const handleConfirm = () => { /* ...código existente... */ };
export const closeModal = (modalId) => { /* ...código existente... */ };
export function renderPaginationControls(currentPage, totalItems, totalPages, onPageChange) { /* ...código existente... */ }
let dashboardChart = null;
export function renderDashboardChart(lancamentos) { /* ...código existente... */ }
