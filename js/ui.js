// js/ui.js (COMPLETO E ATUALIZADO)

import { formatCurrency, getGiroTotal } from './utils.js';

const DEFAULT_COMISSION_RATE = 0.5;

// --- Funções de criação de HTML ---

export const createDashboardHTML = (dashboardData, totalVariaveis, startDate, endDate, userProfile) => {
    const faturamentoPeriodo = dashboardData.filter(l => l.faturado).reduce((sum, l) => sum + getGiroTotal(l), 0);
    const comissoesPeriodo = dashboardData.filter(l => l.faturado).reduce((sum, l) => sum + (l.comissao || 0), 0);
    const giroTotalPeriodo = dashboardData.reduce((sum, l) => sum + getGiroTotal(l), 0);
    const totalAReceber = comissoesPeriodo + totalVariaveis;
    const formatDateForInput = (date) => date.toISOString().split('T')[0];
    const showFinancials = userProfile.funcao !== 'padrao';

    return `
        <div class="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 class="text-2xl font-bold">Dashboard</h2>
            <div class="flex items-center gap-2 flex-wrap">
                <label for="dashboardStartDate" class="text-sm font-medium">De:</label>
                <input type="date" id="dashboardStartDate" value="${formatDateForInput(startDate)}" class="border-slate-300 rounded-md shadow-sm text-sm">
                <label for="dashboardEndDate" class="text-sm font-medium">Até:</label>
                <input type="date" id="dashboardEndDate" value="${formatDateForInput(endDate)}" class="border-slate-300 rounded-md shadow-sm text-sm">
                <button id="dashboardFilterBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">Filtrar</button>
                <button id="exportDashboardBtn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">Exportar CSV</button>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="ml-4"><p class="text-sm text-slate-500">Giro Total</p><p data-value="${giroTotalPeriodo}" class="dashboard-value text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
            ${showFinancials ? `
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="ml-4"><p class="text-sm text-slate-500">Comissões Faturadas</p><p data-value="${comissoesPeriodo}" class="dashboard-value text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
            <div class="bg-white p-6 rounded-lg shadow"><div class="flex items-center"><div class="ml-4"><p class="text-sm text-slate-500">Variáveis</p><p data-value="${totalVariaveis}" class="dashboard-value text-2xl font-bold">${formatCurrency(0)}</p></div></div></div>
            <div class="bg-green-100 border border-green-300 p-6 rounded-lg shadow"><div class="flex items-center"><div class="ml-4"><p class="text-sm font-bold text-green-800">Total a Receber</p><p data-value="${totalAReceber}" class="dashboard-value text-2xl font-bold text-green-900">${formatCurrency(0)}</p></div></div></div>
            ` : '<div class="hidden lg:block col-span-3"></div>'}
        </div>
        <div class="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div class="lg:col-span-3 bg-white p-6 rounded-lg shadow"><h3 class="text-lg font-medium mb-4">Faturamento (Últimos 6 Meses)</h3><div class="relative h-96"><canvas id="dashboardChart"></canvas></div></div>
            <div class="lg:col-span-2 bg-white p-6 rounded-lg shadow"><h3 class="text-lg font-medium mb-4">Valores Com NF vs Sem NF (no período)</h3><div class="relative h-96 flex items-center justify-center"><canvas id="nfPieChart"></canvas></div></div>
        </div>`;
};

