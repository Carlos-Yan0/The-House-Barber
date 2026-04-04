-- Safety gate: block migration if existing rows already violate interval integrity.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "appointments" a
    WHERE a."ends_at" <= a."scheduled_at"
  ) THEN
    RAISE EXCEPTION
      'Cannot apply appointments_valid_interval_chk: invalid appointment intervals already exist';
  END IF;
END $$;

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_valid_interval_chk"
CHECK ("ends_at" > "scheduled_at");

