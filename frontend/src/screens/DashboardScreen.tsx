import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { apiGetCurrentShift, apiCheckIn, type Shift } from "../lib/api";
import { formatTime, formatShiftTime } from "../lib/utils";
import FormSection from "../components/ui/FormSection";
import ThreeDButton from "../components/ui/ThreeDButton";
import IconButton from "../components/ui/IconButton";

export default function DashboardScreen() {
  const { userName } = useAppContext();
  const navigate = useNavigate();

  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGetCurrentShift()
      .then((data) => {
        if (!cancelled) {
          setShift(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.detail ?? "Failed to load shift.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function handleCheckIn() {
    if (!shift || shift.checked_in_at) return;
    setCheckingIn(true);
    setLocationError(null);

    let coords: { lat: number; lng: number } | undefined;

    // Attempt to get GPS position
    if ("geolocation" in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          });
        });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (geoErr: unknown) {
        const code = (geoErr as GeolocationPositionError)?.code;
        if (code === 1) {
          setLocationError("Location permission denied. Checking in without location.");
        } else if (code === 2) {
          setLocationError("Location unavailable. Checking in without location.");
        } else {
          setLocationError("Location request timed out. Checking in without location.");
        }
      }
    } else {
      setLocationError("Geolocation is not supported by this browser. Checking in without location.");
    }

    try {
      const res = await apiCheckIn(shift.id, coords);
      setShift((prev) =>
        prev ? { ...prev, checked_in_at: res.checked_in_at } : prev,
      );
    } catch {
      // silently fail — button remains enabled for retry
    } finally {
      setCheckingIn(false);
    }
  }

  const patient = shift?.patient_name ?? "No shift assigned";
  const time = shift ? `${formatShiftTime(shift.start_time)} – ${formatShiftTime(shift.end_time)}` : "—";
  const address = shift?.address ?? "—";
  const task = shift?.task ?? "—";
  const duration = shift?.duration ?? "—";
  const priority = shift?.priority ?? "Normal";

  const checkedInAt = shift?.checked_in_at
    ? formatTime(shift.checked_in_at)
    : null;

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">
        Good Morning, {userName || "Caregiver"}
      </h1>

      {/* Shift card */}
      <FormSection title="Current Shift">
        {loading ? (
          <p className="text-sm text-gray-400">Loading shift…</p>
        ) : error ? (
          <div>
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              <strong>Patient:</strong> {patient}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Time:</strong> {time}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Address:</strong> {address}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Task:</strong> {task}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Duration:</strong> {duration}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Priority:</strong>{" "}
              <span className={`font-semibold ${priority === "High" ? "text-red-600" : "text-yellow-600"}`}>
                {priority}
              </span>
            </p>
          </>
        )}
      </FormSection>

      {/* GPS check-in */}
      <div className="mb-6 rounded-lg bg-white p-5 shadow text-center">
        <ThreeDButton
          label={checkingIn ? "Checking in…" : "Check in via GPS"}
          onClick={handleCheckIn}
          disabled={checkedInAt !== null || checkingIn}
          loading={checkingIn}
        />
        {checkedInAt && (
          <p className="mt-3 text-sm text-green-700">
            ✅ Checked in at {checkedInAt}
          </p>
        )}
        {locationError && (
          <p className="mt-2 text-sm text-amber-600">{locationError}</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          Location is used only at check-in
        </p>
      </div>

      {/* Caregiver Support */}
      <FormSection title="Caregiver Support" subtitle="Need to request time off or swap a shift? We're here to help.">
        <ThreeDButton
          label="Open Wellbeing Support"
          variant="secondary"
          onClick={() => navigate("/wellbeing")}
        />
      </FormSection>

      {/* Navigation links */}
      <div className="flex flex-col gap-3">
        <IconButton
          label="Go to Care Plan"
          onClick={() => navigate("/care-plan")}
        />
      </div>
    </div>
  );
}