export const createLancamentosListHTML = (userProfile) => {
    const isReadOnly = userProfile.funcao === 'leitura';
    return `
    <div class="space-y-6">
        ${!isReadOnly ? `
        <div class="flex space-x-4">
            <button id="toggleFormBtn" class="w-full flex justify-center items-center py-3 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:bg-slate-200 hover:border-slate-400 transition-colors"><i data-lucide="plus" class="w-5 h-5 mr-2"></i> Adicionar Lançamento Manual</button>
            <button id="analiseIaBtn" class="w-full flex justify-center items-center py-3 px-4 bg-indigo-100 text-indigo-700 border-2 border-dashed border-indigo-300 rounded-lg hover:bg-indigo-200 hover:border-indigo-400 transition-colors font-semibold"><i data-lucide="scan-line" class="w-5 h-5 mr-2"></i> Analisar NF com IA</button>
            <input type="file" id="nfUploadInput" class="hidden" accept="application/pdf" multiple>
        </div>
        <div id="formContainer" class="transition-all duration-500 ease-in-out overflow-hidden max-h-0"></div>
        ` : ''}
        <div class="relative"><i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"></i><input type="search" id="searchInput" placeholder="Buscar por cliente, NF ou O.S..." class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"></div>
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 class="text-2xl font-bold">Histórico de Lançamentos</h2><div id="sort-reset-container" class="hidden items-center"></div>
            <div class="flex items-center gap-4"><div class="flex items-center gap-2"><label for="monthFilter" class="text-sm font-medium">Mês:</label><select id="monthFilter" class="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></select></div><div class="flex items-center gap-2"><label for="yearFilter" class="text-sm font-medium">Ano:</label><select id="yearFilter" class="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></select></div>
            <button id="exportLancamentosBtn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">Exportar CSV</button></div>
        </div>
        <div class="bg-white shadow overflow-x-auto sm:rounded-lg">
            <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"><button class="flex items-center gap-2 sort-btn" data-key="dataEmissao">Data Emissão <i data-lucide="arrow-down-up" class="h-4 w-4"></i></button></th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"><button class="flex items-center gap-2 sort-btn" data-key="cliente">Cliente</button></th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"><button class="flex items-center gap-2 sort-btn" data-key="numeroNf">NF</button></th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"><button class="flex items-center gap-2 sort-btn" data-key="os">OS</button></th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"><button class="flex items-center gap-2 sort-btn" data-key="valorTotal">Valor</button></th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"><button class="flex items-center gap-2 sort-btn" data-key="comissao">Comissão</button></th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
                    </tr>
                </thead>
                <tbody id="lancamentosTableBody" class="bg-white divide-y divide-slate-200"></tbody>
            </table>
        </div>
        <div id="pagination-controls" class="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6"></div>
    `;
};

export const createNovoLancamentoFormHTML = () => `
    <form id="newLancamentoForm" class="bg-white shadow-md rounded-lg p-6 space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label for="newDataEmissao" class="block text-sm font-medium text-slate-700">Data de Emissão</label>
                <input type="date" id="newDataEmissao" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required>
            </div>
            <div>
                <label for="newCliente" class="block text-sm font-medium text-slate-700">Cliente</label>
                <input type="text" id="newCliente" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required>
            </div>
            <div>
                <label for="newNumeroNf" class="block text-sm font-medium text-slate-700">Número NF</label>
                <input type="text" id="newNumeroNf" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" placeholder="NT">
            </div>
            <div>
                <label for="newOs" class="block text-sm font-medium text-slate-700">OS</label>
                <input type="text" id="newOs" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
            </div>
            <div class="md:col-span-2">
                <label for="newDescricao" class="block text-sm font-medium text-slate-700">Descrição</label>
                <textarea id="newDescricao" rows="3" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></textarea>
            </div>
            <div>
                <label for="newValorTotal" class="block text-sm font-medium text-slate-700">Valor Total</label>
                <input type="number" step="0.01" id="newValorTotal" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required>
            </div>
            <div>
                <label for="newTaxaComissao" class="block text-sm font-medium text-slate-700">Taxa de Comissão (%)</label>
                <input type="number" step="0.01" id="newTaxaComissao" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" value="0.5">
            </div>
            <div class="md:col-span-2">
                <label class="block text-sm font-medium text-slate-700 mb-2">Impostos (%)</label>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label for="newImpostoIss" class="block text-xs text-slate-600">ISS</label>
                        <input type="number" step="0.01" id="newImpostoIss" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                    </div>
                    <div>
                        <label for="newImpostoPis" class="block text-xs text-slate-600">PIS</label>
                        <input type="number" step="0.01" id="newImpostoPis" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                    </div>
                    <div>
                        <label for="newImpostoCofins" class="block text-xs text-slate-600">COFINS</label>
                        <input type="number" step="0.01" id="newImpostoCofins" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                    </div>
                    <div>
                        <label for="newImpostoIcms" class="block text-xs text-slate-600">ICMS</label>
                        <input type="number" step="0.01" id="newImpostoIcms" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                    </div>
                </div>
            </div>
            <div class="md:col-span-2">
                <label class="block text-sm font-medium text-slate-700 mb-2">Pagamentos</label>
                <div id="pagamentos-list" class="space-y-3"></div>
                <button type="button" id="addPagamentoBtn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center">
                    <i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i> Adicionar Pagamento
                </button>
                <input type="hidden" id="hidden-pagamentos-data" name="pagamentos">
            </div>
            <div class="md:col-span-2">
                <label for="newObs" class="block text-sm font-medium text-slate-700">Observações</label>
                <textarea id="newObs" rows="3" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></textarea>
            </div>
        </div>
        <div class="flex justify-end gap-4">
            <button type="button" id="cancelFormBtn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Salvar</button>
        </div>
    </form>
`;

