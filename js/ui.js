import { formatCurrency, getGiroTotal } from './utils.js';

const DEFAULT_COMISSION_RATE = 0.5;

// --- Funções de criação de HTML ---

export const createDashboardHTML = (dashboardData, startDate, endDate) => {
    // A lógica de cálculo agora usa os dados já filtrados pela data
    const faturamentoPeriodo = dashboardData
        .filter(l => l.faturado)
        .reduce((sum, l) => sum + getGiroTotal(l), 0);
        
    const comissoesPeriodo = dashboardData
        .filter(l => l.faturado)
        .reduce((sum, l) => sum + (l.comissao || 0), 0);

    const giroTotalPeriodo = dashboardData.reduce((sum, l) => sum + getGiroTotal(l), 0);

    // Formata as datas para preencher os inputs
    const formatDateForInput = (date) => date.toISOString().split('T')[0];

    return `
        <div class="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 class="text-2xl font-bold">Dashboard</h2>
            <div class="flex items-center gap-2 flex-wrap">
                <label for="dashboardStartDate" class="text-sm font-medium">De:</label>
                <input type="date" id="dashboardStartDate" value="${formatDateForInput(startDate)}" class="border-slate-300 rounded-md shadow-sm text-sm">
                <label for="dashboardEndDate" class="text-sm font-medium">Até:</label>
                <input type="date" id="dashboardEndDate" value="${formatDateForInput(endDate)}" class="border-slate-300 rounded-md shadow-sm text-sm">
                <button id="dashboardFilterBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">Filtrar</button>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="bg-blue-100 p-3 rounded-full"><i data-lucide="trending-up" class="w-6 h-6 text-blue-600"></i></div><div class="ml-4"><p class="text-sm text-slate-500">Giro Total no Período</p><p id="giro-total-mes" data-value="${giroTotalPeriodo}" class="text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="bg-green-100 p-3 rounded-full"><i data-lucide="dollar-sign" class="w-6 h-6 text-green-600"></i></div><div class="ml-4"><p class="text-sm text-slate-500">Faturamento no Período</p><p id="faturamento-mes" data-value="${faturamentoPeriodo}" class="text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="bg-yellow-100 p-3 rounded-full"><i data-lucide="percent" class="w-6 h-6 text-yellow-600"></i></div><div class="ml-4"><p class="text-sm text-slate-500">Comissões no Período</p><p id="comissoes-mes" data-value="${comissoesPeriodo}" class="text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
        </div>
        <div class="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div class="lg:col-span-3 bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-medium mb-4">Faturamento (Últimos 6 Meses)</h3>
                <div class="relative h-96">
                    <canvas id="dashboardChart"></canvas>
                </div>
            </div>
            <div class="lg:col-span-2 bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-medium mb-4">Valores Com NF vs Sem NF (no período)</h3>
                <div class="relative h-96 flex items-center justify-center">
                    <canvas id="nfPieChart"></canvas>
                </div>
            </div>
        </div>`;
};

export const createLancamentosListHTML = () => {
    return `
    <div class="space-y-6">
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

        <div class="mt-8 bg-white p-6 rounded-lg shadow">
            <h3 class="text-lg font-medium mb-4">Backup e Restauração</h3>
            <p class="text-sm text-slate-500 mb-4">Salve todos os seus dados em um arquivo JSON ou restaure a partir de um backup anterior.</p>
            <div class="flex space-x-4">
                <button id="backupBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center">
                    <i data-lucide="download" class="w-4 h-4 mr-2"></i> Fazer Backup (JSON)
                </button>
                <button id="restoreBtn" class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg flex items-center">
                    <i data-lucide="upload" class="w-4 h-4 mr-2"></i> Restaurar Backup
                </button>
                <input type="file" id="restoreInput" class="hidden" accept=".json">
            </div>
        </div>
    </div>`;
};

// ... (O restante do arquivo `ui.js` permanece o mesmo, você pode colar este novo `createLancamentosListHTML` no seu arquivo existente ou substituir tudo para garantir)

// (Aqui está o resto do arquivo para garantir)
export const createNovoLancamentoFormHTML = () => { /* ...código da função... */ };
export const createLancamentosTableRowsHTML = (lancamentos) => { /* ...código da função... */ };
export const createLancamentoDetailHTML = (lancamento) => { /* ...código da função... */ };
let confirmCallback = null;
export const showAlertModal = (title, message) => { /* ...código da função... */ };
export const showConfirmModal = (title, message, onConfirm) => { /* ...código da função... */ };
export const handleConfirm = () => { /* ...código da função... */ };
export const closeModal = (modalId) => { /* ...código da função... */ };
export function renderPaginationControls(currentPage, totalItems, totalPages, onPageChange) { /* ...código da função... */ }
let dashboardChart = null;
export function renderDashboardChart(lancamentos) { /* ...código da função... */ }

// ALTERADO: Gráfico agora mostra VALORES e tem tooltips formatados
let nfPieChart = null;
export function renderNfPieChart(lancamentosNoPeriodo) {
    const ctx = document.getElementById('nfPieChart')?.getContext('2d');
    if (!ctx) return;

    const valorComNf = lancamentosNoPeriodo
        .filter(l => l.numeroNf && l.numeroNf.toUpperCase() !== 'NT')
        .reduce((sum, l) => sum + getGiroTotal(l), 0);
        
    const valorSemNf = lancamentosNoPeriodo
        .filter(l => !l.numeroNf || l.numeroNf.toUpperCase() === 'NT')
        .reduce((sum, l) => sum + getGiroTotal(l), 0);

    const data = {
        labels: ['Com NF', 'Sem NF (NT)'],
        datasets: [{
            data: [valorComNf, valorSemNf],
            backgroundColor: ['rgba(79, 70, 229, 0.8)', 'rgba(203, 213, 225, 0.8)'],
            borderColor: ['#FFFFFF'],
            borderWidth: 2
        }]
    };

    if (nfPieChart) {
        nfPieChart.destroy();
    }

    nfPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += formatCurrency(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}
