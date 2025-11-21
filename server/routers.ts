import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

// Schema de validação para lançamentos
const lancamentoSchema = z.object({
  dataEmissao: z.date(),
  cliente: z.string().min(1),
  clienteId: z.number().optional(),
  numeroNf: z.string().optional(),
  os: z.string().optional(),
  descricao: z.string().optional(),
  valorTotal: z.number().int().positive(),
  taxaComissao: z.number().int().min(0).max(10000).default(50),
  observacoes: z.string().optional(),
  pagamentos: z.string().optional(),
});

// Schema para notas de compra
const notaCompraSchema = z.object({
  dataEmissao: z.date(),
  fornecedor: z.string().min(1),
  numeroNf: z.string().optional(),
  osId: z.string().optional(),
  valorTotal: z.number().int().positive(),
  descricao: z.string().optional(),
  observacoes: z.string().optional(),
  pdfUrl: z.string().optional(),
});

// Schema para clientes
const clienteSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string().optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  observacoes: z.string().optional(),
});

// Schema para variáveis
const variavelSchema = z.object({
  data: z.date(),
  descricao: z.string().min(1),
  valor: z.number().int(),
  tipo: z.enum(["credito", "debito"]).default("credito"),
  observacoes: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===== CLIENTES =====
  clientes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getAllClientes(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getClienteById(input.id);
      }),

    create: protectedProcedure
      .input(clienteSchema)
      .mutation(async ({ ctx, input }) => {
        return db.createCliente({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: clienteSchema.partial(),
      }))
      .mutation(async ({ input }) => {
        await db.updateCliente(input.id, input.data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCliente(input.id);
        return { success: true };
      }),
  }),

  // ===== LANÇAMENTOS =====
  lancamentos: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getAllLancamentos(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getLancamentoById(input.id);
      }),

    create: protectedProcedure
      .input(lancamentoSchema)
      .mutation(async ({ ctx, input }) => {
        return db.createLancamento({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: lancamentoSchema.partial(),
      }))
      .mutation(async ({ input }) => {
        await db.updateLancamento(input.id, input.data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLancamento(input.id);
        return { success: true };
      }),

    toggleFaturado: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        faturado: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await db.toggleLancamentoFaturado(input.id, input.faturado);
        return { success: true };
      }),
  }),

  // ===== NOTAS DE COMPRA =====
  notasCompra: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getAllNotasCompra(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getNotaCompraById(input.id);
      }),

    getByOS: protectedProcedure
      .input(z.object({ osId: z.string() }))
      .query(async ({ ctx, input }) => {
        return db.getNotasCompraByOS(input.osId, ctx.user.id);
      }),

    create: protectedProcedure
      .input(notaCompraSchema)
      .mutation(async ({ ctx, input }) => {
        return db.createNotaCompra({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: notaCompraSchema.partial(),
      }))
      .mutation(async ({ input }) => {
        await db.updateNotaCompra(input.id, input.data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteNotaCompra(input.id);
        return { success: true };
      }),
  }),

  // ===== VARIÁVEIS =====
  variaveis: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getAllVariaveis(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getVariavelById(input.id);
      }),

    create: protectedProcedure
      .input(variavelSchema)
      .mutation(async ({ ctx, input }) => {
        return db.createVariavel({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: variavelSchema.partial(),
      }))
      .mutation(async ({ input }) => {
        await db.updateVariavel(input.id, input.data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteVariavel(input.id);
        return { success: true };
      }),
  }),

  // ===== DASHBOARD =====
  dashboard: router({
    stats: protectedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ ctx, input }) => {
        return db.getDashboardStats(ctx.user.id, input.startDate, input.endDate);
      }),
  }),

  // ===== ANÁLISE DE NF COM IA =====
  ai: router({
    analyzeNF: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Aqui você pode integrar com a API do Gemini
        // Por enquanto, retornamos um mock
        return {
          cliente: "Cliente Exemplo",
          dataEmissao: new Date().toISOString().split('T')[0],
          numeroNf: "12345",
          valorTotal: 100000, // R$ 1.000,00 em centavos
          os: "OS-001",
          pc: null,
          observacoes: "Serviço de exemplo",
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