export const createLancamentosTableRowsHTML = (lancamentos) => lancamentos.map(l => {
    const dataEmissao = l.dataEmissao?.toDate().toLocaleDateString('pt-BR') || 'N/A';
    const status = l.faturado ? 'Faturado' : 'Pendente';
    return `
        <tr data-id="${l.firestoreId}">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${dataEmissao}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${l.cliente || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${l.numeroNf || 'NT'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${l.os || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${formatCurrency(l.valorTotal)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${formatCurrency(l.comissao)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${status === 'Faturado' ? 'text-green-600' : 'text-yellow-600'}">${status}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                <button class="view-btn text-indigo-600 hover:text-indigo-900 mr-2"><i data-lucide="eye" class="w-4 h-4"></i></button>
                <button class="edit-btn text-blue-600 hover:text-blue-900 mr-2"><i data-lucide="edit" class="w-4 h-4"></i></button>
                <button class="delete-btn text-red-600 hover:text-red-900"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `;
}).join('');

export const createLancamentoDetailHTML = (lancamento, userProfile) => {
    const isEditable = userProfile.funcao !== 'leitura';
    const dataEmissao = lancamento.dataEmissao?.toDate().toLocaleDateString('pt-BR') || 'N/A';
    const criadoEm = lancamento.criadoEm?.toDate().toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || 'N/A';
    const editadoEm = lancamento.editadoEm?.toDate().toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || 'N/A';
    const faturadoEm = lancamento.faturado?.toDate().toLocaleDateString('pt-BR') || 'Pendente';
    return `
        <div class="bg-white shadow-md rounded-lg p-6">
            <div class="flex justify-between items-start mb-6">
                <h2 class="text-2xl font-bold">Detalhes do Lançamento</h2>
                <div class="space-x-2">
                    ${isEditable ? `<button id="editLancamentoBtn" class="text-blue-600 hover:text-blue-900"><i data-lucide="edit" class="w-5 h-5"></i></button>
                    <button id="deleteLancamentoBtn" class="text-red-600 hover:text-red-900"><i data-lucide="trash-2" class="w-5 h-5"></i></button>` : ''}
                    <button id="backToListBtn" class="text-slate-600 hover:text-slate-900"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <p class="text-sm text-slate-500">Data de Emissão</p>
                    <p class="text-lg font-medium">${dataEmissao}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Cliente</p>
                    <p class="text-lg font-medium">${lancamento.cliente || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Número NF</p>
                    <p class="text-lg font-medium">${lancamento.numeroNf || 'NT'}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">OS</p>
                    <p class="text-lg font-medium">${lancamento.os || 'N/A'}</p>
                </div>
                <div class="md:col-span-2">
                    <p class="text-sm text-slate-500">Descrição</p>
                    <p class="text-lg">${lancamento.descricao || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Valor Total</p>
                    <p class="text-lg font-medium">${formatCurrency(lancamento.valorTotal)}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Taxa de Comissão</p>
                    <p class="text-lg font-medium">${lancamento.taxaComissao}%</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Comissão</p>
                    <p class="text-lg font-medium">${formatCurrency(lancamento.comissao)}</p>
                </div>
                <div class="md:col-span-2">
                    <p class="text-sm text-slate-500 mb-2">Impostos</p>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p class="text-xs text-slate-600">ISS</p>
                            <p>${lancamento.impostos?.iss || 0}%</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-600">PIS</p>
                            <p>${lancamento.impostos?.pis || 0}%</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-600">COFINS</p>
                            <p>${lancamento.impostos?.cofins || 0}%</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-600">ICMS</p>
                            <p>${lancamento.impostos?.icms || 0}%</p>
                        </div>
                    </div>
                </div>
                <div class="md:col-span-2">
                    <div class="flex justify-between items-center mb-2">
                        <p class="text-sm text-slate-500">Pagamentos</p>
                        ${isEditable ? `<button id="editPagamentosBtn" class="text-sm text-indigo-600 hover:text-indigo-800">Editar</button>` : ''}
                    </div>
                    <div id="pagamentos-detail-list" class="space-y-2">
                        ${(lancamento.pagamentos || []).map(p => `
                            <div class="flex justify-between text-sm">
                                <span>${p.metodo}${p.parcelas ? ` (${p.parcelas}x)` : ''}</span>
                                <span>${formatCurrency(p.valor)}</span>
                            </div>
                        `).join('') || '<p class="text-sm text-slate-500">Nenhum pagamento registrado</p>'}
                    </div>
                </div>
                <div class="md:col-span-2">
                    <p class="text-sm text-slate-500">Observações</p>
                    <p class="text-lg">${lancamento.obs || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Criado por</p>
                    <p>${lancamento.criadoPor} em ${criadoEm}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Editado por</p>
                    <p>${lancamento.editadoPor || 'N/A'} em ${editadoEm}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Status Faturamento</p>
                    <p class="${lancamento.faturado ? 'text-green-600' : 'text-yellow-600'}">${faturadoEm}</p>
                </div>
            </div>
        </div>
    `;
};

