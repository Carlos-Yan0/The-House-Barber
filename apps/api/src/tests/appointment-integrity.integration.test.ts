import { afterAll, describe, expect, test } from "bun:test";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const ROLLBACK_ERROR = new Error("__TEST_ROLLBACK__");
type DbClient = Prisma.TransactionClient | PrismaClient;

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

async function createBaseData(tx: DbClient) {
  const suffix = crypto.randomUUID().slice(0, 8);

  const client = await tx.user.create({
    data: {
      name: `Client ${suffix}`,
      email: `client.${suffix}@test.local`,
      passwordHash: "hash",
      role: "CLIENT",
    },
  });

  const barberUserA = await tx.user.create({
    data: {
      name: `Barber A ${suffix}`,
      email: `barber.a.${suffix}@test.local`,
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

  const barberUserB = await tx.user.create({
    data: {
      name: `Barber B ${suffix}`,
      email: `barber.b.${suffix}@test.local`,
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

  const service = await tx.service.create({
    data: {
      name: `Service ${suffix}`,
      duration: 30,
      price: "50.00",
      isActive: true,
    },
  });

  if (!barberUserA.barberProfile || !barberUserB.barberProfile) {
    throw new Error("Expected barber profile to be created");
  }

  return {
    clientId: client.id,
    barberAUserId: barberUserA.id,
    barberBUserId: barberUserB.id,
    barberAId: barberUserA.barberProfile.id,
    barberBId: barberUserB.barberProfile.id,
    serviceId: service.id,
  };
}

describe("Appointment integrity (integration)", () => {
  test("same barber + same time should fail", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);
      const scheduledAt = new Date("2030-01-10T13:00:00.000Z");
      const endsAt = new Date("2030-01-10T13:30:00.000Z");

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberAId,
          serviceId: base.serviceId,
          scheduledAt,
          endsAt,
          status: "PENDING",
        },
      });

      let didFail = false;
      try {
        await tx.appointment.create({
          data: {
            clientId: base.clientId,
            barberProfileId: base.barberAId,
            serviceId: base.serviceId,
            scheduledAt,
            endsAt,
            status: "PENDING",
          },
        });
      } catch {
        didFail = true;
      }
      expect(didFail).toBe(true);
    });
  });

  test("different barber + same time should pass", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);
      const scheduledAt = new Date("2030-01-10T13:00:00.000Z");
      const endsAt = new Date("2030-01-10T13:30:00.000Z");

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberAId,
          serviceId: base.serviceId,
          scheduledAt,
          endsAt,
          status: "PENDING",
        },
      });

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberBId,
          serviceId: base.serviceId,
          scheduledAt,
          endsAt,
          status: "PENDING",
        },
      });
    });
  });

  test("same barber + overlapping range should fail", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberAId,
          serviceId: base.serviceId,
          scheduledAt: new Date("2030-01-10T13:00:00.000Z"),
          endsAt: new Date("2030-01-10T13:30:00.000Z"),
          status: "PENDING",
        },
      });

      let didFail = false;
      try {
        await tx.appointment.create({
          data: {
            clientId: base.clientId,
            barberProfileId: base.barberAId,
            serviceId: base.serviceId,
            scheduledAt: new Date("2030-01-10T13:15:00.000Z"),
            endsAt: new Date("2030-01-10T13:45:00.000Z"),
            status: "PENDING",
          },
        });
      } catch {
        didFail = true;
      }

      expect(didFail).toBe(true);
    });
  });

  test("cancelled appointment should not block a new booking on same slot", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);
      const scheduledAt = new Date("2030-01-10T15:00:00.000Z");
      const endsAt = new Date("2030-01-10T15:30:00.000Z");

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberAId,
          serviceId: base.serviceId,
          scheduledAt,
          endsAt,
          status: "CANCELLED",
        },
      });

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberAId,
          serviceId: base.serviceId,
          scheduledAt,
          endsAt,
          status: "PENDING",
        },
      });
    });
  });

  test("no-show appointment should not block a new booking on same slot", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);
      const scheduledAt = new Date("2030-01-10T16:00:00.000Z");
      const endsAt = new Date("2030-01-10T16:30:00.000Z");

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberAId,
          serviceId: base.serviceId,
          scheduledAt,
          endsAt,
          status: "NO_SHOW",
        },
      });

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberAId,
          serviceId: base.serviceId,
          scheduledAt,
          endsAt,
          status: "PENDING",
        },
      });
    });
  });

  test("adjacent intervals should pass with [start, end) semantics", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberAId,
          serviceId: base.serviceId,
          scheduledAt: new Date("2030-01-10T17:00:00.000Z"),
          endsAt: new Date("2030-01-10T17:30:00.000Z"),
          status: "PENDING",
        },
      });

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberAId,
          serviceId: base.serviceId,
          scheduledAt: new Date("2030-01-10T17:30:00.000Z"),
          endsAt: new Date("2030-01-10T18:00:00.000Z"),
          status: "PENDING",
        },
      });
    });
  });

  test("invalid interval (endsAt <= scheduledAt) should fail", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);
      let didFail = false;

      try {
        await tx.appointment.create({
          data: {
            clientId: base.clientId,
            barberProfileId: base.barberAId,
            serviceId: base.serviceId,
            scheduledAt: new Date("2030-01-10T19:00:00.000Z"),
            endsAt: new Date("2030-01-10T19:00:00.000Z"),
            status: "PENDING",
          },
        });
      } catch {
        didFail = true;
      }

      expect(didFail).toBe(true);
    });
  });

  test("concurrent booking attempts for same barber and slot: only one succeeds", async () => {
    const base = await createBaseData(prisma);
    const scheduledAt = new Date("2030-01-10T14:00:00.000Z");
    const endsAt = new Date("2030-01-10T14:30:00.000Z");

    try {
      const [first, second] = await Promise.allSettled([
        prisma.appointment.create({
          data: {
            clientId: base.clientId,
            barberProfileId: base.barberAId,
            serviceId: base.serviceId,
            scheduledAt,
            endsAt,
            status: "PENDING",
          },
        }),
        prisma.appointment.create({
          data: {
            clientId: base.clientId,
            barberProfileId: base.barberAId,
            serviceId: base.serviceId,
            scheduledAt,
            endsAt,
            status: "PENDING",
          },
        }),
      ]);

      const results = [first, second];
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failureCount = results.filter((r) => r.status === "rejected").length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    } finally {
      await prisma.appointment.deleteMany({
        where: {
          barberProfileId: base.barberAId,
          serviceId: base.serviceId,
          scheduledAt,
        },
      });

      await prisma.service.delete({ where: { id: base.serviceId } });
      await prisma.barberProfile.deleteMany({
        where: { id: { in: [base.barberAId, base.barberBId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [base.clientId, base.barberAUserId, base.barberBUserId] } },
      });
    }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
