import { afterAll, describe, expect, test } from "bun:test";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const ROLLBACK_ERROR = new Error("__TEST_ROLLBACK__");

async function runInRollback(
  run: (tx: Prisma.TransactionClient) => Promise<void>
) {
  try {
    await prisma.$transaction(async (tx) => {
      await run(tx);
      throw ROLLBACK_ERROR;
    });
  } catch (error) {
    if (error !== ROLLBACK_ERROR) {
      throw error;
    }
  }
}

async function createBarber(tx: Prisma.TransactionClient) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const barberUser = await tx.user.create({
    data: {
      name: `Barber ${suffix}`,
      email: `barber.${suffix}@test.local`,
      passwordHash: "hash",
      role: "BARBER",
      barberProfile: {
        create: {},
      },
    },
    include: {
      barberProfile: true,
    },
  });

  if (!barberUser.barberProfile) {
    throw new Error("Expected barber profile to be created");
  }

  return barberUser.barberProfile.id;
}

describe("Barber schedule integrity (integration)", () => {
  test("invalid startTime format should fail", async () => {
    await runInRollback(async (tx) => {
      const barberProfileId = await createBarber(tx);
      let didFail = false;

      try {
        await tx.barberSchedule.create({
          data: {
            barberProfileId,
            dayOfWeek: "MONDAY",
            startTime: "9:00",
            endTime: "18:00",
            slotDuration: 30,
            isActive: true,
          },
        });
      } catch {
        didFail = true;
      }

      expect(didFail).toBe(true);
    });
  });

  test("endTime earlier than startTime should fail", async () => {
    await runInRollback(async (tx) => {
      const barberProfileId = await createBarber(tx);
      let didFail = false;

      try {
        await tx.barberSchedule.create({
          data: {
            barberProfileId,
            dayOfWeek: "TUESDAY",
            startTime: "18:00",
            endTime: "09:00",
            slotDuration: 30,
            isActive: true,
          },
        });
      } catch {
        didFail = true;
      }

      expect(didFail).toBe(true);
    });
  });

  test("valid HH:mm schedule should pass", async () => {
    await runInRollback(async (tx) => {
      const barberProfileId = await createBarber(tx);

      const created = await tx.barberSchedule.create({
        data: {
          barberProfileId,
          dayOfWeek: "WEDNESDAY",
          startTime: "09:00",
          endTime: "18:00",
          slotDuration: 30,
          isActive: true,
        },
      });

      expect(created.id.length).toBeGreaterThan(0);
    });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

