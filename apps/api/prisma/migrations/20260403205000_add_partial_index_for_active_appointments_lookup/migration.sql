-- Optimizes availability queries that only care about active appointments.
-- Existing generic index remains untouched for backward compatibility.
CREATE INDEX IF NOT EXISTS "appointments_active_barber_scheduled_at_idx"
ON "appointments" ("barber_profile_id", "scheduled_at")
WHERE "status" NOT IN ('CANCELLED'::"AppointmentStatus", 'NO_SHOW'::"AppointmentStatus");

