// src/services/availability.service.ts
import { prisma } from "../lib/prisma";
import { addMinutes, isBefore, isAfter, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

const DAY_MAP: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Returns available time slots (HH:mm strings in BRT) for a given barber, date and service.
 *
 * @param barberProfileId - ID do perfil do barbeiro
 * @param dateStr         - Data no formato "yyyy-MM-dd" — NUNCA passe um objeto Date aqui,
 *                          pois new Date("yyyy-MM-dd") cria UTC midnight que ao converter
 *                          para BRT (UTC-3) retrocede para o dia anterior.
 * @param serviceDuration - Duração do serviço em minutos
 */
export async function getAvailableSlots(
  barberProfileId: string,
  dateStr: string,
  serviceDuration: number
): Promise<string[]> {
  // ── 1. Determinar dia da semana ───────────────────────────────────────────
  // Parseamos os componentes diretamente da string para evitar qualquer
  // deslocamento de fuso. new Date(year, month-1, day) usa horário local.
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = DAY_MAP[localDate.getDay()] as
    | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY"
    | "FRIDAY" | "SATURDAY" | "SUNDAY";

  // ── 2. Verificar se barbeiro trabalha neste dia ───────────────────────────
  const schedule = await prisma.barberSchedule.findFirst({
    where: { barberProfileId, dayOfWeek, isActive: true },
  });
  if (!schedule) return [];

  // ── 3. Verificar data bloqueada ───────────────────────────────────────────
  // O campo @db.Date é salvo como UTC midnight — comparamos com o mesmo valor.
  const blockedDateUTC = new Date(`${dateStr}T00:00:00.000Z`);
  const blocked = await prisma.barberBlockedDate.findFirst({
    where: { barberProfileId, date: blockedDateUTC },
  });
  if (blocked) return [];

  // ── 4. Buscar agendamentos existentes no dia ──────────────────────────────
  const dayStart = fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);
  const dayEnd   = fromZonedTime(`${dateStr}T23:59:59`, TIMEZONE);

  const existing = await prisma.appointment.findMany({
    where: {
      barberProfileId,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { scheduledAt: true, endsAt: true },
  });

  // ── 5. Gerar slots ────────────────────────────────────────────────────────
  const [sh, sm] = schedule.startTime.split(":").map(Number);
  const [eh, em] = schedule.endTime.split(":").map(Number);

  let slotStart  = fromZonedTime(`${dateStr}T${pad(sh)}:${pad(sm)}:00`, TIMEZONE);
  const schedEnd = fromZonedTime(`${dateStr}T${pad(eh)}:${pad(em)}:00`, TIMEZONE);

  const now = new Date();
  const cutoff = addMinutes(now, 5); // não exibir slots a menos de 5 min no futuro

  const slots: string[] = [];

  while (isBefore(slotStart, schedEnd)) {
    const slotEnd = addMinutes(slotStart, serviceDuration);

    // Slot ultrapassa o fim do expediente
    if (isAfter(slotEnd, schedEnd)) break;

    // Slot já passou (ou está muito próximo)
    if (isBefore(slotStart, cutoff)) {
      slotStart = addMinutes(slotStart, schedule.slotDuration);
      continue;
    }

    // Verificar sobreposição com agendamentos existentes
    const hasConflict = existing.some(
      (apt) =>
        isBefore(slotStart, apt.endsAt) &&
        isAfter(slotEnd, apt.scheduledAt)
    );

    if (!hasConflict) {
      slots.push(format(toZonedTime(slotStart, TIMEZONE), "HH:mm"));
    }

    slotStart = addMinutes(slotStart, schedule.slotDuration);
  }

  return slots;
}