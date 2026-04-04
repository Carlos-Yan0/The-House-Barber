import { appointmentsApi } from "@/lib/api";
import type { AvailabilityResponse } from "@/types";

export type AvailabilitySocketQuery = {
  barberId: string;
  date: string;
  serviceId: string;
};

type AvailabilitySocketMessage =
  | (AvailabilityResponse & { type: "availability" })
  | { type: "error"; error: string; status?: number };

type AvailabilitySocketHandlers = {
  onAvailability: (payload: AvailabilityResponse) => void;
  onSocketUnavailable: () => void;
  onErrorMessage?: (message: string) => void;
};

function getAvailabilitySocketUrl(query: AvailabilitySocketQuery): string {
  const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
  const wsBaseUrl = baseUrl.startsWith("https://")
    ? `wss://${baseUrl.slice("https://".length)}`
    : baseUrl.startsWith("http://")
    ? `ws://${baseUrl.slice("http://".length)}`
    : baseUrl;

  const url = new URL(`${wsBaseUrl}/appointments/availability/ws`);
  url.searchParams.set("barberId", query.barberId);
  url.searchParams.set("date", query.date);
  url.searchParams.set("serviceId", query.serviceId);
  return url.toString();
}

export async function fetchAvailabilityHttp(
  query: AvailabilitySocketQuery
): Promise<AvailabilityResponse> {
  const response = await appointmentsApi.getAvailability(
    query.barberId,
    query.date,
    query.serviceId
  );
  return response.data as AvailabilityResponse;
}

export function connectAvailabilitySocket(
  query: AvailabilitySocketQuery,
  handlers: AvailabilitySocketHandlers
): () => void {
  let didFallback = false;
  let closedByClient = false;

  const fallback = () => {
    if (didFallback) return;
    didFallback = true;
    handlers.onSocketUnavailable();
  };

  const socket = new WebSocket(getAvailabilitySocketUrl(query));

  socket.onmessage = (event) => {
    let payload: AvailabilitySocketMessage | null = null;
    if (typeof event.data !== "string") return;

    try {
      payload = JSON.parse(event.data) as AvailabilitySocketMessage;
    } catch {
      return;
    }

    if (!payload || typeof payload !== "object" || !("type" in payload)) return;

    if (payload.type === "availability") {
      handlers.onAvailability({
        slots: payload.slots,
        date: payload.date,
        barberId: payload.barberId,
        serviceId: payload.serviceId,
      });
      return;
    }

    if (payload.type === "error" && typeof payload.error === "string") {
      handlers.onErrorMessage?.(payload.error);
    }
  };

  socket.onerror = () => {
    if (closedByClient) return;
    fallback();
  };

  socket.onclose = () => {
    if (closedByClient) return;
    fallback();
  };

  return () => {
    closedByClient = true;
    socket.close();
  };
}
