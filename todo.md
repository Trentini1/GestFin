# GestFin PRO - Lista de Tarefas

## Estrutura e Configuração
- [x] Criar schema do banco de dados completo
- [x] Configurar integração com Firebase (manter credenciais existentes)
- [x] Configurar tema e estilos globais

## Autenticação e Usuários
- [ ] Sistema de login com Firebase Auth
- [ ] Gestão de perfis de usuário (admin, padrão, leitura)
- [ ] Controle de acesso baseado em roles
- [ ] Logout e proteção de rotas

## Dashboard
- [x] Cards com métricas principais (Giro Total, Comissões, Variáveis, Total a Receber)
- [ ] Gráfico de faturamento dos últimos 6 meses
- [ ] Gráfico pizza: Valores com NF vs sem NF
- [x] Filtros de data personalizados
- [x] Animações de contagem nos cards
- [x] Atualização em tempo real dos dados

## Lançamentos Financeiros
- [x] Listagem de lançamentos com paginação
- [x] Formulário de novo lançamento manual
- [ ] Upload e análise de NF com IA (Gemini)
- [ ] Detalhes do lançamento com custos associados
- [x] Edição de lançamentos existentes
- [x] Exclusão de lançamentos
- [ ] Gestão de formas de pagamento
- [x] Busca e filtros (cliente, NF, OS, mês, ano)
- [ ] Ordenação por colunas
- [x] Marcação de faturamento
- [x] Cálculo automático de comissões

## Notas Fiscais
- [x] Listagem de notas fiscais de compra
- [ ] Upload de PDFs de notas fiscais
- [ ] Análise automática com IA
- [x] Associação com OS/PC
- [x] Edição de notas fiscais
- [x] Exclusão de notas fiscais
- [x] Busca e filtros
- [x] Visualização de detalhes

## Clientes
- [x] Listagem de clientes
- [x] Cadastro de novos clientes
- [x] Edição de clientes
- [x] Exclusão de clientes
- [ ] Visualização de histórico por cliente
- [ ] Autocomplete no formulário de lançamentos

## Variáveis
- [x] Listagem de variáveis financeiras
- [x] Cadastro de novas variáveis
- [x] Edição de variáveis
- [x] Exclusão de variáveis
- [x] Filtros por mês e ano
- [x] Cálculo de totais

## Relatórios e Exportação
- [ ] Exportação para PDF/Impressão
- [ ] Exportação para CSV/Excel
- [ ] Backup completo em JSON
- [ ] Restauração de backup
- [ ] Relatórios personalizados por período

## Interface e UX
- [x] Design responsivo para mobile
- [x] Animações suaves de transição
- [x] Loading states e skeletons
- [x] Modais de confirmação
- [x] Toasts de feedback
- [x] Tema moderno com gradientes
- [x] Ícones Lucide
- [x] Navegação intuitiva
- [ ] Breadcrumbs
- [x] Estados vazios informativos

## Funcionalidades Avançadas
- [ ] Listeners em tempo real do Firestore
- [ ] Validação de formulários
- [ ] Tratamento de erros
- [ ] Otimização de performance
- [ ] Cache de dados
- [ ] Lazy loading de componentes
- [ ] Debounce em buscas
- [ ] Confirmações antes de ações destrutivas

## Testes
- [ ] Testar autenticação
- [ ] Testar CRUD de lançamentos
- [ ] Testar CRUD de notas fiscais
- [ ] Testar CRUD de clientes
- [ ] Testar CRUD de variáveis
- [ ] Testar dashboard e gráficos
- [ ] Testar exportações
- [ ] Testar backup/restauração
- [ ] Testar responsividade
- [ ] Testar integração com IA
