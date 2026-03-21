// src/routes/appointments.ts
import Elysia, { t } from "elysia";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getUserFromHeader } from "../lib/getUser";
import { getAvailableSlots } from "../services/availability.service";
import { addMinutes, format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

// Brazil is permanently UTC-3 since DST was abolished in 2019.
const BRT_OFFSET = "-03:00";

const createSchema = z.object({
  barberProfileId: z.string(),
  serviceId: z.string(),
  // ISO string que o frontend envia já em BRT: "2026-03-21T09:00:00-03:00"
  scheduledAt: z.string(),
  notes: z.string().optional(),
});

export const appointmentRoutes = new Elysia({ prefix: "/appointments" })

  // ── GET /appointments/availability ───────────────────────────────────────
  .get(
    "/availability",
    async ({ query, set }) => {
      const { barberId, date, serviceId } = query;

      if (!barberId || !date || !serviceId) {
        set.status = 400;
        return { error: "barberId, date e serviceId são obrigatórios" };
      }

      // Validar formato da data
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date as string)) {
        set.status = 400;
        return { error: "date deve estar no formato yyyy-MM-dd" };
      }

      const service = await prisma.service.findUnique({
        where: { id: serviceId as string, isActive: true },
      });
      if (!service) {
        set.status = 404;
        return { error: "Serviço não encontrado" };
      }

      // IMPORTANTE: passa a string diretamente — NÃO converter para Date aqui.
      // new Date("yyyy-MM-dd") cria UTC midnight que ao converter para BRT
      // retrocede um dia inteiro.
      const slots = await getAvailableSlots(
        barberId as string,
        date as string,
        service.duration
      );

      return { slots, date, barberId, serviceId };
    },
    {
      query: t.Object({
        barberId:  t.Optional(t.String()),
        date:      t.Optional(t.String()),
        serviceId: t.Optional(t.String()),
      }),
    }
  )

  // ── GET /appointments ─────────────────────────────────────────────────────
  .get(
    "/",
    async ({ headers, query, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const { user } = auth;

      const page  = Math.max(1, Number(query.page)  || 1);
      const limit = Math.min(100, Number(query.limit) || 20);
      const skip  = (page - 1) * limit;

      const where: any = {};

      if (user.role === "CLIENT") {
        where.clientId = user.id;
      } else if (user.role === "BARBER" && user.barberProfile) {
        where.barberProfileId = user.barberProfile.id;
      }
      // ADMIN vê tudo

      if (query.date) {
        const d = query.date as string;
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          where.scheduledAt = {
            gte: fromZonedTime(`${d}T00:00:00`, TIMEZONE),
            lte: fromZonedTime(`${d}T23:59:59`, TIMEZONE),
          };
        }
      }

      if (query.status) {
        where.status = query.status;
      }

      const [total, appointments] = await Promise.all([
        prisma.appointment.count({ where }),
        prisma.appointment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { scheduledAt: "asc" },
          include: {
            client: { select: { id: true, name: true, phone: true } },
            barberProfile: {
              include: { user: { select: { id: true, name: true } } },
            },
            service: true,
            comanda: {
              select: { id: true, status: true, paymentStatus: true },
            },
          },
        }),
      ]);

      return {
        data: appointments,
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      };
    },
    {
      query: t.Object({
        page:   t.Optional(t.String()),
        limit:  t.Optional(t.String()),
        date:   t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
    }
  )

  // ── POST /appointments ────────────────────────────────────────────────────
  .post(
    "/",
    async ({ headers, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const userId = auth.user.id;

      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 422;
        return { error: parsed.error.flatten() };
      }

      const { barberProfileId, serviceId, scheduledAt, notes } = parsed.data;

      // Verificar se barbeiro existe e está disponível
      const barber = await prisma.barberProfile.findUnique({
        where: { id: barberProfileId, isAvailable: true },
      });
      if (!barber) {
        set.status = 404;
        return { error: "Barbeiro não encontrado ou indisponível" };
      }

      const service = await prisma.service.findUnique({
        where: { id: serviceId, isActive: true },
      });
      if (!service) {
        set.status = 404;
        return { error: "Serviço não encontrado" };
      }

      const startTime = new Date(scheduledAt);
      if (isNaN(startTime.getTime())) {
        set.status = 422;
        return { error: "Data/hora inválida" };
      }

      const endsAt = addMinutes(startTime, service.duration);

      // ── Validar que o slot ainda está disponível ──────────────────────────
      // Extrair a data em BRT para re-verificar a agenda
      const dateInBRT = format(
        new Date(startTime.toLocaleString("en-US", { timeZone: TIMEZONE })),
        "yyyy-MM-dd"
      );

      const availableSlots = await getAvailableSlots(
        barberProfileId,
        dateInBRT,
        service.duration
      );

      const requestedTime = format(
        new Date(startTime.toLocaleString("en-US", { timeZone: TIMEZONE })),
        "HH:mm"
      );

      if (!availableSlots.includes(requestedTime)) {
        set.status = 409;
        return { error: "Horário não disponível" };
      }

      // ── Criar agendamento ─────────────────────────────────────────────────
      const appointment = await prisma.appointment.create({
        data: {
          clientId: userId,
          barberProfileId,
          serviceId,
          scheduledAt: startTime,
          endsAt,
          notes,
          status: "PENDING",
        },
        include: {
          service: true,
          barberProfile: {
            include: { user: { select: { name: true } } },
          },
        },
      });

      set.status = 201;
      return appointment;
    },
    {
      body: t.Object({
        barberProfileId: t.String(),
        serviceId:       t.String(),
        scheduledAt:     t.String(),
        notes:           t.Optional(t.String()),
      }),
    }
  )

  // ── PATCH /appointments/:id/status ────────────────────────────────────────
  .patch(
    "/:id/status",
    async ({ headers, params, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const { user } = auth;

      const { status, cancelReason } = body as {
        status: string;
        cancelReason?: string;
      };

      const appointment = await prisma.appointment.findUnique({
        where: { id: params.id },
        include: { barberProfile: true },
      });
      if (!appointment) {
        set.status = 404;
        return { error: "Agendamento não encontrado" };
      }

      // Verificar permissão
      const isClient = appointment.clientId === user.id;
      const isBarber =
        user.role === "BARBER" &&
        appointment.barberProfile.userId === user.id;
      const isAdmin = user.role === "ADMIN";

      if (!isClient && !isBarber && !isAdmin) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      // Verificar transição de status válida
      const allowed: Record<string, string[]> = {
        PENDING:     ["CONFIRMED", "CANCELLED"],
        CONFIRMED:   ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
        IN_PROGRESS: ["COMPLETED"],
      };

      if (!allowed[appointment.status]?.includes(status)) {
        set.status = 422;
        return {
          error: `Transição inválida: ${appointment.status} → ${status}`,
        };
      }

      const updated = await prisma.appointment.update({
        where: { id: params.id },
        data: { status: status as any, cancelReason },
      });

      // Criar comanda automaticamente ao iniciar atendimento
      if (status === "IN_PROGRESS") {
        const service = await prisma.service.findUnique({
          where: { id: appointment.serviceId },
        });
        await prisma.comanda.upsert({
          where: { appointmentId: params.id },
          create: {
            appointmentId: params.id,
            totalAmount:   service!.price,
            status:        "OPEN",
            paymentStatus: "PENDING",
          },
          update: {},
        });
      }

      return updated;
    },
    {
      body: t.Object({
        status:       t.String(),
        cancelReason: t.Optional(t.String()),
      }),
    }
  )

  // ── DELETE /appointments/:id ──────────────────────────────────────────────
  .delete(
    "/:id",
    async ({ headers, params, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const { user } = auth;

      const appointment = await prisma.appointment.findUnique({
        where: { id: params.id },
      });
      if (!appointment) {
        set.status = 404;
        return { error: "Agendamento não encontrado" };
      }

      const isOwner = appointment.clientId === user.id;
      const isStaff = user.role === "ADMIN" || user.role === "BARBER";

      if (!isOwner && !isStaff) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
        set.status = 422;
        return { error: "Somente agendamentos pendentes ou confirmados podem ser cancelados" };
      }

      await prisma.appointment.update({
        where: { id: params.id },
        data: { status: "CANCELLED", cancelReason: "Cancelado pelo usuário" },
      });

      return { message: "Agendamento cancelado com sucesso" };
    }
  );