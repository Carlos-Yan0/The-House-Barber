-- Safety gate: block migration if existing rows violate the new rules.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "barber_schedules" bs
    WHERE bs."start_time" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
       OR bs."end_time" !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
       OR bs."start_time"::time >= bs."end_time"::time
  ) THEN
    RAISE EXCEPTION
      'Cannot apply barber_schedules time checks: invalid schedule rows already exist';
  END IF;
END $$;

ALTER TABLE "barber_schedules"
ADD CONSTRAINT "barber_schedules_start_time_format_chk"
CHECK ("start_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "barber_schedules"
ADD CONSTRAINT "barber_schedules_end_time_format_chk"
CHECK ("end_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "barber_schedules"
ADD CONSTRAINT "barber_schedules_start_before_end_chk"
CHECK ("start_time"::time < "end_time"::time);

