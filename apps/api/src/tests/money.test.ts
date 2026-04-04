import { describe, expect, test } from "bun:test";
import { Prisma } from "@prisma/client";
import { calculateCommissionAmount } from "../lib/money";

describe("Money helpers", () => {
  test("calculateCommissionAmount keeps 2 decimal places", () => {
    const value = calculateCommissionAmount("39.90", 0.5);
    expect(value.toString()).toBe("19.95");
  });

  test("calculateCommissionAmount rounds half up", () => {
    const value = calculateCommissionAmount(new Prisma.Decimal("10.05"), 0.3333);
    expect(value.toString()).toBe("3.35");
  });
});

