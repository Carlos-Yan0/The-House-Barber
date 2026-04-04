import { afterAll, describe, expect, test } from "bun:test";
import { PrismaClient, Prisma } from "@prisma/client";
import { mapPrismaErrorToHttp } from "../lib/prismaError";

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

describe("Prisma error mapping (integration)", () => {
  test("maps P2002 email conflict to 409 with stable code", async () => {
    await runInRollback(async (tx) => {
      const suffix = crypto.randomUUID().slice(0, 8);
      const email = `dup.${suffix}@test.local`;

      await tx.user.create({
        data: {
          name: "First User",
          email,
          passwordHash: "hash",
          role: "CLIENT",
        },
      });

      let mapped: ReturnType<typeof mapPrismaErrorToHttp> = null;
      try {
        await tx.user.create({
          data: {
            name: "Second User",
            email,
            passwordHash: "hash",
            role: "CLIENT",
          },
        });
      } catch (error) {
        mapped = mapPrismaErrorToHttp(error);
      }

      expect(mapped?.status).toBe(409);
      expect(mapped?.body.code).toBe("UNIQUE_CONFLICT");
    });
  });

  test("maps appointment overlap constraint to 409 APPOINTMENT_CONFLICT", async () => {
    await runInRollback(async (tx) => {
      const suffix = crypto.randomUUID().slice(0, 8);

      const client = await tx.user.create({
        data: {
          name: `Client ${suffix}`,
          email: `client.${suffix}@test.local`,
          passwordHash: "hash",
          role: "CLIENT",
        },
      });

      const barber = await tx.user.create({
        data: {
          name: `Barber ${suffix}`,
          email: `barber.${suffix}@test.local`,
          passwordHash: "hash",
          role: "BARBER",
          barberProfile: { create: {} },
        },
        include: { barberProfile: true },
      });

      const service = await tx.service.create({
        data: {
          name: `Service ${suffix}`,
          duration: 30,
          price: "50.00",
          isActive: true,
        },
      });

      if (!barber.barberProfile) {
        throw new Error("Expected barber profile to exist");
      }

      await tx.appointment.create({
        data: {
          clientId: client.id,
          barberProfileId: barber.barberProfile.id,
          serviceId: service.id,
          scheduledAt: new Date("2030-02-10T13:00:00.000Z"),
          endsAt: new Date("2030-02-10T13:30:00.000Z"),
          status: "PENDING",
        },
      });

      let mapped: ReturnType<typeof mapPrismaErrorToHttp> = null;
      try {
        await tx.appointment.create({
          data: {
            clientId: client.id,
            barberProfileId: barber.barberProfile.id,
            serviceId: service.id,
            scheduledAt: new Date("2030-02-10T13:15:00.000Z"),
            endsAt: new Date("2030-02-10T13:45:00.000Z"),
            status: "PENDING",
          },
        });
      } catch (error) {
        mapped = mapPrismaErrorToHttp(error);
      }

      expect(mapped?.status).toBe(409);
      expect(mapped?.body.code).toBe("APPOINTMENT_CONFLICT");
    });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

