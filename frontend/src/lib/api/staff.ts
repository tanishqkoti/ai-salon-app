export type CreateStaffPayload = {
  name: string;
  role: string;
  speciality: string;
  phone: string;
  services: string[];
  today_hours: string;
  weekly_hours: string;
};

export type StaffApiRecord = CreateStaffPayload & {
  id: string;
  salon_id: string;
  rating: number;
  status: string;
  color: string;
  created_at?: string | null;
  updated_at?: string | null;
  is_active: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
  service_ids?: string[];
};

export type UpdateStaffPayload = {
  name: string;
  role: string;
  speciality: string;
  phone: string;
  service_ids: string[];
  today_hours: string;
  weekly_hours: string;
  is_active: boolean;
  status: string;
};

export type StaffListResponse = { count: number; staff: StaffApiRecord[] };

export async function getStaff(): Promise<StaffListResponse> {
  const response = await fetch("/api/salon/staff?active_only=false", { method: "GET", cache: "no-store" });
  const result = (await response.json()) as { detail?: string; count?: number; staff?: StaffApiRecord[] };
  if (!response.ok || typeof result.count !== "number" || !result.staff) {
    throw new Error(result.detail || "Unable to load staff members.");
  }
  return { count: result.count, staff: result.staff };
}

export async function getEligibleStaff(serviceId: string, excludeStaffId?: string): Promise<StaffListResponse> {
  const query = new URLSearchParams({ active_only: "true", service_id: serviceId });
  if (excludeStaffId) query.set("exclude_staff_id", excludeStaffId);
  const response = await fetch(`/api/salon/staff?${query.toString()}`, { method: "GET", cache: "no-store" });
  const result = (await response.json()) as { detail?: string; count?: number; staff?: StaffApiRecord[] };
  if (!response.ok || typeof result.count !== "number" || !result.staff) {
    throw new Error(result.detail || "Unable to load eligible stylists.");
  }
  return { count: result.count, staff: result.staff };
}

export async function createStaff(payload: CreateStaffPayload): Promise<{ id: string; staff: StaffApiRecord }> {
  const response = await fetch("/api/salon/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { detail?: string; id?: string; staff?: StaffApiRecord };
  if (!response.ok || !result.staff || !result.id) throw new Error(result.detail || "Unable to create staff member.");
  return { id: result.id, staff: result.staff };
}

export async function deactivateStaff(id: string): Promise<{ id: string; staff: StaffApiRecord }> {
  const response = await fetch(`/api/salon/staff?staff_id=${encodeURIComponent(id)}`, { method: "PATCH", cache: "no-store" });
  const result = (await response.json()) as { detail?: string; id?: string; staff?: StaffApiRecord };
  if (!response.ok || !result.staff || !result.id) throw new Error(result.detail || "Unable to deactivate staff member.");
  return { id: result.id, staff: result.staff };
}

export async function updateStaffStatus(id: string, status: string): Promise<{ id: string; staff: StaffApiRecord }> {
  const response = await fetch(`/api/salon/staff?staff_id=${encodeURIComponent(id)}&action=status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });
  const result = (await response.json()) as { detail?: string; id?: string; staff?: StaffApiRecord };
  if (!response.ok || !result.staff || !result.id) throw new Error(result.detail || "Unable to update staff status.");
  return { id: result.id, staff: result.staff };
}

export async function updateStaff(id: string, payload: UpdateStaffPayload): Promise<{ id: string; staff: StaffApiRecord }> {
  const response = await fetch(`/api/salon/staff?staff_id=${encodeURIComponent(id)}&action=update`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { detail?: string; id?: string; staff?: StaffApiRecord };
  if (!response.ok || !result.staff || !result.id) throw new Error(result.detail || "Unable to update staff member.");
  return { id: result.id, staff: result.staff };
}