export const createVariaveisViewHTML = () => `
    <div class="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 class="text-2xl font-bold">Variáveis</h2>
        <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
                <label for="variaveisMonthFilter" class="text-sm font-medium">Mês:</label>
                <select id="variaveisMonthFilter" class="rounded-md border-slate-300 shadow-sm"></select>
            </div>
            <div class="flex items-center gap-2">
                <label for="variaveisYearFilter" class="text-sm font-medium">Ano:</label>
                <select id="variaveisYearFilter" class="rounded-md border-slate-300 shadow-sm"></select>
            </div>
        </div>
    </div>
    <div class="bg-white shadow overflow-x-auto sm:rounded-lg">
        <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Data</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Descrição</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Valor</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
            </thead>
            <tbody id="variaveisTableBody" class="bg-white divide-y divide-slate-200"></tbody>
        </table>
    </div>
    <div id="variaveisPagination" class="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6"></div>
`;

export const createVariaveisTableRowsHTML = (variaveis) => variaveis.map(v => {
    const data = v.data?.toDate().toLocaleDateString('pt-BR') || 'N/A';
    return `
        <tr data-id="${v.firestoreId}">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${data}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${v.descricao || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${formatCurrency(v.valor)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                <button class="edit-variavel-btn text-blue-600 hover:text-blue-900 mr-2"><i data-lucide="edit" class="w-4 h-4"></i></button>
                <button class="delete-variavel-btn text-red-600 hover:text-red-900"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `;
}).join('');

export const createClientesViewHTML = () => `
    <h2 class="text-2xl font-bold mb-6">Clientes</h2>
    <div class="bg-white shadow overflow-x-auto sm:rounded-lg">
        <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nome</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Telefone</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
            </thead>
            <tbody id="clientesTableBody" class="bg-white divide-y divide-slate-200"></tbody>
        </table>
    </div>
`;

