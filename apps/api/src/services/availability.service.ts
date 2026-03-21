import { prisma } from "../lib/prisma";
import { addMinutes, isBefore, isAfter, format } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

export const DAY_OF_WEEK_MAP: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

function parseDateBR(dateInput: Date | string): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: string;
} {
  let year: number, month: number, day: number;

  // Correção CRÍTICA: Se receber string YYYY-MM-DD, tratamos como data local 
  // para evitar que o fuso UTC retroceda o dia.
  if (typeof dateInput === "string" && dateInput.length >= 10) {
    const parts = dateInput.split('T')[0].split('-');
    year = parseInt(parts[0]);
    month = parseInt(parts[1]);
    day = parseInt(parts[2]);
  } else {
    const zonedDate = toZonedTime(
      typeof dateInput === "string" ? new Date(dateInput) : dateInput,
      TIMEZONE
    );
    const dateStr = format(zonedDate, "yyyy-MM-dd");
    [year, month, day] = dateStr.split("-").map(Number);
  }

  // O dia da semana deve ser baseado na data local construída
  const dayOfWeek = DAY_OF_WEEK_MAP[new Date(year, month - 1, day).getDay()];

  return { year, month, day, dayOfWeek };
}

export async function getAvailableSlots(
  barberProfileId: string,
  date: Date | string,
  serviceDuration: number
): Promise<{ time: string; available: boolean }[]> {
  const { year, month, day, dayOfWeek } = parseDateBR(date);
  const pad = (n: number) => String(n).padStart(2, "0");

  const schedule = await prisma.workingDay.findFirst({
    where: { barberProfileId, dayOfWeek: dayOfWeek as any, isOpen: true },
  });

  if (!schedule) return [];

  const startOfDayRange = fromZonedTime(`${year}-${pad(month)}-${pad(day)}T00:00:00`, TIMEZONE);
  const endOfDayRange = fromZonedTime(`${year}-${pad(month)}-${pad(day)}T23:59:59`, TIMEZONE);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      barberProfileId,
      scheduledAt: { gte: startOfDayRange, lte: endOfDayRange },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { scheduledAt: true, endsAt: true },
  });

  const [startHour, startMin] = schedule.startTime.split(":").map(Number);
  const [endHour, endMin] = schedule.endTime.split(":").map(Number);

  let slotStart = fromZonedTime(
    `${year}-${pad(month)}-${pad(day)}T${pad(startHour)}:${pad(startMin)}:00`,
    TIMEZONE
  );
  const scheduleEnd = fromZonedTime(
    `${year}-${pad(month)}-${pad(day)}T${pad(endHour)}:${pad(endMin)}:00`,
    TIMEZONE
  );

  const now = new Date();
  const slots: { time: string; available: boolean }[] = [];

  while (isBefore(slotStart, scheduleEnd)) {
    const slotEnd = addMinutes(slotStart, serviceDuration);

    if (isAfter(slotEnd, scheduleEnd)) break;

    const hasConflict = existingAppointments.some(
      (apt) => isBefore(slotStart, apt.endsAt) && isAfter(slotEnd, apt.scheduledAt)
    );

    const isPast = isBefore(slotStart, addMinutes(now, 5));

    slots.push({
      time: format(toZonedTime(slotStart, TIMEZONE), "HH:mm"),
      available: !hasConflict && !isPast
    });

    slotStart = addMinutes(slotStart, schedule.slotDuration);
  }

  return slots;
}