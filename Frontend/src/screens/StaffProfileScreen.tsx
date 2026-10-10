import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGetStaffMember, apiUpdateStaff, type StaffMember } from "../lib/api";
import { useAppContext } from "../context/AppContext";
import { formatPlainDate } from "../lib/utils";
import ThreeDButton from "../components/ui/ThreeDButton";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4 text-center shadow">
      <p className="text-xl font-bold text-gray-800">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

function PercentRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-gray-700">{value}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function StaffProfileScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { staffEdits, updateStaffDetails } = useAppContext();

  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");

  useEffect(() => {
    if (!id) return;
    apiGetStaffMember(id).then(setStaff).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="mx-auto max-w-md px-4 py-8"><p className="text-gray-500">Loading…</p></div>;
  if (!staff) return (
    <div className="mx-auto max-w-md px-4 py-8">
      <p className="text-gray-500">Staff member not found.</p>
      <button onClick={() => navigate("/search")} className="mt-4 text-sm text-blue-600 hover:underline">← Back to Search</button>
    </div>
  );

  const overrides = staffEdits[staff.id];
  const email = overrides?.email ?? staff.email;
  const phone = overrides?.phone ?? staff.phone;

  function startEdit() { setEmailDraft(email); setPhoneDraft(phone); setEditing(true); }
  async function saveEdit() {
    if (staff) {
      updateStaffDetails(staff.id, emailDraft, phoneDraft);
      try { await apiUpdateStaff(staff.id, { email: emailDraft, phone: phoneDraft }); } catch { /* noop */ }
    }
    setEditing(false);
  }

  const attendance = staff.attendance ?? [];
  const recentDays = attendance.slice(0, 6);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <button onClick={() => navigate("/search")} className="mb-4 text-sm text-blue-600 hover:underline">← Back</button>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{staff.name}</h1>
          <p className="text-sm text-gray-500">{staff.role}</p>
        </div>
        <ThreeDButton label="Send Message" onClick={() => navigate(`/chat/${staff.id}`)} />
      </div>
      <div className="mb-6 rounded-lg bg-white p-5 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-700">Personal Details</h2>
          {!editing && <button onClick={startEdit} className="text-xs font-medium text-blue-600 hover:underline">Edit Details</button>}
        </div>
        {editing ? (
          <div className="space-y-3">
            <label className="block"><span className="text-xs text-gray-500">Email</span><input type="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
            <label className="block"><span className="text-xs text-gray-500">Phone</span><input type="tel" value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
            <div className="flex gap-2">
              <ThreeDButton label="Save" type="submit" onClick={saveEdit} />
              <ThreeDButton label="Cancel" variant="secondary" onClick={() => setEditing(false)} />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <DetailRow label="Employee ID" value={staff.employee_id} />
            <DetailRow label="Email" value={email} />
            <DetailRow label="Phone" value={phone} />
            <DetailRow label="Date Joined" value={staff.date_joined} />
            <DetailRow label="Employment Type" value={staff.employment_type} />
            <DetailRow label="Supervisor" value={staff.supervisor} />
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mb-6 rounded-lg bg-white p-5 shadow">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">Recent Activity</h2>
        <div className="space-y-2 text-sm">
          <DetailRow label="Last Activity" value={staff.last_activity} />
          <DetailRow label="Last Login" value={staff.last_login} />
          <DetailRow label="Patients Attended" value={String(staff.patients_attended)} />
          <DetailRow label="Current Status" value={staff.current_status} />
        </div>
      </div>

      {/* Stat boxes */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatBox label="Total Tasks" value={String(staff.total_tasks)} />
        <StatBox label="Average Time" value={staff.average_time} />
        <StatBox label="Completion Rate" value={staff.completion_rate} />
      </div>

      {/* Attendance Records */}
      <div className="mb-6 rounded-lg bg-white p-5 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-700">Attendance Records</h2>
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div><p className="text-2xl font-bold text-green-600">{staff.present_days}</p><p className="text-xs text-gray-500">Present</p></div>
          <div><p className="text-2xl font-bold text-red-600">{staff.absent_days}</p><p className="text-xs text-gray-500">Absent</p></div>
          <div><p className="text-2xl font-bold text-yellow-600">{staff.late_days}</p><p className="text-xs text-gray-500">Late</p></div>
        </div>
        <div className="mb-4 space-y-2">
          <PercentRow label="Present" value={staff.present_percent} color="bg-green-500" />
          <PercentRow label="Punctuality" value={staff.punctuality_percent} color="bg-blue-500" />
        </div>
        {recentDays.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-gray-500">Last 6 days</p>
            <div className="flex flex-wrap gap-2">
              {recentDays.map((day, i) => (
                <span key={i} className={`rounded-full px-3 py-1 text-xs font-medium ${day.status === "Present" ? "bg-green-100 text-green-700" : day.status === "Late" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                  {formatPlainDate(day.work_date)} — {day.status}
                </span>
              ))}
            </div>
          </div>
        )}
        <ThreeDButton label="View Attendance History" variant="secondary" onClick={() => navigate(`/staff/${staff.id}/attendance`)} />
      </div>
    </div>
  );
}