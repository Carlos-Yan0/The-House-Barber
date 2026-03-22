// src/routes/admin.ts
import Elysia, { t } from "elysia";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { getUserFromHeader, invalidateUserCache } from "../lib/getUser";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";

async function requireAdmin(authHeader: string | undefined, set: any) {
  const auth = await getUserFromHeader(authHeader);
  if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
  if (auth.user.role !== "ADMIN") { set.status = 403; return { error: "Acesso negado" }; }
  return auth.user;
}

export const adminRoutes = new Elysia({ prefix: "/admin" })

  .get("/dashboard", async ({ headers, query, set }) => {
    const user = await requireAdmin(headers.authorization, set);
    if ("error" in (user as any)) return user;

    const date = query.date ? new Date(query.date as string) : new Date();
    const monthStart = startOfMonth(date);
    const monthEnd   = endOfMonth(date);

    const [
      todayAppointments,
      monthAppointments,
      openComandas,
      monthRevenue,
      totalClients,
      monthCommissions,
    ] = await Promise.all([
      prisma.appointment.count({
        where: { scheduledAt: { gte: startOfDay(date), lte: endOfDay(date) } },
      }),
      prisma.appointment.count({
        where: { scheduledAt: { gte: monthStart, lte: monthEnd } },
      }),
      prisma.comanda.count({ where: { status: "OPEN" } }),
      prisma.comanda.aggregate({
        where: {
          status: "CLOSED",
          paymentStatus: "PAID",
          closedAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { totalAmount: true },
      }),
      prisma.user.count({ where: { role: "CLIENT", isActive: true } }),
      prisma.commission.aggregate({
        where: {
          comanda: {
            status: "CLOSED",
            closedAt: { gte: monthStart, lte: monthEnd },
          },
        },
        _sum: { commissionAmount: true },
      }),
    ]);

    return {
      today: { appointments: todayAppointments, openComandas },
      month: {
        appointments: monthAppointments,
        revenue: Number(monthRevenue._sum.totalAmount ?? 0),
        commissions: Number(monthCommissions._sum.commissionAmount ?? 0),
      },
      totals: { clients: totalClients },
    };
  }, { query: t.Object({ date: t.Optional(t.String()) }) })

  .get("/reports/revenue", async ({ headers, query, set }) => {
    const user = await requireAdmin(headers.authorization, set);
    if ("error" in (user as any)) return user;

    const start = query.start ? new Date(query.start as string) : startOfMonth(new Date());
    const end   = query.end   ? new Date(query.end   as string) : endOfMonth(new Date());

    const comandas = await prisma.comanda.findMany({
      where: { status: "CLOSED", paymentStatus: "PAID", closedAt: { gte: start, lte: end } },
      include: {
        appointment: {
          include: {
            service: { select: { name: true } },
            barberProfile: { include: { user: { select: { name: true } } } },
          },
        },
        commission: true,
      },
      orderBy: { closedAt: "asc" },
    });

    const totalRevenue     = comandas.reduce((s, c) => s + Number(c.totalAmount), 0);
    const totalCommissions = comandas.reduce((s, c) => s + Number(c.commission?.commissionAmount ?? 0), 0);

    const byBarber = comandas.reduce((acc: Record<string, any>, c) => {
      const name = c.appointment.barberProfile.user.name;
      if (!acc[name]) acc[name] = { revenue: 0, commissions: 0, count: 0 };
      acc[name].revenue     += Number(c.totalAmount);
      acc[name].commissions += Number(c.commission?.commissionAmount ?? 0);
      acc[name].count++;
      return acc;
    }, {});

    const byService = comandas.reduce((acc: Record<string, any>, c) => {
      const name = c.appointment.service.name;
      if (!acc[name]) acc[name] = { revenue: 0, count: 0 };
      acc[name].revenue += Number(c.totalAmount);
      acc[name].count++;
      return acc;
    }, {});

    return { totalRevenue, totalCommissions, netRevenue: totalRevenue - totalCommissions, byBarber, byService, comandas };
  }, { query: t.Object({ start: t.Optional(t.String()), end: t.Optional(t.String()) }) })

  // ── POST /admin/barbers — criar barbeiro ──────────────────────────────────
  .post("/barbers", async ({ headers, body, set }) => {
    const user = await requireAdmin(headers.authorization, set);
    if ("error" in (user as any)) return user;

    const { name, email, password, phone, commissionRate } = body as {
      name: string; email: string; password: string; phone?: string; commissionRate?: number;
    };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { set.status = 409; return { error: "E-mail já cadastrado" }; }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: {
        name, email, phone, passwordHash, role: "BARBER",
        barberProfile: { create: { commissionRate: commissionRate ?? 0.5 } },
      },
      include: { barberProfile: true },
    });

    set.status = 201;
    return newUser;
  }, {
    body: t.Object({
      name: t.String(), email: t.String(), password: t.String(),
      phone: t.Optional(t.String()), commissionRate: t.Optional(t.Number()),
    }),
  })

  // ── PATCH /admin/barbers/:id — editar dados do barbeiro ───────────────────
  .patch("/barbers/:id", async ({ headers, params, body, set }) => {
    const admin = await requireAdmin(headers.authorization, set);
    if ("error" in (admin as any)) return admin;

    const { name, email, phone, commissionRate } = body as {
      name?: string; email?: string; phone?: string; commissionRate?: number;
    };

    // Verifica se o usuário existe e é barbeiro
    const target = await prisma.user.findUnique({
      where: { id: params.id, role: "BARBER" },
      include: { barberProfile: true },
    });
    if (!target) { set.status = 404; return { error: "Barbeiro não encontrado" }; }

    // Se está mudando o e-mail, garante unicidade
    if (email && email !== target.email) {
      const conflict = await prisma.user.findUnique({ where: { email } });
      if (conflict) { set.status = 409; return { error: "E-mail já cadastrado" }; }
    }

    // Atualiza user + barberProfile numa transação
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: params.id },
        data: {
          ...(name  !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
        },
        include: { barberProfile: true },
      }),
      ...(commissionRate !== undefined && target.barberProfile
        ? [prisma.barberProfile.update({
            where: { id: target.barberProfile.id },
            data: { commissionRate },
          })]
        : []),
    ]);

    // Invalida cache de autenticação pois o nome pode ter mudado
    invalidateUserCache(params.id);

    return updatedUser;
  }, {
    body: t.Object({
      name:           t.Optional(t.String()),
      email:          t.Optional(t.String()),
      phone:          t.Optional(t.String()),
      commissionRate: t.Optional(t.Number()),
    }),
  })

  // ── PATCH /admin/users/:id/toggle-active — ativar / inativar usuário ──────
  .patch("/users/:id/toggle-active", async ({ headers, params, set }) => {
    const admin = await requireAdmin(headers.authorization, set);
    if ("error" in (admin as any)) return admin;

    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) { set.status = 404; return { error: "Usuário não encontrado" }; }

    // Impede que o admin se inative
    if (target.id === (admin as any).id) {
      set.status = 422;
      return { error: "Você não pode inativar sua própria conta" };
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { isActive: !target.isActive },
      select: { id: true, name: true, isActive: true, role: true },
    });

    // Remove cache para que o usuário seja barrado na próxima requisição
    invalidateUserCache(params.id);

    return updated;
  })

  // ── GET /admin/users ──────────────────────────────────────────────────────
  .get("/users", async ({ headers, query, set }) => {
    const user = await requireAdmin(headers.authorization, set);
    if ("error" in (user as any)) return user;

    return prisma.user.findMany({
      where: query.role ? { role: query.role as any } : undefined,
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        isActive: true, createdAt: true,
        barberProfile: { select: { id: true, commissionRate: true, isAvailable: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }, { query: t.Object({ role: t.Optional(t.String()) }) })

  // ── PATCH /admin/commissions/:id/pay ─────────────────────────────────────
  .patch("/commissions/:id/pay", async ({ headers, params, set }) => {
    const user = await requireAdmin(headers.authorization, set);
    if ("error" in (user as any)) return user;

    const commission = await prisma.commission.findUnique({ where: { id: params.id } });
    if (!commission) { set.status = 404; return { error: "Comissão não encontrada" }; }

    return prisma.commission.update({
      where: { id: params.id },
      data: { isPaid: true, paidAt: new Date() },
    });
  });