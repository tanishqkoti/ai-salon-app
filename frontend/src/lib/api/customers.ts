export type CreateCustomerPayload = {
  name: string;
  email: string;
  phone: string;
  preferred_stylist: string;
};

export type CustomerApiRecord = CreateCustomerPayload & {
  id: string;
  salon_id: string;
  visits: number;
  total_spent: number;
  loyalty_points: number;
  last_visit: string | null;
  status: string;
  service_history: string[];
  created_at?: string | null;
  updated_at?: string | null;
  is_active: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
};

export type CustomerListResponse = {
  count: number;
  customers: CustomerApiRecord[];
};

export async function getCustomers(): Promise<CustomerListResponse> {
  const response = await fetch("/api/salon/customers", {
    method: "GET",
    cache: "no-store",
  });
  const result = (await response.json()) as { detail?: string; count?: number; customers?: CustomerApiRecord[] };
  if (!response.ok || typeof result.count !== "number" || !result.customers) {
    throw new Error(result.detail || "Unable to load customers.");
  }
  return { count: result.count, customers: result.customers };
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<{ id: string; customer: CustomerApiRecord }> {
  const response = await fetch("/api/salon/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { detail?: string; id?: string; customer?: CustomerApiRecord };
  if (!response.ok || !result.customer || !result.id) throw new Error(result.detail || "Unable to create customer.");
  return { id: result.id, customer: result.customer };
}

export async function archiveCustomer(id: string): Promise<{ id: string; customer: CustomerApiRecord }> {
  const response = await fetch(`/api/salon/customers?customer_id=${encodeURIComponent(id)}`, { method: "PATCH", cache: "no-store" });
  const result = (await response.json()) as { detail?: string; id?: string; customer?: CustomerApiRecord };
  if (!response.ok || !result.customer || !result.id) throw new Error(result.detail || "Unable to archive customer.");
  return { id: result.id, customer: result.customer };
}
