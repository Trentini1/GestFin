import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Perfil específico do GestFin: admin, padrao, leitura
  gestfinRole: mysqlEnum("gestfinRole", ["admin", "padrao", "leitura"]).default("padrao").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clientes - Empresas/pessoas que recebem serviços
 */
export const clientes = mysqlTable("clientes", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 18 }),
  email: varchar("email", { length: 320 }),
  telefone: varchar("telefone", { length: 20 }),
  endereco: text("endereco"),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  userId: int("userId").notNull(), // Quem criou o cliente
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

/**
 * Lançamentos Financeiros - Notas fiscais de serviço emitidas
 */
export const lancamentos = mysqlTable("lancamentos", {
  id: int("id").autoincrement().primaryKey(),
  dataEmissao: timestamp("dataEmissao").notNull(),
  cliente: varchar("cliente", { length: 255 }).notNull(),
  clienteId: int("clienteId"), // Referência ao cliente
  numeroNf: varchar("numeroNf", { length: 100 }),
  os: varchar("os", { length: 100 }), // Ordem de Serviço ou Pedido de Compra
  descricao: text("descricao"), // Motor/Descrição do serviço
  valorTotal: int("valorTotal").notNull(), // Valor em centavos
  taxaComissao: int("taxaComissao").notNull().default(50), // Taxa em centésimos (0.5% = 50)
  comissao: int("comissao").notNull().default(0), // Valor calculado em centavos
  faturado: boolean("faturado").default(false).notNull(),
  dataFaturamento: timestamp("dataFaturamento"),
  observacoes: text("observacoes"),
  pagamentos: text("pagamentos"), // JSON com array de pagamentos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  userId: int("userId").notNull(), // Quem criou o lançamento
});

export type Lancamento = typeof lancamentos.$inferSelect;
export type InsertLancamento = typeof lancamentos.$inferInsert;

/**
 * Notas Fiscais de Compra - Custos associados a OS
 */
export const notasCompra = mysqlTable("notasCompra", {
  id: int("id").autoincrement().primaryKey(),
  dataEmissao: timestamp("dataEmissao").notNull(),
  fornecedor: varchar("fornecedor", { length: 255 }).notNull(),
  numeroNf: varchar("numeroNf", { length: 100 }),
  osId: varchar("osId", { length: 100 }), // OS associada
  valorTotal: int("valorTotal").notNull(), // Valor em centavos
  descricao: text("descricao"),
  observacoes: text("observacoes"),
  pdfUrl: text("pdfUrl"), // URL do PDF no storage
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  userId: int("userId").notNull(),
});

export type NotaCompra = typeof notasCompra.$inferSelect;
export type InsertNotaCompra = typeof notasCompra.$inferInsert;

/**
 * Variáveis Financeiras - Outros valores a receber
 */
export const variaveis = mysqlTable("variaveis", {
  id: int("id").autoincrement().primaryKey(),
  data: timestamp("data").notNull(),
  descricao: varchar("descricao", { length: 255 }).notNull(),
  valor: int("valor").notNull(), // Valor em centavos
  tipo: mysqlEnum("tipo", ["credito", "debito"]).default("credito").notNull(),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  userId: int("userId").notNull(),
});

export type Variavel = typeof variaveis.$inferSelect;
export type InsertVariavel = typeof variaveis.$inferInsert;

/**
 * Configurações do Firebase - Armazena credenciais
 */
export const firebaseConfig = mysqlTable("firebaseConfig", {
  id: int("id").autoincrement().primaryKey(),
  apiKey: varchar("apiKey", { length: 255 }).notNull(),
  authDomain: varchar("authDomain", { length: 255 }).notNull(),
  projectId: varchar("projectId", { length: 255 }).notNull(),
  storageBucket: varchar("storageBucket", { length: 255 }).notNull(),
  messagingSenderId: varchar("messagingSenderId", { length: 255 }).notNull(),
  appId: varchar("appId", { length: 255 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FirebaseConfig = typeof firebaseConfig.$inferSelect;
export type InsertFirebaseConfig = typeof firebaseConfig.$inferInsert;
