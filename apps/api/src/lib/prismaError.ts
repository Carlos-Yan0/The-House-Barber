import { Prisma } from "@prisma/client";

export interface PrismaHttpError {
  status: number;
  body: {
    error: string;
    code: string;
  };
}

function getPrismaCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }

  return null;
}

function getPrismaMeta(error: unknown): Record<string, unknown> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (error.meta ?? {}) as Record<string, unknown>;
  }

  if (typeof error === "object" && error !== null && "meta" in error) {
    const meta = (error as { meta?: unknown }).meta;
    if (meta && typeof meta === "object") {
      return meta as Record<string, unknown>;
    }
  }

  return {};
}

function includesAnyTarget(target: unknown, values: string[]): boolean {
  if (Array.isArray(target)) {
    const flat = target.map((item) => String(item).toLowerCase());
    return values.some((v) => flat.includes(v.toLowerCase()));
  }

  if (typeof target === "string") {
    const lowered = target.toLowerCase();
    return values.some((v) => lowered.includes(v.toLowerCase()));
  }

  return false;
}

export function mapPrismaErrorToHttp(error: unknown): PrismaHttpError | null {
  const code = getPrismaCode(error);
  const meta = getPrismaMeta(error);
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("appointments_no_overlap_active") ||
    message.includes("conflicting key value violates exclusion constraint")
  ) {
    return {
      status: 409,
      body: { error: "Horário não disponível", code: "APPOINTMENT_CONFLICT" },
    };
  }

  if (message.includes("appointments_valid_interval_chk")) {
    return {
      status: 422,
      body: { error: "Data/hora inválida", code: "INVALID_APPOINTMENT_INTERVAL" },
    };
  }

  if (
    message.includes("barber_schedules_start_time_format_chk") ||
    message.includes("barber_schedules_end_time_format_chk") ||
    message.includes("barber_schedules_start_before_end_chk")
  ) {
    return {
      status: 422,
      body: { error: "Horários inválidos. Use HH:mm e garanta startTime < endTime.", code: "INVALID_SCHEDULE" },
    };
  }

  if (!code) return null;

  if (code === "P2002") {
    const target = meta.target;

    if (includesAnyTarget(target, ["email"])) {
      return {
        status: 409,
        body: { error: "E-mail já cadastrado", code: "UNIQUE_CONFLICT" },
      };
    }

    return {
      status: 409,
      body: { error: "Conflito de dados únicos", code: "UNIQUE_CONFLICT" },
    };
  }

  if (code === "P2004") {
    const details = String(meta.database_error ?? "");

    if (
      details.includes("appointments_no_overlap_active") ||
      details.includes("conflicting key value violates exclusion constraint")
    ) {
      return {
        status: 409,
        body: { error: "Horário não disponível", code: "APPOINTMENT_CONFLICT" },
      };
    }

    if (details.includes("appointments_valid_interval_chk")) {
      return {
        status: 422,
        body: { error: "Data/hora inválida", code: "INVALID_APPOINTMENT_INTERVAL" },
      };
    }

    if (
      details.includes("barber_schedules_start_time_format_chk") ||
      details.includes("barber_schedules_end_time_format_chk") ||
      details.includes("barber_schedules_start_before_end_chk")
    ) {
      return {
        status: 422,
        body: { error: "Horários inválidos. Use HH:mm e garanta startTime < endTime.", code: "INVALID_SCHEDULE" },
      };
    }

    return {
      status: 409,
      body: { error: "Conflito de regra de integridade", code: "CONSTRAINT_VIOLATION" },
    };
  }

  if (code === "P2003") {
    return {
      status: 409,
      body: { error: "Conflito de referência entre registros", code: "FOREIGN_KEY_CONFLICT" },
    };
  }

  if (code === "P2025") {
    return {
      status: 404,
      body: { error: "Registro não encontrado", code: "NOT_FOUND" },
    };
  }

  return null;
}
