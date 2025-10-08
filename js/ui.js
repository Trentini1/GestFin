import { formatCurrency, getGiroTotal } from './utils.js';

const DEFAULT_COMISSION_RATE = 0.5;

// --- Funções de criação de HTML ---

export const createDashboardHTML = (dashboardData, totalVariaveis, startDate, endDate) => {
    const faturamentoPeriodo = dashboardData
        .filter(l => l.faturado)
        .reduce((sum, l) => sum + getGiroTotal(l), 0);
        
    const comissoesPeriodo = dashboardData
        .filter(l => l.faturado)
        .reduce((sum, l) => sum + (l.comissao || 0), 0);

    const giroTotalPeriodo = dashboardData.reduce((sum, l) => sum + getGiroTotal(l), 0);
    const totalAReceber = comissoesPeriodo + totalVariaveis;

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
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="ml-4"><p class="text-sm text-slate-500">Giro Total</p><p data-value="${giroTotalPeriodo}" class="dashboard-value text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="ml-4"><p class="text-sm text-slate-500">Comissões Faturadas</p><p data-value="${comissoesPeriodo}" class="dashboard-value text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="ml-4"><p class="text-sm text-slate-500">Variáveis</p><p data-value="${totalVariaveis}" class="dashboard-value text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
            <div class="bg-green-100 border border-green-300 p-6 rounded-lg shadow"><div class="flex items-center"><div class="ml-4"><p class="text-sm font-bold text-green-800">Total a Receber</p><p data-value="${totalAReceber}" class="dashboard-value text-2xl font-bold text-green-900">${formatCurrency(0)}</p></div></div></div>
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
            <div id="sort-reset-container" class="hidden items-center"></div>
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
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            <button class="flex items-center gap-2 sort-btn" data-key="dataEmissao">Data Emissão <i data-lucide="arrow-down-up" class="h-4 w-4"></i></button>
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            <button class="flex items-center gap-2 sort-btn" data-key="cliente">Cliente <i data-lucide="arrow-down-up" class="h-4 w-4"></i></button>
                        </th>
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

export const createVariaveisViewHTML = () => {
    const today = new Date().toISOString().split('T')[0];
    return `
    <div class="space-y-6 max-w-4xl mx-auto">
        <h2 class="text-2xl font-bold">Gerenciar Variáveis</h2>
        <form id="addVariavelForm" class="bg-white p-6 rounded-lg shadow space-y-4">
            <h3 class="text-lg font-medium">Adicionar Nova Variável</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700">Data</label>
                    <input type="date" id="newVariavelData" value="${today}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">Nome</label>
                    <input type="text" id="newVariavelNome" required placeholder="Ex: VT, Ajuda Custo" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">Valor</label>
                    <input type="number" step="0.01" id="newVariavelValor" required placeholder="Ex: 300.50" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700">Descrição</label>
                <input type="text" id="newVariavelDescricao" placeholder="Opcional" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
            </div>
            <div class="flex justify-end">
                <button type="submit" class="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Salvar Variável</button>
            </div>
        </form>

        <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-lg font-medium mb-4">Histórico de Variáveis</h3>
            <div class="bg-white shadow overflow-x-auto sm:rounded-lg">
                <table class="min-w-full divide-y divide-slate-200">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Descrição</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valor</th>
                            <th class="relative px-6 py-3"><span class="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody id="variaveisTableBody" class="bg-white divide-y divide-slate-200">
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
};

export const createVariaveisTableRowsHTML = (variaveis) => {
    if (!variaveis.length) return '<tr><td colspan="5" class="text-center py-10 text-slate-500">Nenhuma variável encontrada.</td></tr>';
    return variaveis
        .sort((a,b) => b.data.toDate() - a.data.toDate())
        .map(v => `
        <tr class="hover:bg-slate-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${v.data.toDate().toLocaleDateString('pt-BR')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${v.nome}</td>
            <td class="px-6 py-4 text-sm text-slate-500">${v.descricao || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${formatCurrency(v.valor)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="text-red-600 hover:text-red-900 delete-variavel-btn" data-id="${v.firestoreId}">Excluir</button>
            </td>
        </tr>
    `).join('');
};

export const createNovoLancamentoFormHTML = () => `...`; // Omitido por brevidade, mas o conteúdo é o mesmo
export const createLancamentosTableRowsHTML = (lancamentos) => `...`; // Omitido por brevidade, mas o conteúdo é o mesmo
export const createLancamentoDetailHTML = (lancamento) => `...`; // Omitido por brevidade, mas o conteúdo é o mesmo
// ... E assim por diante para todas as outras funções que não foram alteradas ...
