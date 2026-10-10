import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { apiGetProfile, type Profile } from "../lib/api";
import ThreeDButton from "../components/ui/ThreeDButton";

export default function ProfileScreen() {
  const { clearAndLogout, userName } = useAppContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    clearAndLogout();
    navigate("/");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Profile</h1>

      {/* Caregiver card */}
      <div className="mb-6 rounded-lg bg-white p-5 shadow">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl">
            👤
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {loading ? "Loading…" : (profile?.full_name ?? userName ?? "Caregiver")}
            </h2>
            <p className="text-sm text-gray-500">
              {profile?.role ?? "Care Assistant"}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
          <p className="text-gray-600">
            <strong>Email:</strong> {profile?.email ?? "—"}
          </p>
          <p className="text-gray-600">
            <strong>Employee ID:</strong> {profile?.employee_id ?? "—"}
          </p>
          {/* <p className="text-gray-600">
            <strong>Region:</strong> {profile?.region ?? "—"}
          </p> */}
        </div>
      </div>

      {/* Privacy & data */}
      <div className="mb-6 rounded-lg bg-white p-5 shadow">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">
          Privacy &amp; data
        </h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• All data is stored securely in Supabase.</li>
          <li>• Location is used only at check-in.</li>
          <li>• No biometric data is collected.</li>
          <li>• No reason is collected for wellbeing requests.</li>
        </ul>
      </div>

      {/* Logout */}
      <ThreeDButton
        label="Clear my data and log out"
        onClick={handleLogout}
      />
    </div>
  );
}
