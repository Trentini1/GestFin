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
            <div class="flex items-center gap-4"><div class="flex items-center gap-2"><label for="monthFilter" class="text-sm font-medium">Mês:</label><select id="monthFilter" class="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></select></div><div class="flex items-center gap-2"><label for="yearFilter" class="text-sm font-medium">Ano:</label><select id="yearFilter" class="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></select></div></div>
        </div>
        <div class="bg-white shadow overflow-x-auto sm:rounded-lg">
            <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"><button class="flex items-center gap-2 sort-btn" data-key="dataEmissao">Data Emissão <i data-lucide="arrow-down-up" class="h-4 w-4"></i></button></th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"><button class="flex items-center gap-2 sort-btn" data-key="cliente">Cliente <i data-lucide="arrow-down-up" class="h-4 w-4"></i></button></th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">NF</th><th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">O.S/PC</th><th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Giro Total</th>
                        ${userProfile.funcao !== 'padrao' ? `<th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Comissão</th>` : ''}
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
                <button id="exportPdfBtn" class="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg flex items-center"><i data-lucide="printer" class="w-4 h-4 mr-2"></i> Imprimir / Salvar PDF</button>
                <button id="exportCsvBtn" class="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-4 rounded-lg flex items-center"><i data-lucide="file-spreadsheet" class="w-4 h-4 mr-2"></i> Exportar para CSV (Excel)</button>
            </div>
        </div>
        ${!isReadOnly ? `
        <div class="mt-8 bg-white p-6 rounded-lg shadow">
            <h3 class="text-lg font-medium mb-4">Backup e Restauração</h3>
            <p class="text-sm text-slate-500 mb-4">Salve todos os seus dados ou restaure a partir de um backup.</p>
            <div class="flex space-x-4">
                <button id="backupBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center"><i data-lucide="download" class="w-4 h-4 mr-2"></i> Fazer Backup (JSON)</button>
                <button id="restoreBtn" class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg flex items-center"><i data-lucide="upload" class="w-4 h-4 mr-2"></i> Restaurar Backup</button>
                <input type="file" id="restoreInput" class="hidden" accept=".json">
            </div>
        </div>
        ` : ''}
    </div>`;
};

export const createNovoLancamentoFormHTML = (userProfile) => {
    const showFinancials = userProfile.funcao !== 'padrao';
    return `
      <form id="novoLancamentoForm" class="p-6 bg-slate-100 border-t-2 border-b-2 border-slate-200 space-y-4">
        <h3 class="text-xl font-semibold text-slate-800">Novo Lançamento Manual</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
                <label for="newDataEmissao" class="block text-sm font-medium text-slate-700">Data de Emissão</label>
                <input type="date" id="newDataEmissao" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required>
            </div>
            <div>
                <label for="newCliente" class="block text-sm font-medium text-slate-700">Cliente</label>
                <input list="client-list" id="newCliente" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required>
                <datalist id="client-list"></datalist>
            </div>
            <div>
                <label for="newNumeroNf" class="block text-sm font-medium text-slate-700">Número NF</label>
                <input type="text" id="newNumeroNf" placeholder="NT se não houver" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
            </div>
            <div>
                <label for="newOs" class="block text-sm font-medium text-slate-700">OS / PC</label>
                <input type="text" id="newOs" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2">
                <label for="newDescricao" class="block text-sm font-medium text-slate-700">Motor / Descrição do Serviço</label>
                <input type="text" id="newDescricao" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
            </div>
            <div>
                <label for="newValorTotal" class="block text-sm font-medium text-slate-700">Valor Total</label>
                <input type="number" step="0.01" id="newValorTotal" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div class="md:col-span-2">
                <label for="newObs" class="block text-sm font-medium text-slate-700">Observação</label>
                <textarea id="newObs" rows="2" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></textarea>
            </div>
            ${showFinancials ? `
            <div>
                <label for="newTaxaComissao" class="block text-sm font-medium text-slate-700">Taxa de Comissão (%)</label>
                <input type="number" step="0.01" id="newTaxaComissao" value="${DEFAULT_COMISSION_RATE}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm" required>
            </div>
            ` : ''}
        </div>
        <div class="pt-4 border-t">
            <h4 class="text-md font-medium text-slate-700">Impostos sobre a Venda (se houver)</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div><label class="block text-sm font-medium text-slate-700">ISS (%)</label><input type="number" step="0.01" id="newImpostoIss" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                <div><label class="block text-sm font-medium text-slate-700">PIS (%)</label><input type="number" step="0.01" id="newImpostoPis" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                <div><label class="block text-sm font-medium text-slate-700">COFINS (%)</label><input type="number" step="0.01" id="newImpostoCofins" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                <div><label class="block text-sm font-medium text-slate-700">ICMS (%)</label><input type="number" step="0.01" id="newImpostoIcms" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
            </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t">
          <button type="button" id="cancelNewLancamento" class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancelar</button>
          <button type="submit" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Salvar Lançamento</button>
        </div>
      </form>
    `;
};

export const createLancamentosTableRowsHTML = (lancamentos, userProfile) => {
    const isReadOnly = userProfile.funcao === 'leitura';
    const colspan = userProfile.funcao === 'padrao' ? 7 : 8;
    if (!lancamentos.length) return `<tr><td colspan="${colspan}" class="text-center py-10 text-slate-500">Nenhum lançamento encontrado para os filtros selecionados.</td></tr>`;
    
    return lancamentos.map(l => `
        <tr class="hover:bg-slate-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${l.dataEmissao?.toDate().toLocaleDateString('pt-BR')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${l.cliente}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${l.numeroNf || 'NT'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${l.os || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${formatCurrency(getGiroTotal(l))}</td>
            ${userProfile.funcao !== 'padrao' ? `<td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${formatCurrency(l.comissao)}</td>` : ''}
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500"><div class="flex items-center"><button data-id="${l.firestoreId}" class="faturado-toggle relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${l.faturado ? 'bg-green-500' : 'bg-gray-200'}" ${isReadOnly ? 'disabled' : 'cursor-pointer'}><span class="inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${l.faturado ? 'translate-x-6' : 'translate-x-1'}"></span></button><span class="ml-2">${l.faturado ? l.faturado.toDate().toLocaleDateString('pt-BR') : 'Pendente'}</span></div></td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button class="text-indigo-600 hover:text-indigo-900 view-details" data-id="${l.firestoreId}">${isReadOnly ? 'Ver Detalhes' : 'Editar'}</button></td>
        </tr>`).join('');
};

export const createLancamentoDetailHTML = (data, userProfile) => {
    const { lancamento, custosDaOs } = data;
    const isReadOnly = userProfile.funcao === 'leitura';
    const valorTotal = getGiroTotal(lancamento);
    const totalCustos = custosDaOs.reduce((sum, nota) => sum + nota.valorTotal, 0);
    const impostos = lancamento.impostos || {};
    const valorIss = valorTotal * ((impostos.iss || 0) / 100);
    const valorPis = valorTotal * ((impostos.pis || 0) / 100);
    const valorCofins = valorTotal * ((impostos.cofins || 0) / 100);
    const valorIcms = valorTotal * ((impostos.icms || 0) / 100);
    const totalImpostos = valorIss + valorPis + valorCofins + valorIcms;
     const pagamentosHTML = (lancamento.pagamentos || []).map(p => `
        <li class="flex justify-between items-center text-sm">
            <span>${p.metodo}${p.parcelas > 1 ? ` (${p.parcelas}x)` : ''}</span>
            <span class="font-medium">${formatCurrency(p.valor)}</span>
        </li>
    `).join('');

    return `
    <button class="back-to-list flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-6"><i data-lucide="arrow-left" class="w-4 h-4 mr-2"></i> Voltar para a lista</button>
    <form id="editLancamentoForm" data-id="${lancamento.firestoreId}" class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto space-y-6">
        <h2 class="text-2xl font-bold">${isReadOnly ? 'Detalhes do Lançamento' : 'Editar Lançamento'}</h2>
        <fieldset ${isReadOnly ? 'disabled' : ''}>
            {...} // Formulário de edição sem alterações na estrutura, o JS preencherá os pagamentos

            <div class="pt-4 border-t">
                <h4 class="text-md font-medium text-slate-700 mb-2">Formas de Pagamento</h4>
                <div id="pagamentos-container" class="space-y-2">
                    </div>
                ${!isReadOnly ? `
                <button type="button" id="addPagamentoBtn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center">
                    <i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i> Adicionar Pagamento
                </button>
                ` : ''}
            </div>
            </fieldset>
        ${!isReadOnly ? `
        <div class="flex justify-end pt-4 border-t">
            <button type="button" id="deleteLancamentoBtn" class="text-red-600 hover:underline mr-auto">Excluir Lançamento</button>
            <button type="submit" class="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Salvar Alterações</button>
        </div>
        ` : ''}
    </form>
    
    <div class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto mt-8">
        <h3 class="text-xl font-bold mb-4">Resumo Financeiro</h3>
        <div class="mb-6">
            <h4 class="font-semibold text-slate-800 mb-2">Pagamentos Recebidos</h4>
            <ul class="space-y-1 text-slate-600">
                ${pagamentosHTML || '<li>Nenhuma forma de pagamento registrada.</li>'}
            </ul>
        </div>

        <h4 class="font-semibold text-slate-800 mb-2">Análise da O.S.</h4>
        ${custosDaOs.length > 0 ? `<div class="space-y-4">${custosDaOs.map(nota => `...`).join('')}</div>` : `<p class="text-slate-500">Nenhuma nota fiscal de compra foi vinculada a esta O.S. ainda.</p>`}
        <div class="mt-6 pt-4 border-t-2 space-y-2">
            {...} // Resto da análise financeira
        </div>
    </div>
    `;
};
    const resultadoFinal = valorTotal - totalCustos - totalImpostos;

    return `
    <button class="back-to-list flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-6"><i data-lucide="arrow-left" class="w-4 h-4 mr-2"></i> Voltar para a lista</button>
    <form id="editLancamentoForm" data-id="${lancamento.firestoreId}" class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto space-y-6">
        <h2 class="text-2xl font-bold">${isReadOnly ? 'Detalhes do Lançamento' : 'Editar Lançamento'}</h2>
        <fieldset ${isReadOnly ? 'disabled' : ''}>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div><label class="block text-sm font-medium text-slate-700">Data Emissão</label><input type="date" id="editDataEmissao" value="${lancamento.dataEmissao.toDate().toISOString().split('T')[0]}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
                <div><label class="block text-sm font-medium text-slate-700">Cliente</label><input type="text" id="editCliente" value="${lancamento.cliente}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
                <div><label class="block text-sm font-medium text-slate-700">Nº NF</label><input type="text" id="editNumeroNf" value="${lancamento.numeroNf || ''}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
                <div><label class="block text-sm font-medium text-slate-700">O.S/PC</label><input type="text" id="editOs" value="${lancamento.os || ''}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700">Motor</label><input type="text" id="editDescricao" value="${lancamento.descricao || ''}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
                <div><label class="block text-sm font-medium text-slate-700">Valor Total</label><input type="number" step="0.01" id="editValorTotal" value="${valorTotal}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700">Observação</label><textarea id="editObs" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100">${lancamento.obs || ''}</textarea></div>
                ${userProfile.funcao !== 'padrao' ? `
                <div><label class="block text-sm font-medium text-slate-700">Taxa de Comissão (%)</label><input type="number" step="0.01" id="editTaxaComissao" value="${lancamento.taxaComissao || DEFAULT_COMISSION_RATE}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
                ` : ''}
            </div>
            <div class="pt-4 border-t">
                <h4 class="text-md font-medium">Impostos sobre a Venda/Serviço</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                    <div><label class="block text-sm font-medium text-slate-700">ISS (%)</label><input type="number" step="0.01" id="editImpostoIss" value="${impostos.iss || ''}" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
                    <div><label class="block text-sm font-medium text-slate-700">PIS (%)</label><input type="number" step="0.01" id="editImpostoPis" value="${impostos.pis || ''}" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
                    <div><label class="block text-sm font-medium text-slate-700">COFINS (%)</label><input type="number" step="0.01" id="editImpostoCofins" value="${impostos.cofins || ''}" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
                    <div><label class="block text-sm font-medium text-slate-700">ICMS (%)</label><input type="number" step="0.01" id="editImpostoIcms" value="${impostos.icms || ''}" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100"></div>
                </div>
            </div>
        </fieldset>
        ${!isReadOnly ? `
        <div class="flex justify-end pt-4 border-t">
            <button type="button" id="deleteLancamentoBtn" class="text-red-600 hover:underline mr-auto">Excluir Lançamento</button>
            <button type="submit" class="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Salvar Alterações</button>
        </div>
        ` : ''}
    </form>
    <div class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto mt-8">
        <h3 class="text-xl font-bold mb-4">Análise Financeira da O.S.</h3>
        ${custosDaOs.length > 0 ? `<div class="space-y-4">${custosDaOs.map(nota => `<div class="border p-4 rounded-md bg-slate-50"><p class="font-semibold">NF de Compra: ${nota.numeroNf} <span class="font-normal text-slate-500">- ${nota.dataEmissao.toDate().toLocaleDateString('pt-BR')}</span></p><ul class="list-disc list-inside mt-2 text-sm text-slate-600">${nota.itens.map(item => `<li>${item.quantidade || 1}x ${item.descricao}: <span class="font-medium">${formatCurrency(item.valor * (item.quantidade || 1))}</span></li>`).join('')}</ul></div>`).join('')}</div>` : `<p class="text-slate-500">Nenhuma nota fiscal de compra foi vinculada a esta O.S. ainda.</p>`}
        <div class="mt-6 pt-4 border-t-2 space-y-2">
            <div class="flex justify-between items-center text-lg"><span class="font-medium text-slate-600">Total de Custos:</span><span class="font-bold text-red-600">${formatCurrency(totalCustos)}</span></div>
            <div class="flex justify-between items-center text-lg"><span class="font-medium text-slate-600">Total de Impostos:</span><span class="font-bold text-orange-600">${formatCurrency(totalImpostos)}</span></div>
            <div class="flex justify-between items-center text-xl mt-2"><span class="font-bold text-slate-800">Resultado Final:</span><span class="font-extrabold ${resultadoFinal >= 0 ? 'text-green-700' : 'text-red-700'}">${formatCurrency(resultadoFinal)}</span></div>
        </div>
    </div>`;
};

export const createVariaveisViewHTML = (userProfile) => {
    const isNotAdmin = userProfile.funcao !== 'admin';
    return `
    <div class="space-y-6 max-w-4xl mx-auto">
        <h2 class="text-2xl font-bold">Gerenciar Variáveis</h2>
        <form id="addVariavelForm" class="bg-white p-6 rounded-lg shadow space-y-4" ${isNotAdmin ? 'hidden' : ''}>
            <h3 class="text-lg font-medium">Adicionar Nova Variável</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700">Data</label>
                    <input type="date" id="newVariavelData" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">Descrição</label>
                    <input type="text" id="newVariavelDescricao" required placeholder="Ex: Reembolso de viagem" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">Valor (R$)</label>
                    <input type="number" step="0.01" id="newVariavelValor" required placeholder="150.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
            </div>
            <div class="flex justify-end">
                <button type="submit" class="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Salvar Variável</button>
            </div>
        </form>

        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 class="text-lg font-medium">Histórico de Variáveis</h3>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <label for="variaveisMonthFilter" class="text-sm font-medium">Mês:</label>
                    <select id="variaveisMonthFilter" class="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></select>
                </div>
                <div class="flex items-center gap-2">
                    <label for="variaveisYearFilter" class="text-sm font-medium">Ano:</label>
                    <select id="variaveisYearFilter" class="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></select>
                </div>
            </div>
        </div>

        <div class="bg-white shadow overflow-x-auto sm:rounded-lg">
            <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Descrição</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valor</th>
                        <th class="relative px-6 py-3"><span class="sr-only">Ações</span></th>
                    </tr>
                </thead>
                <tbody id="variaveisTableBody"></tbody>
            </table>
        </div>
    </div>`;
};

export const createVariaveisTableRowsHTML = (variaveis, userProfile) => {
    const isNotAdmin = userProfile.funcao !== 'admin';
    if (!variaveis.length) return '<tr><td colspan="4" class="text-center py-10 text-slate-500">Nenhuma variável encontrada para os filtros.</td></tr>';
    
    return variaveis.map(v => `
        <tr class="hover:bg-slate-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${v.data.toDate().toLocaleDateString('pt-BR')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${v.descricao}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${formatCurrency(v.valor)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="text-red-600 hover:text-red-900 delete-variavel-btn" data-id="${v.firestoreId}" ${isNotAdmin ? 'hidden' : ''}>Excluir</button>
            </td>
        </tr>`).join('');
};

export const createClientesViewHTML = () => `
    <div class="space-y-6 max-w-4xl mx-auto">
        <h2 class="text-2xl font-bold">Gerenciar Clientes</h2>
        <form id="addClienteForm" class="bg-white p-6 rounded-lg shadow space-y-4">
            <h3 class="text-lg font-medium">Adicionar Novo Cliente</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700">Nome / Razão Social</label>
                    <input type="text" id="newClienteNome" required placeholder="Nome completo do cliente" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">CNPJ / CPF</label>
                    <input type="text" id="newClienteCnpj" placeholder="00.000.000/0000-00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700">Endereço</label>
                <input type="text" id="newClienteEndereco" placeholder="Rua, Nº, Bairro, Cidade - Estado" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700">Telefone</label>
                    <input type="tel" id="newClienteTelefone" placeholder="(41) 99999-9999" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">E-mail</label>
                    <input type="email" id="newClienteEmail" placeholder="contato@cliente.com" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
            </div>
            <div class="flex justify-end">
                <button type="submit" class="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Salvar Cliente</button>
            </div>
        </form>
        <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-lg font-medium mb-4">Clientes Cadastrados</h3>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-200">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">CNPJ/CPF</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Telefone</th>
                            <th class="relative px-6 py-3"><span class="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody id="clientesTableBody"></tbody>
                </table>
            </div>
        </div>
    </div>`;

export const createClientesTableRowsHTML = (clientes) => {
    if (!clientes.length) return '<tr><td colspan="4" class="text-center py-10 text-slate-500">Nenhum cliente cadastrado.</td></tr>';
    return clientes.sort((a,b) => a.nome.localeCompare(b.nome)).map(c => `
        <tr class="hover:bg-slate-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${c.nome}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${c.cnpj || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${c.telefone || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                <button class="text-indigo-600 hover:text-indigo-900 edit-cliente-btn" data-id="${c.firestoreId}">Editar</button>
                <button class="text-red-600 hover:text-red-900 delete-cliente-btn" data-id="${c.firestoreId}">Excluir</button>
            </td>
        </tr>`).join('');
};

export const createClienteDetailHTML = (cliente) => `
    <button class="back-to-list-clientes flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-6"><i data-lucide="arrow-left" class="w-4 h-4 mr-2"></i> Voltar para a lista de clientes</button>
    <form id="editClienteForm" data-id="${cliente.firestoreId}" class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto space-y-6">
        <h2 class="text-2xl font-bold">Editar Cliente</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-slate-700">Nome / Razão Social</label>
                <input type="text" id="editClienteNome" value="${cliente.nome || ''}" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700">CNPJ / CPF</label>
                <input type="text" id="editClienteCnpj" value="${cliente.cnpj || ''}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
            </div>
        </div>
        <div>
            <label class="block text-sm font-medium text-slate-700">Endereço</label>
            <input type="text" id="editClienteEndereco" value="${cliente.endereco || ''}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-slate-700">Telefone</label>
                <input type="tel" id="editClienteTelefone" value="${cliente.telefone || ''}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700">E-mail</label>
                <input type="email" id="editClienteEmail" value="${cliente.email || ''}" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
            </div>
        </div>
        <div class="flex justify-end pt-4 border-t">
            <button type="submit" class="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Salvar Alterações</button>
        </div>
    </form>
