import { eq, desc, and, gte, lte, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  clientes, Cliente, InsertCliente,
  lancamentos, Lancamento, InsertLancamento,
  notasCompra, NotaCompra, InsertNotaCompra,
  variaveis, Variavel, InsertVariavel
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== USUÁRIOS =====

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserGestfinRole(userId: number, gestfinRole: "admin" | "padrao" | "leitura") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({ gestfinRole }).where(eq(users.id, userId));
}

// ===== CLIENTES =====

export async function getAllClientes(userId: number): Promise<Cliente[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(clientes).where(eq(clientes.userId, userId)).orderBy(desc(clientes.createdAt));
}

export async function getClienteById(id: number): Promise<Cliente | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);
  return result[0];
}

export async function createCliente(data: InsertCliente): Promise<Cliente> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(clientes).values(data);
  const insertId = (result as any)[0]?.insertId || (result as any).insertId;
  if (!insertId) throw new Error("Failed to get insert ID");
  const created = await getClienteById(Number(insertId));
  if (!created) throw new Error("Failed to create cliente");
  return created;
}

export async function updateCliente(id: number, data: Partial<InsertCliente>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(clientes).set(data).where(eq(clientes.id, id));
}

export async function deleteCliente(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(clientes).where(eq(clientes.id, id));
}

// ===== LANÇAMENTOS =====

export async function getAllLancamentos(userId: number): Promise<Lancamento[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(lancamentos).where(eq(lancamentos.userId, userId)).orderBy(desc(lancamentos.dataEmissao));
}

export async function getLancamentoById(id: number): Promise<Lancamento | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(lancamentos).where(eq(lancamentos.id, id)).limit(1);
  return result[0];
}

export async function createLancamento(data: InsertLancamento): Promise<Lancamento> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Calcular comissão
  const taxaComissao = data.taxaComissao ?? 50; // Default 0.5%
  const comissao = Math.round((data.valorTotal * taxaComissao) / 10000);
  
  const result = await db.insert(lancamentos).values({
    ...data,
    comissao
  });
  
  const insertId = (result as any)[0]?.insertId || (result as any).insertId;
  if (!insertId) throw new Error("Failed to get insert ID");
  const created = await getLancamentoById(Number(insertId));
  if (!created) throw new Error("Failed to create lancamento");
  return created;
}

export async function updateLancamento(id: number, data: Partial<InsertLancamento>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Recalcular comissão se necessário
  if (data.valorTotal !== undefined || data.taxaComissao !== undefined) {
    const current = await getLancamentoById(id);
    if (current) {
      const valorTotal = data.valorTotal ?? current.valorTotal;
      const taxaComissao = data.taxaComissao ?? current.taxaComissao;
      data.comissao = Math.round((valorTotal * taxaComissao) / 10000);
    }
  }

  await db.update(lancamentos).set(data).where(eq(lancamentos.id, id));
}

export async function deleteLancamento(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(lancamentos).where(eq(lancamentos.id, id));
}

export async function toggleLancamentoFaturado(id: number, faturado: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(lancamentos).set({ 
    faturado,
    dataFaturamento: faturado ? new Date() : null
  }).where(eq(lancamentos.id, id));
}

// ===== NOTAS DE COMPRA =====

export async function getAllNotasCompra(userId: number): Promise<NotaCompra[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(notasCompra).where(eq(notasCompra.userId, userId)).orderBy(desc(notasCompra.dataEmissao));
}

export async function getNotaCompraById(id: number): Promise<NotaCompra | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(notasCompra).where(eq(notasCompra.id, id)).limit(1);
  return result[0];
}

export async function getNotasCompraByOS(osId: string, userId: number): Promise<NotaCompra[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(notasCompra).where(
    and(eq(notasCompra.osId, osId), eq(notasCompra.userId, userId))
  );
}

export async function createNotaCompra(data: InsertNotaCompra): Promise<NotaCompra> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(notasCompra).values(data);
  const insertId = (result as any)[0]?.insertId || (result as any).insertId;
  if (!insertId) throw new Error("Failed to get insert ID");
  const created = await getNotaCompraById(Number(insertId));
  if (!created) throw new Error("Failed to create nota compra");
  return created;
}

export async function updateNotaCompra(id: number, data: Partial<InsertNotaCompra>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(notasCompra).set(data).where(eq(notasCompra.id, id));
}

export async function deleteNotaCompra(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(notasCompra).where(eq(notasCompra.id, id));
}

// ===== VARIÁVEIS =====

export async function getAllVariaveis(userId: number): Promise<Variavel[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(variaveis).where(eq(variaveis.userId, userId)).orderBy(desc(variaveis.data));
}

export async function getVariavelById(id: number): Promise<Variavel | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(variaveis).where(eq(variaveis.id, id)).limit(1);
  return result[0];
}

export async function createVariavel(data: InsertVariavel): Promise<Variavel> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(variaveis).values(data);
  const insertId = (result as any)[0]?.insertId || (result as any).insertId;
  if (!insertId) throw new Error("Failed to get insert ID");
  const created = await getVariavelById(Number(insertId));
  if (!created) throw new Error("Failed to create variavel");
  return created;
}

export async function updateVariavel(id: number, data: Partial<InsertVariavel>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(variaveis).set(data).where(eq(variaveis.id, id));
}

export async function deleteVariavel(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(variaveis).where(eq(variaveis.id, id));
}

// ===== ESTATÍSTICAS =====

export async function getDashboardStats(userId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;

  const lancamentosData = await db.select().from(lancamentos).where(
    and(
      eq(lancamentos.userId, userId),
      gte(lancamentos.dataEmissao, startDate),
      lte(lancamentos.dataEmissao, endDate)
    )
  );

  const variaveisData = await db.select().from(variaveis).where(
    and(
      eq(variaveis.userId, userId),
      gte(variaveis.data, startDate),
      lte(variaveis.data, endDate)
    )
  );

  const giroTotal = lancamentosData.reduce((sum, l) => sum + l.valorTotal, 0);
  const comissoesTotal = lancamentosData.filter(l => l.faturado).reduce((sum, l) => sum + l.comissao, 0);
  const variaveisTotal = variaveisData.reduce((sum, v) => {
    return sum + (v.tipo === 'credito' ? v.valor : -v.valor);
  }, 0);
  const totalAReceber = comissoesTotal + variaveisTotal;

  return {
    giroTotal,
    comissoesTotal,
    variaveisTotal,
    totalAReceber,
    lancamentosCount: lancamentosData.length,
    variaveisCount: variaveisData.length
  };
}
