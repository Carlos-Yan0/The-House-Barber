-- Ensure we can combine equality (barber_profile_id) with range overlap operators.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Safety gate: block migration if there is already conflicting active data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "appointments" a1
    JOIN "appointments" a2
      ON a1."barber_profile_id" = a2."barber_profile_id"
     AND a1."id" < a2."id"
     AND a1."status" NOT IN ('CANCELLED'::"AppointmentStatus", 'NO_SHOW'::"AppointmentStatus")
     AND a2."status" NOT IN ('CANCELLED'::"AppointmentStatus", 'NO_SHOW'::"AppointmentStatus")
     AND tsrange(a1."scheduled_at", a1."ends_at", '[)')
         && tsrange(a2."scheduled_at", a2."ends_at", '[)')
  ) THEN
    RAISE EXCEPTION
      'Cannot apply appointments_no_overlap_active constraint: active overlapping appointments already exist';
  END IF;
END $$;

-- Final DB-level guarantee for active appointments:
-- same barber + overlapping interval is rejected by PostgreSQL.
ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_no_overlap_active"
EXCLUDE USING gist (
  "barber_profile_id" WITH =,
  tsrange("scheduled_at", "ends_at", '[)') WITH &&
)
WHERE ("status" NOT IN ('CANCELLED'::"AppointmentStatus", 'NO_SHOW'::"AppointmentStatus"));