`;

export const createNotasFiscaisViewHTML = (lancamentos) => {
    const osList = [...new Set(lancamentos.map(l => l.os).filter(Boolean))];
    return `
    <div class="space-y-6 max-w-6xl mx-auto">
        <h2 class="text-2xl font-bold">Gerenciar Notas Fiscais de Compra</h2>
        <form id="addNotaCompraForm" class="bg-white p-6 rounded-lg shadow space-y-4">
            <h3 class="text-lg font-medium">Adicionar Nova NF de Compra</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700">O.S. Vinculada</label>
                    <input type="text" id="newNotaOsId" required list="os-list" placeholder="Nº da O.S." class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                    <datalist id="os-list">
                        ${osList.map(os => `<option value="${os}"></option>`).join('')}
                    </datalist>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">Nº da NF</label>
                    <input type="text" id="newNotaNumeroNf" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">Data Emissão</label>
                    <input type="date" id="newNotaData" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
                 <div>
                    <label class="block text-sm font-medium text-slate-700">Chave de Acesso (Opcional)</label>
                    <input type="text" id="newNotaChaveAcesso" placeholder="44 dígitos" maxlength="44" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm">
                </div>
            </div>
            <div class="pt-4 border-t">
                <h4 class="text-md font-medium">Impostos sobre a Compra (Crédito/Custo)</h4>
                <p class="text-xs text-slate-500 mb-2">Preencha os valores em Reais (R$) informados na nota.</p>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><label class="block text-sm font-medium text-slate-700">ICMS (R$)</label><input type="number" step="0.01" id="newCompraImpostoIcms" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">IPI (R$)</label><input type="number" step="0.01" id="newCompraImpostoIpi" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">PIS (R$)</label><input type="number" step="0.01" id="newCompraImpostoPis" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                    <div><label class="block text-sm font-medium text-slate-700">COFINS (R$)</label><input type="number" step="0.01" id="newCompraImpostoCofins" placeholder="0.00" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
                </div>
            </div>
            <div class="pt-4 border-t">
                <h4 class="text-md font-medium mb-2">Itens da Nota</h4>
                <div class="grid grid-cols-12 gap-x-2 gap-y-1 text-sm font-medium text-slate-600 px-1">
                    <div class="col-span-6">Descrição do item</div>
                    <div class="col-span-2">Qtd.</div>
                    <div class="col-span-3">Valor Unit.</div>
                </div>
                <div id="itens-container" class="space-y-2"></div>
                <button type="button" id="addItemBtn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center">
                    <i data-lucide="plus-circle" class="w-4 h-4 mr-1"></i> Adicionar Item
                </button>
            </div>
            <div class="flex justify-end pt-4 border-t">
                <button type="submit" class="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Salvar Nota Fiscal</button>
            </div>
        </form>
        
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 class="text-lg font-medium">Histórico de Notas de Compra</h3>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <label for="nfMonthFilter" class="text-sm font-medium">Mês:</label>
                    <select id="nfMonthFilter" class="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></select>
                </div>
                <div class="flex items-center gap-2">
                    <label for="nfYearFilter" class="text-sm font-medium">Ano:</label>
                    <select id="nfYearFilter" class="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></select>
                </div>
            </div>
        </div>

        <div class="bg-white shadow overflow-x-auto sm:rounded-lg">
            <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nº NF</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">O.S. Vinculada</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valor Total</th>
                        <th class="relative px-6 py-3"><span class="sr-only">Ações</span></th>
                    </tr>
                </thead>
                <tbody id="notasCompraTableBody"></tbody>
            </table>
        </div>
    </div>`;
};

export const createNotasCompraTableRowsHTML = (notas, lancamentos) => {
    if (!notas.length) return '<tr><td colspan="5" class="text-center py-10 text-slate-500">Nenhuma nota fiscal de compra encontrada para os filtros.</td></tr>';
    
    return notas.map(n => {
        const lancamentoCorrespondente = lancamentos.find(l => l.os === n.osId);
        const lancamentoId = lancamentoCorrespondente ? lancamentoCorrespondente.firestoreId : null;

        return `
        <tr class="hover:bg-slate-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${n.dataEmissao.toDate().toLocaleDateString('pt-BR')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${n.numeroNf}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${lancamentoId ? `
                    <button class="link-to-os text-indigo-600 hover:underline font-medium" data-lancamento-id="${lancamentoId}">
                        ${n.osId}
                    </button>
                ` : `
                    <span class="text-slate-500" title="Não foi possível encontrar um lançamento com este número de O.S.">${n.osId}</span> 
                `}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${formatCurrency(n.valorTotal)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="text-red-600 hover:text-red-900 delete-notacompra-btn" data-id="${n.firestoreId}">Excluir</button>
            </td>
        </tr>`
    }).join('');
};

// --- Funções de Modal e Componentes ---
let confirmCallback = null;
export const showAlertModal = (title, message) => {
    const modal = document.getElementById('alertModal');
    if(!modal) return;
    modal.querySelector('#alertModalTitle').textContent = title;
    modal.querySelector('#alertModalMessage').textContent = message;
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
