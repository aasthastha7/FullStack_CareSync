/**
 * Centralised API client for the CareSync frontend.
 * Every request is prefixed with /api (proxied to the backend by Vite in dev).
 */

const TOKEN_KEY = "caresync_access_token";
const USER_KEY = "caresync_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getStoredUser(): { id: string; email: string; full_name: string } | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export function storeUser(user: { id: string; email: string; full_name: string }): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${apiBase}/api${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try { const body = await res.json(); detail = body.detail ?? JSON.stringify(body); } catch { /* noop */ }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

// ---- Auth ----
export interface LoginResponse {
  access_token: string; token_type: string;
  user: { id: string; email: string; full_name: string };
}
export interface Profile {
  id: string; full_name: string | null; email: string | null;
  role: string | null; employee_id: string | null; region: string | null;
  timezone: string | null; created_at: string | null;
}
export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}
export async function apiSignup(
  email: string,
  password: string,
  full_name: string,
  role?: string,
  employee_id?: string,
) {
  return request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name, role, employee_id: employee_id || undefined }),
  });
}
export async function apiGetProfile(): Promise<Profile> {
  return request<Profile>("/me");
}

// ---- Shifts ----
export interface Shift {
  id: string; patient_name: string; start_time: string; end_time: string;
  address: string | null; task: string | null; duration: string | null;
  priority: string | null; shift_date: string; checked_in_at: string | null; status: string;
  tasks?: ShiftTask[]; report?: ShiftReport | null;
}
export interface ShiftTask { id: string; label: string; medication_note: string | null; done: boolean; }
export interface ShiftReport {
  id: string; temp_f: number | null; pulse_bpm: number | null;
  bp: string | null; notes: string | null; status: string; submitted_at: string | null;
}
export async function apiGetShifts(shiftDate?: string): Promise<Shift[]> {
  const qs = shiftDate ? `?shift_date=${shiftDate}` : "";
  return request<Shift[]>(`/shifts${qs}`);
}
export async function apiGetShift(shiftId: string): Promise<Shift> {
  return request<Shift>(`/shifts/${shiftId}`);
}
export async function apiToggleTask(shiftId: string, taskId: string): Promise<ShiftTask> {
  return request<ShiftTask>(`/shifts/${shiftId}/tasks/${taskId}/toggle`, { method: "POST" });
}
export async function apiSaveReport(shiftId: string, data: { temp_f?: number; pulse_bpm?: number; bp?: string; notes?: string; submit?: boolean }) {
  return request(`/shifts/${shiftId}/report`, { method: "POST", body: JSON.stringify(data) });
}

// ---- Staff ----
export interface StaffMember {
  id: string; name: string; role: string; employee_id: string; email: string; phone: string;
  date_joined: string; employment_type: string; supervisor: string;
  last_activity: string; last_login: string; patients_attended: number;
  current_status: string; total_tasks: number; average_time: string; completion_rate: string;
  present_days: number; absent_days: number; late_days: number;
  present_percent: number; punctuality_percent: number;
  attendance?: { work_date: string; status: string }[];
}
export async function apiGetStaff(q?: string): Promise<StaffMember[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return request<StaffMember[]>(`/staff${qs}`);
}
export async function apiGetStaffMember(staffId: string): Promise<StaffMember> {
  return request<StaffMember>(`/staff/${staffId}`);
}
export async function apiUpdateStaff(staffId: string, data: { email?: string; phone?: string }) {
  return request(`/staff/${staffId}`, { method: "PATCH", body: JSON.stringify(data) });
}

// ---- Chat ----
export interface ChatMessage {
  id: string;
  user_id: string;
  staff_id: string;
  sender: "caregiver" | "colleague";
  text: string;
  created_at: string;
}
export async function apiGetChatMessages(staffId: string): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/chat/${staffId}`);
}
export async function apiSendChatMessage(staffId: string, text: string): Promise<ChatMessage> {
  return request<ChatMessage>(`/chat/${staffId}`, { method: "POST", body: JSON.stringify({ text }) });
}

// ---- Alerts ----
export interface Alert { id: string; icon: string; title: string; body: string; is_read: boolean; created_at: string; }
export async function apiGetAlerts(): Promise<Alert[]> { return request<Alert[]>("/alerts"); }

// ---- Mood ----
export async function apiSaveMood(mood: string) {
  return request("/mood", { method: "POST", body: JSON.stringify({ mood }) });
}

// ---- Caregiver workflow ----
export async function apiGetCurrentShift(): Promise<Shift> {
  return request<Shift>("/shifts/current");
}

export async function apiCheckIn(
  shiftId: string,
  coords?: { lat: number; lng: number },
): Promise<{ id: string; checked_in_at: string; checked_in_lat: number | null; checked_in_lng: number | null }> {
  const body = coords ? JSON.stringify({ lat: coords.lat, lng: coords.lng }) : undefined;
  return request(`/shifts/${shiftId}/check-in`, {
    method: "POST",
    ...(body ? { body } : {}),
  });
}

export async function apiUpdateTask(taskId: string, done: boolean): Promise<ShiftTask> {
  return request<ShiftTask>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ done }),
  });
}

export async function apiSaveReportDraft(
  shiftId: string,
  data: { temp_f?: number | null; pulse_bpm?: number | null; bp?: string | null; notes?: string | null },
): Promise<ShiftReport> {
  return request<ShiftReport>(`/shifts/${shiftId}/report`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function apiSubmitShift(shiftId: string): Promise<ShiftReport> {
  return request<ShiftReport>(`/shifts/${shiftId}/submit`, { method: "POST" });
}

export async function apiGetTodaysMood(): Promise<{ id: string; mood: string; created_at: string }> {
  return request("/mood/today");
}

export async function apiCreateSupportRequest(
  requestType: string,
  note?: string,
  extra?: { requested_date?: string; swap_shift_id?: string; swap_with_staff_id?: string },
) {
  return request("/support-requests", {
    method: "POST",
    body: JSON.stringify({
      request_type: requestType,
      note: note ?? undefined,
      requested_date: extra?.requested_date,
      swap_shift_id: extra?.swap_shift_id,
      swap_with_staff_id: extra?.swap_with_staff_id,
    }),
  });
}

export async function apiMarkAlertRead(alertId: string): Promise<Alert> {
  return request<Alert>(`/alerts/${alertId}/read`, { method: "PATCH" });
}

// ---- Support Contacts (crisis) ----
export interface SupportContact {
  id: string;
  label: string;
  phone: string;
  description: string | null;
  is_crisis: boolean;
}
export async function apiGetSupportContacts(): Promise<SupportContact[]> {
  return request<SupportContact[]>("/support-contacts");
}

// ---- Support Requests ----
export interface SupportRequest {
  id: string;
  request_type: string;
  note: string | null;
  status: "pending" | "approved" | "declined";
  requested_date: string | null;
  swap_shift_id: string | null;
  swap_with_staff_id: string | null;
  decided_at: string | null;
  created_at: string;
}
export async function apiGetSupportRequests(): Promise<SupportRequest[]> {
  return request<SupportRequest[]>("/support-requests");
}
export async function apiCancelSupportRequest(requestId: string): Promise<SupportRequest> {
  return request<SupportRequest>(`/support-requests/${requestId}/cancel`, { method: "PATCH" });
}

// ---- Upcoming Shifts ----
export async function apiGetUpcomingShifts(): Promise<Shift[]> {
  return request<Shift[]>("/shifts/upcoming");
}