import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGetStaffMember, type StaffMember } from "../lib/api";
import { formatPlainDate } from "../lib/utils";

export default function AttendanceScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiGetStaffMember(id).then(setStaff).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="mx-auto max-w-md px-4 py-8"><p className="text-gray-500">Loading…</p></div>;

  if (!staff) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <p className="text-gray-500">Staff member not found.</p>
        <button onClick={() => navigate("/search")} className="mt-4 text-sm text-blue-600 hover:underline">← Back to Search</button>
      </div>
    );
  }

  const attendance = staff.attendance ?? [];

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <button onClick={() => navigate(`/staff/${staff.id}`)} className="mb-4 text-sm text-blue-600 hover:underline">← Back</button>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Attendance History</h1>
      <div className="rounded-lg bg-white shadow">
        {attendance.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No attendance records found.</p>
        ) : (
          attendance.map((day, i) => (
            <div key={i} className="flex items-center justify-between border-b border-gray-100 px-5 py-3 last:border-b-0">
              <span className="text-sm text-gray-700">
                {formatPlainDate(day.work_date)}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${day.status === "Present" ? "bg-green-100 text-green-700" : day.status === "Late" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                {day.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
