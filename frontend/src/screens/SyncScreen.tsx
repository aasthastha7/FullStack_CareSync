import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiSubmitShift, apiCreateSupportRequest, apiGetCurrentShift, type Shift } from "../lib/api";
import { formatTime } from "../lib/utils";
import FormSection from "../components/ui/FormSection";
import ThreeDButton from "../components/ui/ThreeDButton";

type SyncStatus = "idle" | "syncing" | "success" | "failed";

interface ShiftSubmitAction { action: "shift-submit"; shiftId: string }
interface SupportRequestAction { action: "support-request"; requestType: string }
type PendingAction = ShiftSubmitAction | SupportRequestAction;

export default function SyncScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingAction = (location.state as PendingAction | null) ?? null;

  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [shiftData, setShiftData] = useState<Shift | null>(null);
  const hasRun = useRef(false);

  const runAction = useCallback(async () => {
    if (!pendingAction) return;
    setStatus("syncing");
    setError(null);
    try {
      if (pendingAction.action === "shift-submit") {
        await apiSubmitShift(pendingAction.shiftId);
        try { const shift = await apiGetCurrentShift(); setShiftData(shift); } catch { /* best effort */ }
      } else {
        await apiCreateSupportRequest(pendingAction.requestType);
      }
      setSyncedAt(formatTime(new Date().toISOString()));
      setStatus("success");
    } catch (err: unknown) {
      setError((err as { detail?: string })?.detail ?? "Something went wrong.");
      setStatus("failed");
    }
  }, [pendingAction]);

  useEffect(() => {
    if (!hasRun.current && status === "idle" && pendingAction) {
      hasRun.current = true;
      runAction();
    }
  }, [status, pendingAction, runAction]);

  if (!pendingAction) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow">
          <p className="mb-2 text-4xl">⚠️</p>
          <h1 className="mb-2 text-xl font-bold text-gray-800">No Pending Action</h1>
          <p className="mb-6 text-sm text-gray-600">There is nothing to sync right now.</p>
          <ThreeDButton label="Back to Dashboard" onClick={() => navigate("/dashboard")} />
        </div>
      </div>
    );
  }

  const isShift = pendingAction.action === "shift-submit";
  const syncingLabel = isShift ? "shift data" : "support request";
  const tasks = shiftData?.tasks ?? [];
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {status === "syncing" && (
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-gray-600">Syncing your {syncingLabel}…</p>
        </div>
      )}

      {status === "success" && isShift && (
        <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow">
          <p className="mb-2 text-4xl">✅</p>
          <h1 className="mb-2 text-xl font-bold text-gray-800">Shift Completed</h1>
          <span className="mb-4 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Shift Logged Successfully</span>
          <p className="mb-6 text-sm text-gray-600">
            {shiftData?.patient_name ?? "Patient"}&apos;s care plan was successfully submitted.
          </p>
          <FormSection title="Shift Summary" className="mb-6 border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Shift Summary</span>
              <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Synced</span>
            </div>
            {shiftData?.checked_in_at && (
              <div className="flex justify-between border-t border-gray-200 py-2">
                <span className="text-xs text-gray-500">Location</span>
                <span className="text-xs text-gray-700">Verified via GPS</span>
              </div>
            )}
            {tasks.length > 0 && (
              <div className="flex justify-between border-t border-gray-200 py-2">
                <span className="text-xs text-gray-500">Clinical Tasks</span>
                <span className="text-xs text-gray-700">{doneCount} / {tasks.length} Completed</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 py-2">
              <span className="text-xs text-gray-500">EHR Sync</span>
              <span className="text-xs text-gray-700">Successful at {syncedAt}</span>
            </div>
          </FormSection>
          <ThreeDButton label="Return to Daily Schedule" onClick={() => navigate("/dashboard")} />
        </div>
      )}

      {status === "success" && !isShift && (
        <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow">
          <p className="mb-2 text-4xl">✅</p>
          <h1 className="mb-2 text-xl font-bold text-gray-800">
            {pendingAction.requestType === "mental_health_day" ? "Mental Health Day Requested" : "Shift Swap Requested"}
          </h1>
          <span className="mb-4 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Request Submitted</span>
          <p className="mb-6 text-sm text-gray-600">
            {pendingAction.requestType === "mental_health_day"
              ? "Your request has been sent to the coordinator. No reason is needed. You will be notified once it is confirmed."
              : "Your request has been sent to the coordinator. You will be notified once peer coverage is found."}
          </p>
          <ThreeDButton label="Back to Dashboard" onClick={() => navigate("/dashboard")} />
        </div>
      )}

      {status === "failed" && (
        <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow">
          <p className="mb-2 text-4xl">❌</p>
          <h1 className="mb-2 text-xl font-bold text-red-700">{isShift ? "Sync Failed" : "Request Failed"}</h1>
          <p className="mb-6 text-sm text-gray-600">{error ?? "Something went wrong. Please try again."}</p>
          <div className="flex flex-col gap-3">
            <ThreeDButton label="Retry" onClick={() => { hasRun.current = false; setStatus("idle"); }} />
            <button onClick={() => navigate("/dashboard")} className="text-sm text-blue-600 hover:underline">Cancel and go back</button>
          </div>
        </div>
      )}
    </div>
  );
}