export const createClientesTableRowsHTML = (clientes) => clientes.map(c => `
    <tr data-id="${c.firestoreId}">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${c.nome || 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${c.email || 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${c.telefone || 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
            <button class="view-cliente-btn text-indigo-600 hover:text-indigo-900 mr-2"><i data-lucide="eye" class="w-4 h-4"></i></button>
            <button class="edit-cliente-btn text-blue-600 hover:text-blue-900 mr-2"><i data-lucide="edit" class="w-4 h-4"></i></button>
            <button class="delete-cliente-btn text-red-600 hover:text-red-900"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
    </tr>
`).join('');

export const createClienteDetailHTML = (cliente) => `
    <div class="bg-white shadow-md rounded-lg p-6">
        <div class="flex justify-between items-start mb-6">
            <h2 class="text-2xl font-bold">${cliente.nome || 'Cliente'}</h2>
            <div class="space-x-2">
                <button id="editClienteBtn" class="text-blue-600 hover:text-blue-900"><i data-lucide="edit" class="w-5 h-5"></i></button>
                <button id="deleteClienteBtn" class="text-red-600 hover:text-red-900"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                <button id="backToClientesBtn" class="text-slate-600 hover:text-slate-900"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <p class="text-sm text-slate-500">Email</p>
                <p class="text-lg">${cliente.email || 'N/A'}</p>
            </div>
            <div>
                <p class="text-sm text-slate-500">Telefone</p>
                <p class="text-lg">${cliente.telefone || 'N/A'}</p>
            </div>
            <div class="md:col-span-2">
                <p class="text-sm text-slate-500">Endereço</p>
                <p class="text-lg">${cliente.endereco || 'N/A'}</p>
            </div>
            <div class="md:col-span-2">
                <p class="text-sm text-slate-500">Observações</p>
                <p class="text-lg">${cliente.obs || 'N/A'}</p>
            </div>
        </div>
    </div>
`;

export const createNotasFiscaisViewHTML = () => `
    <div class="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 class="text-2xl font-bold">Notas Fiscais de Compra</h2>
        <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
                <label for="nfMonthFilter" class="text-sm font-medium">Mês:</label>
                <select id="nfMonthFilter" class="rounded-md border-slate-300 shadow-sm"></select>
            </div>
            <div class="flex items-center gap-2">
                <label for="nfYearFilter" class="text-sm font-medium">Ano:</label>
                <select id="nfYearFilter" class="rounded-md border-slate-300 shadow-sm"></select>
            </div>
            <button id="addNotaCompraBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">Adicionar Nota</button>
        </div>
    </div>
    <div class="relative mb-4">
        <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"></i>
        <input type="search" id="nfSearchInput" placeholder="Buscar por NF, OS ou Comprador..." class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
    </div>
    <div class="bg-white shadow overflow-x-auto sm:rounded-lg">
        <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Data</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Número NF</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">OS ID</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Comprador</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Total</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
            </thead>
            <tbody id="notasCompraTableBody" class="bg-white divide-y divide-slate-200"></tbody>
        </table>
    </div>
    <div id="nfPagination" class="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6"></div>
`;

export const createNotasCompraTableRowsHTML = (notas) => notas.map(n => {
    const data = n.dataEmissao?.toDate().toLocaleDateString('pt-BR') || 'N/A';
    return `
        <tr data-id="${n.firestoreId}">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${data}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${n.numeroNf || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${n.osId || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${n.comprador || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${formatCurrency(n.valorTotal)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                <button class="view-nota-btn text-indigo-600 hover:text-indigo-900 mr-2"><i data-lucide="eye" class="w-4 h-4"></i></button>
                <button class="edit-nota-btn text-blue-600 hover:text-blue-900 mr-2"><i data-lucide="edit" class="w-4 h-4"></i></button>
                <button class="delete-nota-btn text-red-600 hover:text-red-900"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `;
}).join('');

