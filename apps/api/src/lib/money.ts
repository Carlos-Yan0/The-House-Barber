import { Prisma } from "@prisma/client";

export function calculateCommissionAmount(
  grossAmount: Prisma.Decimal | string | number,
  commissionRate: number
): Prisma.Decimal {
  const amount = grossAmount instanceof Prisma.Decimal
    ? grossAmount
    : new Prisma.Decimal(grossAmount);

  return amount
    .mul(new Prisma.Decimal(commissionRate))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

