// src/services/availability.service.ts
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

/**
 * Parses a date (string or Date object) into its Brazil-local calendar components.
 *
 * When a date like "2026-03-22" arrives via query param, JS creates it as UTC midnight.
 * We convert to BRT to extract the correct local calendar date and day-of-week.
 */
function parseDateBR(dateInput: Date | string): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: string;
} {
  const zonedDate = toZonedTime(
    typeof dateInput === "string" ? new Date(dateInput) : dateInput,
    TIMEZONE
  );

  const dateStr = format(zonedDate, "yyyy-MM-dd");
  const [year, month, day] = dateStr.split("-").map(Number);

  // Build a plain local Date solely to determine the day-of-week index.
  const dayOfWeek = DAY_OF_WEEK_MAP[new Date(year, month - 1, day).getDay()];

  return { year, month, day, dayOfWeek };
}

/**
 * Pads a number to two digits, e.g. 3 → "03".
 */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export async function getAvailableSlots(
  barberProfileId: string,
  date: Date,
  serviceDuration: number
): Promise<string[]> {
  const { year, month, day, dayOfWeek } = parseDateBR(date);

  // 1. Check if the barber works on this day-of-week.
  const schedule = await prisma.barberSchedule.findFirst({
    where: { barberProfileId, dayOfWeek: dayOfWeek as any, isActive: true },
  });
  if (!schedule) return [];

  // 2. Check if this calendar date is explicitly blocked.
  //
  // FIX: @db.Date fields are stored as UTC midnight (e.g. 2026-03-22T00:00:00Z).
  // Using a BRT-offset range query (dayStartBR = 2026-03-22T03:00:00Z) would
  // make the gte condition false — UTC midnight < BRT midnight. We must
  // compare with the exact UTC midnight value that Prisma persists.
  const targetDateUTC = new Date(
    `${year}-${pad(month)}-${pad(day)}T00:00:00.000Z`
  );
  const blocked = await prisma.barberBlockedDate.findFirst({
    where: { barberProfileId, date: targetDateUTC },
  });
  if (blocked) return [];

  // 3. Fetch existing appointments for this Brazil calendar day.
  const dayStartBR = fromZonedTime(
    `${year}-${pad(month)}-${pad(day)}T00:00:00`,
    TIMEZONE
  );
  const dayEndBR = fromZonedTime(
    `${year}-${pad(month)}-${pad(day)}T23:59:59`,
    TIMEZONE
  );

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      barberProfileId,
      scheduledAt: { gte: dayStartBR, lte: dayEndBR },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { scheduledAt: true, endsAt: true },
  });

  // 4. Generate candidate slots within the schedule window.
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
  const slots: string[] = [];

  while (isBefore(slotStart, scheduleEnd)) {
    const slotEnd = addMinutes(slotStart, serviceDuration);

    // Skip slots that have already started (5-minute buffer).
    if (isBefore(slotStart, addMinutes(now, 5))) {
      slotStart = addMinutes(slotStart, schedule.slotDuration);
      continue;
    }

    // Skip slots that would extend past the end of the working day.
    if (isAfter(slotEnd, scheduleEnd)) break;

    // Skip slots that overlap any existing appointment.
    const hasConflict = existingAppointments.some(
      (apt) =>
        isBefore(slotStart, apt.endsAt) && isAfter(slotEnd, apt.scheduledAt)
    );

    if (!hasConflict) {
      // Return time strings in Brazil timezone ("HH:mm").
      slots.push(format(toZonedTime(slotStart, TIMEZONE), "HH:mm"));
    }

    slotStart = addMinutes(slotStart, schedule.slotDuration);
  }

  return slots;
}