export const createNotaCompraDetailHTML = (nota) => {
    const data = nota.dataEmissao?.toDate().toLocaleDateString('pt-BR') || 'N/A';
    return `
        <div class="bg-white shadow-md rounded-lg p-6">
            <div class="flex justify-between items-start mb-6">
                <h2 class="text-2xl font-bold">Detalhes da Nota de Compra</h2>
                <div class="space-x-2">
                    <button id="editNotaCompraBtn" class="text-blue-600 hover:text-blue-900"><i data-lucide="edit" class="w-5 h-5"></i></button>
                    <button id="deleteNotaCompraBtn" class="text-red-600 hover:text-red-900"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                    <button id="backToNotasBtn" class="text-slate-600 hover:text-slate-900"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <p class="text-sm text-slate-500">Data de Emissão</p>
                    <p class="text-lg font-medium">${data}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Número NF</p>
                    <p class="text-lg font-medium">${nota.numeroNf || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Chave de Acesso</p>
                    <p class="text-lg font-medium">${nota.chaveAcesso || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">OS ID</p>
                    <p class="text-lg font-medium">${nota.osId || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Comprador</p>
                    <p class="text-lg font-medium">${nota.comprador || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">Valor Total</p>
                    <p class="text-lg font-medium">${formatCurrency(nota.valorTotal)}</p>
                </div>
                <div class="md:col-span-2">
                    <p class="text-sm text-slate-500 mb-2">Itens</p>
                    <div class="space-y-2">
                        ${(nota.itens || []).map(i => `
                            <div class="flex justify-between text-sm">
                                <span>${i.descricao} (${i.quantidade}x)</span>
                                <span>${formatCurrency(i.valor * i.quantidade)}</span>
                            </div>
                        `).join('') || '<p class="text-sm text-slate-500">Nenhum item</p>'}
                    </div>
                </div>
                <div class="md:col-span-2">
                    <div class="flex justify-between items-center mb-2">
                        <p class="text-sm text-slate-500">Pagamentos</p>
                        <button id="editPagamentosCompraBtn" class="text-sm text-indigo-600 hover:text-indigo-800">Editar</button>
                    </div>
                    <div id="pagamentos-compra-detail-list" class="space-y-2">
                        ${(nota.pagamentos || []).map(p => `
                            <div class="flex justify-between text-sm">
                                <span>${p.metodo}${p.parcelas ? ` (${p.parcelas}x)` : ''}</span>
                                <span>${formatCurrency(p.valor)}</span>
                            </div>
                        `).join('') || '<p class="text-sm text-slate-500">Nenhum pagamento registrado</p>'}
                    </div>
                </div>
            </div>
        </div>
    `;
};

export const createPagamentoRowHTML = (data, index) => {
    const isParcelable = data.metodo === 'Cartão de Crédito' || data.metodo === 'Boleto';
    const row = document.createElement('div');
    row.className = 'pagamento-row grid grid-cols-12 gap-2 items-center mb-2';
    row.dataset.index = index;

    const metodoSelect = document.createElement('select');
    metodoSelect.className = 'pagamento-metodo col-span-4 mt-1 block w-full rounded-md border-slate-300 shadow-sm';
    const options = ['PIX', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto', 'Cheque'];
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt; // Escapando com textContent
        option.selected = data.metodo === opt;
        metodoSelect.appendChild(option);
    });
    row.appendChild(metodoSelect);

    const valorInput = document.createElement('input');
    valorInput.type = 'number';
    valorInput.step = '0.01';
    valorInput.placeholder = 'Valor';
    valorInput.className = 'pagamento-valor mt-1 block w-full rounded-md border-slate-300 shadow-sm col-span-4';
    valorInput.value = data.valor || '';
    valorInput.required = true;
    row.appendChild(valorInput);

    const parcelasInput = document.createElement('input');
    parcelasInput.type = 'number';
    parcelasInput.placeholder = 'Parcelas';
    parcelasInput.className = `pagamento-parcelas mt-1 block w-full rounded-md border-slate-300 shadow-sm col-span-2 ${isParcelable ? '' : 'hidden'}`;
    parcelasInput.value = data.parcelas || 1;
    row.appendChild(parcelasInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-pagamento-btn text-red-500 hover:text-red-700 col-span-1 text-right';
    const icon = document.createElement('i');
    icon.dataset.lucide = 'trash-2';
    icon.className = 'w-4 h-4';
    removeBtn.appendChild(icon);
    row.appendChild(removeBtn);

    return row.outerHTML;
};

