import { formatCurrency, getGiroTotal } from './utils.js';

const DEFAULT_COMISSION_RATE = 0.5; // Corrigido para 0,5%

// --- Funções de criação de HTML ---

export const createDashboardHTML = (lancamentos) => {
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

// ESTA FUNÇÃO ESTAVA FALTANDO O EXPORT
export const createNovoLancamentoFormHTML = () => `
    <form id="novoLancamentoForm" class="bg-white p-6 rounded-lg shadow space-y-4">
        <h3 class="text-lg font-medium">Novo Lançamento</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div><label class="block text-sm font-medium text-slate-700">Data Emissão</label><input type="date" id="newDataEmissao" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
            <div><label class="block text-sm font-medium text-slate-700">Cliente</label><input type="text" id="newCliente" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" list="client-list"></div>
            <div><label class="block text-sm font-medium text-slate-700">Nº NF</label><input type="text" id="newNumeroNf" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
            <div><label class="block text-sm font-medium text-slate-700">O.S/PC</label><input type="text" id="newOs" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700">Motor</label><input type="text" id="newDescricao" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
            <div><label class="block text-sm font-medium text-slate-700">Valor Total</label><input type="number" step="0.01" id="newValorTotal" value="0" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700">Observação</label><textarea id="newObs" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></textarea></div>
            <div><label class="block text-sm font-medium text-slate-700">Taxa de Comissão (%)</label><input type="number" step="0.01" id="newTaxaComissao" value="${DEFAULT_COMISSION_RATE}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
        </div>
        <div class="flex justify-end pt-4 border-t">
            <button type="button" id="cancelNewLancamento" class="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="submit" class="ml-3 inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Salvar Lançamento</button>
        </div>
    </form>
    <datalist id="client-list"></datalist>`;

export const createLancamentosTableRowsHTML = (lancamentos) => {
    if (!lancamentos.length) return '<tr><td colspan="8" class="text-center py-10 text-slate-500">Nenhum lançamento encontrado.</td></tr>';
    return lancamentos.map(l => {
        const giroTotal = getGiroTotal(l);
        return `
        <tr class="hover:bg-slate-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${l.dataEmissao?.toDate().toLocaleDateString('pt-BR')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${l.cliente}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${l.numeroNf}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${l.os || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${formatCurrency(giroTotal)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${formatCurrency(l.comissao)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                <div class="flex items-center">
                    <button data-id="${l.firestoreId}" class="faturado-toggle cursor-pointer relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${l.faturado ? 'bg-green-500' : 'bg-gray-200'}">
                        <span class="inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${l.faturado ? 'translate-x-6' : 'translate-x-1'}"></span>
                    </button>
                    <span class="ml-2">${l.faturado ? l.faturado.toDate().toLocaleDateString('pt-BR') : 'Pendente'}</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button class="text-indigo-600 hover:text-indigo-900 view-details" data-id="${l.firestoreId}">Editar</button></td>
        </tr>`;
    }).join('');
};

export const createLancamentoDetailHTML = (lancamento) => {
    const valorTotal = getGiroTotal(lancamento);
    return `
    <button class="back-to-list flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-6"><i data-lucide="arrow-left" class="w-4 h-4 mr-2"></i> Voltar para a lista</button>
    <form id="editLancamentoForm" data-id="${lancamento.firestoreId}" class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto space-y-6">
        <h2 class="text-2xl font-bold">Editar Lançamento</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label class="block text-sm font-medium text-slate-700">Data Emissão</label><input type="date" id="editDataEmissao" value="${lancamento.dataEmissao.toDate().toISOString().split('T')[0]}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
            <div><label class="block text-sm font-medium text-slate-700">Cliente</label><input type="text" id="editCliente" value="${lancamento.cliente}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
            <div><label class="block text-sm font-medium text-slate-700">Nº NF</label><input type="text" id="editNumeroNf" value="${lancamento.numeroNf}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
            <div><label class="block text-sm font-medium text-slate-700">O.S/PC</label><input type="text" id="editOs" value="${lancamento.os || ''}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700">Motor</label><input type="text" id="editDescricao" value="${lancamento.descricao}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
            <div><label class="block text-sm font-medium text-slate-700">Valor Total</label><input type="number" step="0.01" id="editValorTotal" value="${valorTotal}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700">Observação</label><textarea id="editObs" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">${lancamento.obs || ''}</textarea></div>
            <div><label class="block text-sm font-medium text-slate-700">Taxa de Comissão (%)</label><input type="number" step="0.01" id="editTaxaComissao" value="${lancamento.taxaComissao || DEFAULT_COMISSION_RATE}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></div>
        </div>
        <div class="flex justify-end pt-4 border-t">
            <button type="button" id="deleteLancamentoBtn" class="text-red-600 hover:underline mr-auto">Excluir Lançamento</button>
            <button type="submit" class="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Salvar Alterações</button>
        </div>
    </form>`;
};


// --- Funções de Renderização e Modais ---

let confirmCallback = null;
export const showAlertModal = (title, message) => {
    document.getElementById('alertModalTitle').textContent = title;
    document.getElementById('alertModalMessage').textContent = message;
    document.getElementById('alertModal').style.display = 'flex';
};

export const showConfirmModal = (title, message, onConfirm) => {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
    confirmCallback = onConfirm;
    document.getElementById('confirmModal').style.display = 'flex';
};

export const handleConfirm = () => {
    if (confirmCallback) confirmCallback();
    document.getElementById('confirmModal').style.display = 'none';
};

export const closeModal = (modalId) => {
    document.getElementById(modalId).style.display = 'none';
};

export function renderPaginationControls(currentPage, totalItems, totalPages, onPageChange) {
    const container = document.getElementById('pagination-controls');
    if (!container) return;

    const itemsPerPage = 15;
    container.innerHTML = `
        <div>
            <p class="text-sm text-gray-700">
                Mostrando
                <span class="font-medium">${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span>
                a
                <span class="font-medium">${Math.min(currentPage * itemsPerPage, totalItems)}</span>
                de
                <span class="font-medium">${totalItems}</span>
                resultados
            </p>
        </div>
        <div>
            <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button id="prev-page" class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                    Anterior
                </button>
                <button id="next-page" class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                    Próximo
                </button>
            </nav>
        </div>
    `;
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages || totalItems === 0;

    prevButton.onclick = () => onPageChange('prev');
    nextButton.onclick = () => onPageChange('next');
}


let dashboardChart = null;
export function renderDashboardChart(lancamentos) {
    const chartCtx = document.getElementById('dashboardChart')?.getContext('2d');
    if (!chartCtx) return;

    const labels = [];
    const faturamentoData = [];
    const comissaoData = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString('pt-BR', { month: 'short' });
        const year = date.getFullYear();
        labels.push(`${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`);
        
        const faturadosNoMes = lancamentos.filter(l => {
            const faturadoDate = l.faturado?.toDate();
            return faturadoDate && faturadoDate.getMonth() === date.getMonth() && faturadoDate.getFullYear() === year;
        });

        faturamentoData.push(faturadosNoMes.reduce((sum, l) => sum + getGiroTotal(l), 0));
        comissaoData.push(faturadosNoMes.reduce((sum, l) => sum + l.comissao, 0));
    }

    if (dashboardChart) {
        dashboardChart.destroy();
    }

    dashboardChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Faturamento',
                    data: faturamentoData,
                    backgroundColor: 'rgba(79, 70, 229, 0.8)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Comissão',
                    data: comissaoData,
                    backgroundColor: 'rgba(251, 191, 36, 0.8)',
                    borderColor: 'rgba(251, 191, 36, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}
