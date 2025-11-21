import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    gestfinRole: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("GestFin Routers", () => {
  describe("auth", () => {
    it("should return current user from me endpoint", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeDefined();
      expect(result?.email).toBe("test@example.com");
      expect(result?.name).toBe("Test User");
    });

    it("should logout successfully", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
    });
  });

  describe("clientes", () => {
    it("should create a new cliente", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const clienteData = {
        nome: "Empresa Teste LTDA",
        cnpj: "12.345.678/0001-90",
        email: "contato@empresateste.com",
        telefone: "(11) 98765-4321",
      };

      const result = await caller.clientes.create(clienteData);

      expect(result).toBeDefined();
      expect(result.nome).toBe(clienteData.nome);
      expect(result.cnpj).toBe(clienteData.cnpj);
      expect(result.userId).toBe(ctx.user.id);
    });

    it("should list all clientes for user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.clientes.list();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("lancamentos", () => {
    it("should create a new lancamento with calculated commission", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const lancamentoData = {
        dataEmissao: new Date(),
        cliente: "Cliente Teste",
        numeroNf: "12345",
        os: "OS-001",
        descricao: "Serviço de teste",
        valorTotal: 100000, // R$ 1.000,00 em centavos
        taxaComissao: 50, // 0.5%
      };

      const result = await caller.lancamentos.create(lancamentoData);

      expect(result).toBeDefined();
      expect(result.cliente).toBe(lancamentoData.cliente);
      expect(result.valorTotal).toBe(lancamentoData.valorTotal);
      expect(result.comissao).toBe(500); // 0.5% de 1000 = 5 reais = 500 centavos
      expect(result.userId).toBe(ctx.user.id);
    });

    it("should toggle faturado status", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Primeiro criar um lançamento
      const lancamento = await caller.lancamentos.create({
        dataEmissao: new Date(),
        cliente: "Cliente Teste",
        valorTotal: 100000,
        taxaComissao: 50,
      });

      // Marcar como faturado
      const result = await caller.lancamentos.toggleFaturado({
        id: lancamento.id,
        faturado: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("dashboard", () => {
    it("should return dashboard stats for date range", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const startDate = new Date();
      startDate.setDate(1); // Primeiro dia do mês
      const endDate = new Date();

      const result = await caller.dashboard.stats({
        startDate,
        endDate,
      });

      expect(result).toBeDefined();
      expect(typeof result.giroTotal).toBe("number");
      expect(typeof result.comissoesTotal).toBe("number");
      expect(typeof result.variaveisTotal).toBe("number");
      expect(typeof result.totalAReceber).toBe("number");
    });
  });

  describe("variaveis", () => {
    it("should create a new variavel", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const variavelData = {
        data: new Date(),
        descricao: "Bônus mensal",
        valor: 50000, // R$ 500,00 em centavos
        tipo: "credito" as const,
      };

      const result = await caller.variaveis.create(variavelData);

      expect(result).toBeDefined();
      expect(result.descricao).toBe(variavelData.descricao);
      expect(result.valor).toBe(variavelData.valor);
      expect(result.tipo).toBe("credito");
      expect(result.userId).toBe(ctx.user.id);
    });
  });

  describe("notasCompra", () => {
    it("should create a new nota de compra", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const notaData = {
        dataEmissao: new Date(),
        fornecedor: "Fornecedor Teste",
        numeroNf: "NF-12345",
        osId: "OS-001",
        valorTotal: 25000, // R$ 250,00 em centavos
        descricao: "Compra de material",
      };

      const result = await caller.notasCompra.create(notaData);

      expect(result).toBeDefined();
      expect(result.fornecedor).toBe(notaData.fornecedor);
      expect(result.valorTotal).toBe(notaData.valorTotal);
      expect(result.osId).toBe(notaData.osId);
      expect(result.userId).toBe(ctx.user.id);
    });

    it("should get notas by OS", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const osId = "OS-TEST-001";

      // Criar uma nota associada a esta OS
      await caller.notasCompra.create({
        dataEmissao: new Date(),
        fornecedor: "Fornecedor Teste",
        osId,
        valorTotal: 10000,
      });

      const result = await caller.notasCompra.getByOS({ osId });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.osId).toBe(osId);
    });
  });
});