// --- Funções de Modal e Componentes ---
let confirmCallback = null;
export const showAlertModal = (title, message) => {
    const modal = document.getElementById('alertModal');
    if(!modal) return;
    modal.querySelector('#alertModalTitle').textContent = title;
    modal.querySelector('#alertModalMessage').innerHTML = message; // Permitir HTML para loader
    modal.style.display = 'flex';
};
export const showConfirmModal = (title, message, onConfirm) => {
    const modal = document.getElementById('confirmModal');
    if(!modal) return;
    modal.querySelector('#confirmModalTitle').textContent = title;
    modal.querySelector('#confirmModalMessage').textContent = message;
    confirmCallback = onConfirm;
    modal.style.display = 'flex';
};
export const handleConfirm = () => {
    if (confirmCallback) confirmCallback();
    closeModal('confirmModal');
    confirmCallback = null; 
};
export const closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if(modal) modal.style.display = 'none';
};

export function renderPaginationControls(currentPage, totalItems, totalPages, onPageChange) {
    const container = document.getElementById('pagination-controls');
    if (!container) return;
    const itemsPerPage = 15;
    if (totalItems <= itemsPerPage) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<div><p class="text-sm text-gray-700">Mostrando <span class="font-medium">${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span> a <span class="font-medium">${Math.min(currentPage * itemsPerPage, totalItems)}</span> de <span class="font-medium">${totalItems}</span> resultados</p></div><div><nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"><button id="prev-page" class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Anterior</button><button id="next-page" class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Próximo</button></nav></div>`;
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
        comissaoData.push(faturadosNoMes.reduce((sum, l) => sum + (l.comissao || 0), 0));
    }
    if (dashboardChart) dashboardChart.destroy();
    dashboardChart = new Chart(chartCtx, { type: 'bar', data: { labels, datasets: [{ label: 'Faturamento', data: faturamentoData, backgroundColor: 'rgba(79, 70, 229, 0.8)' }, { label: 'Comissão', data: comissaoData, backgroundColor: 'rgba(251, 191, 36, 0.8)' }] }, options: { scales: { y: { beginAtZero: true, ticks: { callback: value => 'R$ ' + value.toLocaleString('pt-BR') } } }, responsive: true, maintainAspectRatio: false } });
}

let nfPieChart = null;
export function renderNfPieChart(lancamentosNoPeriodo) {
    const ctx = document.getElementById('nfPieChart')?.getContext('2d');
    if (!ctx) return;
    const valorComNf = lancamentosNoPeriodo.filter(l => l.numeroNf && l.numeroNf.toUpperCase() !== 'NT').reduce((sum, l) => sum + getGiroTotal(l), 0);
    const valorSemNf = lancamentosNoPeriodo.filter(l => !l.numeroNf || l.numeroNf.toUpperCase() === 'NT').reduce((sum, l) => sum + getGiroTotal(l), 0);
    const data = { labels: ['Com NF', 'Sem NF (NT)'], datasets: [{ data: [valorComNf, valorSemNf], backgroundColor: ['rgba(79, 70, 229, 0.8)', 'rgba(203, 213, 225, 0.8)'], borderColor: '#FFFFFF', borderWidth: 2 }] };
    if (nfPieChart) nfPieChart.destroy();
    nfPieChart = new Chart(ctx, { type: 'doughnut', data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: context => `${context.label || ''}: ${formatCurrency(context.parsed)}` } } } } });
}
