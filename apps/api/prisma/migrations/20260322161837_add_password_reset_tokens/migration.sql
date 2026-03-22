-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "appointments_barber_profile_id_scheduled_at_idx" ON "appointments"("barber_profile_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "appointments_client_id_scheduled_at_idx" ON "appointments"("client_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "barber_schedules_barber_profile_id_day_of_week_is_active_idx" ON "barber_schedules"("barber_profile_id", "day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "comandas_status_payment_status_idx" ON "comandas"("status", "payment_status");

-- CreateIndex
CREATE INDEX "comandas_pix_tx_id_idx" ON "comandas"("pix_tx_id");

-- CreateIndex
CREATE INDEX "commissions_barber_profile_id_created_at_idx" ON "commissions"("barber_profile_id", "created_at");

-- CreateIndex
CREATE INDEX "commissions_barber_profile_id_is_paid_idx" ON "commissions"("barber_profile_id", "is_paid");

-- CreateIndex
CREATE INDEX "services_is_active_sort_order_idx" ON "services"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "users_email_is_active_idx" ON "users"("email", "is_active");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
