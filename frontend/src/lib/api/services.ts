export type CreateServicePayload = {
  name: string;
  duration_minutes: number;
  price: number;
  status: string;
  staff: string[];
};

export type ServiceApiRecord = CreateServicePayload & {
  id: string;
  salon_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  is_active: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
};

export type ServiceListResponse = { count: number; services: ServiceApiRecord[] };

export async function getServices(): Promise<ServiceListResponse> {
  const response = await fetch("/api/salon/services?active_only=false", { method: "GET", cache: "no-store" });
  const result = (await response.json()) as { detail?: string; count?: number; services?: ServiceApiRecord[] };
  if (!response.ok || typeof result.count !== "number" || !result.services) {
    throw new Error(result.detail || "Unable to load services.");
  }
  return { count: result.count, services: result.services };
}

export async function createService(payload: CreateServicePayload): Promise<{ id: string; service: ServiceApiRecord }> {
  const response = await fetch("/api/salon/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { detail?: string; id?: string; service?: ServiceApiRecord };
  if (!response.ok || !result.service || !result.id) throw new Error(result.detail || "Unable to create service.");
  return { id: result.id, service: result.service };
}

export async function archiveService(id: string): Promise<{ id: string; service: ServiceApiRecord }> {
  const response = await fetch(`/api/salon/services?service_id=${encodeURIComponent(id)}`, { method: "PATCH", cache: "no-store" });
  const result = (await response.json()) as { detail?: string; id?: string; service?: ServiceApiRecord };
  if (!response.ok || !result.service || !result.id) throw new Error(result.detail || "Unable to archive service.");
  return { id: result.id, service: result.service };
}

export type PublicServiceRecord = { id: string; name: string; duration_minutes: number; price: number; is_active: boolean };

const BACKEND_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8010";

export async function getPublicServices(salonId: string): Promise<PublicServiceRecord[]> {
  const query = new URLSearchParams({ salon_id: salonId });
  const response = await fetch(`${BACKEND_API_BASE_URL}/services/public?${query.toString()}`, { cache: "no-store" });
  const result = (await response.json()) as { detail?: string; count?: number; services?: PublicServiceRecord[] };
  if (!response.ok || typeof result.count !== "number" || !result.services) {
    throw new Error(result.detail || "Unable to load salon services.");
  }
  return result.services;
}
