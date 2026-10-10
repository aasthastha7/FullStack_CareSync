import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  apiSaveMood, apiGetTodaysMood, apiCreateSupportRequest,
  apiGetSupportContacts, apiGetSupportRequests, apiCancelSupportRequest,
  apiGetUpcomingShifts, apiGetStaff,
  type SupportContact, type SupportRequest, type Shift, type StaffMember,
} from "../lib/api";
import { formatPlainDate } from "../lib/utils";
import FormSection from "../components/ui/FormSection";
import ThreeDButton from "../components/ui/ThreeDButton";

const MOOD_OPTIONS = [
  { label: "Rough", emoji: "😞" },
  { label: "Okay", emoji: "😐" },
  { label: "Good", emoji: "🙂" },
  { label: "Great", emoji: "😊" },
];

const WELLNESS_TIPS = [
  {
    title: "Box Breathing (4-4-4-4)",
    body: "Inhale for 4 seconds, hold for 4, exhale for 4, hold for 4. Repeat three rounds to reset your nervous system between visits.",
  },
  {
    title: "The 2-Minute Gratitude Pause",
    body: "Before starting your car, think of one thing that went well on the last visit. Small reflections reduce cumulative stress.",
  },
  {
    title: "Peer Story: Sarah's Boundary Trick",
    body: "Sarah, a night-shift carer, keeps a 'done' list instead of a to-do list at the end of each shift. It helps her leave work at work.",
  },
];

function formatRequestType(t: string): string {
  const map: Record<string, string> = {
    mental_health_day: "Mental Health Day",
    shift_swap: "Shift Swap",
    fatigue: "Fatigue Report",
    injury: "Injury Report",
  };
  return map[t] ?? t;
}

function statusBadge(s: string): string {
  if (s === "pending") return "bg-yellow-100 text-yellow-700";
  if (s === "approved") return "bg-green-100 text-green-700";
  return "bg-gray-100 text-gray-600";
}

export default function WellbeingScreen() {
  useAppContext(); // keep context mount for RequireAuth

  const [moodToday, setMoodToday] = useState<string | null>(null);

  // Crisis contacts
  const [crisisDismissed, setCrisisDismissed] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [crisisContacts, setCrisisContacts] = useState<SupportContact[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fatigue/Injury
  const [fatigueOpen, setFatigueOpen] = useState(false);
  const [fatigueType, setFatigueType] = useState<"Fatigue" | "Injury">("Fatigue");
  const [fatigueNote, setFatigueNote] = useState("");
  const [fatigueSubmitted, setFatigueSubmitted] = useState(false);
  const [fatigueSubmitting, setFatigueSubmitting] = useState(false);
  const [fatigueError, setFatigueError] = useState<string | null>(null);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  // Mental Health Day
  const [mhdOpen, setMhdOpen] = useState(false);
  const [mhdDate, setMhdDate] = useState("");
  const [mhdSubmitting, setMhdSubmitting] = useState(false);
  const [mhdSubmitted, setMhdSubmitted] = useState(false);
  const [mhdError, setMhdError] = useState<string | null>(null);

  // Shift Swap
  const [swapOpen, setSwapOpen] = useState(false);
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [swapShiftId, setSwapShiftId] = useState("");
  const [swapStaffId, setSwapStaffId] = useState("");
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [swapSubmitted, setSwapSubmitted] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  // My Requests
  const [myRequests, setMyRequests] = useState<SupportRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Load today's mood on mount
  useEffect(() => {
    let cancelled = false;
    apiGetTodaysMood()
      .then((data) => {
        if (!cancelled) setMoodToday(data.mood);
      })
      .catch(() => {
        // 404 = no mood today — that's fine
      });
    return () => { cancelled = true; };
  }, []);

  // Load crisis contacts on mount
  useEffect(() => {
    apiGetSupportContacts()
      .then(setCrisisContacts)
      .catch(() => {});
  }, []);

  // Load my requests
  const loadRequests = useCallback(() => {
    setRequestsLoading(true);
    apiGetSupportRequests()
      .then(setMyRequests)
      .catch(() => {})
      .finally(() => setRequestsLoading(false));
  }, []);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Select mood
  async function handleMoodSelect(label: string) {
    const prev = moodToday;
    setMoodToday(label); // optimistic
    try {
      await apiSaveMood(label);
    } catch {
      setMoodToday(prev); // revert
    }
  }

  // Copy phone number
  function handleCopyPhone(contact: SupportContact) {
    navigator.clipboard.writeText(contact.phone).then(() => {
      setCopiedId(contact.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  // Mental Health Day submit
  async function handleMhdSubmit() {
    if (!mhdDate) return;
    setMhdSubmitting(true);
    setMhdError(null);
    try {
      await apiCreateSupportRequest("mental_health_day", undefined, { requested_date: mhdDate });
      setMhdSubmitted(true);
      loadRequests();
    } catch (err: unknown) {
      setMhdError((err as { detail?: string })?.detail ?? "Failed to submit.");
    } finally {
      setMhdSubmitting(false);
    }
  }

  // Open shift swap panel — load upcoming shifts + staff
  async function handleOpenSwap() {
    setSwapOpen(true);
    try {
      const [shifts, staff] = await Promise.all([
        apiGetUpcomingShifts(),
        apiGetStaff("%"),  // load all staff
      ]);
      setUpcomingShifts(shifts);
      setStaffList(staff);
    } catch {}
  }

  // Shift Swap submit
  async function handleSwapSubmit() {
    if (!swapShiftId) return;
    setSwapSubmitting(true);
    setSwapError(null);
    try {
      await apiCreateSupportRequest("shift_swap", undefined, {
        swap_shift_id: swapShiftId,
        swap_with_staff_id: swapStaffId || undefined,
      });
      setSwapSubmitted(true);
      loadRequests();
    } catch (err: unknown) {
      setSwapError((err as { detail?: string })?.detail ?? "Failed to submit.");
    } finally {
      setSwapSubmitting(false);
    }
  }

  // Cancel a pending request
  async function handleCancelRequest(requestId: string) {
    setCancellingId(requestId);
    try {
      await apiCancelSupportRequest(requestId);
      loadRequests();
    } catch {
      // silently fail
    } finally {
      setCancellingId(null);
    }
  }

  // Fatigue / Injury Submit
  async function handleFatigueSubmit() {
    setFatigueSubmitting(true);
    setFatigueError(null);
    try {
      const requestType = fatigueType === "Fatigue" ? "fatigue" : "injury";
      await apiCreateSupportRequest(requestType, fatigueNote || undefined);
      setFatigueSubmitted(true);
      loadRequests();
    } catch (err: unknown) {
      setFatigueError((err as { detail?: string })?.detail ?? "Failed to submit. Please try again.");
    } finally {
      setFatigueSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      {/* 1. Header */}
      <h1 className="mb-2 text-2xl font-bold text-gray-800">
        Caregiver Support
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Your wellbeing comes first. How can we help today?
      </p>

      {/* 2. Mood check-in */}
      <FormSection title="How are you feeling today?">
        <div className="flex gap-2">
          {MOOD_OPTIONS.map((option) => (
            <button
              key={option.label}
              onClick={() => handleMoodSelect(option.label)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-sm font-medium transition ${
                moodToday === option.label
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="text-lg">{option.emoji}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </FormSection>

      {/* 3. Crisis Support Line */}
      {!crisisDismissed && (
        <FormSection
          title="Crisis Support Line"
          subtitle="Free, confidential · Available 24/7"
          className="border-2 border-red-200 bg-red-50"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mt-4">
                <ThreeDButton
                  label="Call Now"
                  onClick={() => setCrisisOpen(!crisisOpen)}
                />
              </div>
            </div>
            <button
              onClick={() => setCrisisDismissed(true)}
              className="text-red-400 hover:text-red-600"
              aria-label="Dismiss crisis card"
            >
              ✕
            </button>
          </div>
          {crisisOpen && crisisContacts.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-red-200 pt-4">
              {crisisContacts.map((c) => (
                <div key={c.id} className="rounded-lg border border-red-200 bg-white p-3">
                  <p className="text-sm font-semibold text-red-800">{c.label}</p>
                  <p className="text-xs text-gray-500">{c.description}</p>
                  <p className="mt-1 text-sm font-mono text-gray-700">{c.phone}</p>
                  <div className="mt-2 flex gap-2">
                    <a
                      href={`tel:${c.phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      📞 Call
                    </a>
                    <button
                      onClick={() => handleCopyPhone(c)}
                      className="inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      {copiedId === c.id ? "Copied ✓" : "Copy number"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FormSection>
      )}

      {/* 4. Wellbeing Dashboard */}
      <FormSection title="Wellbeing Dashboard">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <span className="text-gray-500">Rest Balance</span>
            <span className="text-gray-800">
              3 days{" "}
              <span className="text-xs text-gray-400">(Paid days available)</span>
            </span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <span className="text-gray-500">Shift Load</span>
            <span className="text-gray-800">
              Moderate{" "}
              <span className="text-xs text-gray-400">(3 of 5 shifts this week)</span>
            </span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <span className="text-gray-500">Hours This Week</span>
            <span className="text-gray-800">24h</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <span className="text-gray-500">Overtime</span>
            <span className="text-gray-800">0h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Next Day Off</span>
            <span className="text-gray-800">Fri</span>
          </div>
        </div>
      </FormSection>

      {/* 5. Quick Actions */}
      <FormSection title="Quick Actions" subtitle="Tap an action to get started">
        <div className="-mx-5 -mb-5 divide-y divide-gray-100">
          {/* 5a. Request Mental Health Day */}
          <div>
            <button
              onClick={() => { setMhdOpen(!mhdOpen); setMhdSubmitted(false); setMhdDate(""); }}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg">🧠</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">Request Mental Health Day</p>
                <p className="text-xs text-gray-500">Pick a date. No reason needed.</p>
              </div>
              <span className="shrink-0 text-sm text-gray-400">{mhdOpen ? "▾" : "▸"}</span>
            </button>
            {mhdOpen && !mhdSubmitted && (
              <div className="px-5 pb-4 pl-[4.25rem]">
                <label className="mb-1 block text-sm font-medium text-gray-700">Select date</label>
                <input
                  type="date"
                  value={mhdDate}
                  min={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })()}
                  onChange={(e) => setMhdDate(e.target.value)}
                  className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <ThreeDButton label={mhdSubmitting ? "Submitting…" : "Submit Request"} onClick={handleMhdSubmit} disabled={!mhdDate || mhdSubmitting} loading={mhdSubmitting} />
                {mhdError && <p className="mt-2 text-sm text-red-600">{mhdError}</p>}
              </div>
            )}
            {mhdSubmitted && (
              <p className="px-5 pb-3 pl-[4.25rem] text-sm font-medium text-green-700">
                ✅ Your mental health day request has been submitted.
              </p>
            )}
          </div>

          {/* 5b. Swap Upcoming Shift */}
          <div>
            <button
              onClick={() => { if (!swapOpen) handleOpenSwap(); else setSwapOpen(false); setSwapSubmitted(false); }}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-lg">🔄</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">Swap Upcoming Shift</p>
                <p className="text-xs text-gray-500">Pick a shift and optionally a colleague.</p>
              </div>
              <span className="shrink-0 text-sm text-gray-400">{swapOpen ? "▾" : "▸"}</span>
            </button>
            {swapOpen && !swapSubmitted && (
              <div className="px-5 pb-4 pl-[4.25rem]">
                <label className="mb-1 block text-sm font-medium text-gray-700">Select shift to swap</label>
                <select value={swapShiftId} onChange={(e) => setSwapShiftId(e.target.value)} className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500">
                  <option value="">— Choose a shift —</option>
                  {upcomingShifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.shift_date} · {s.start_time}–{s.end_time} · {s.patient_name}</option>
                  ))}
                </select>
                <label className="mb-1 block text-sm font-medium text-gray-700">Swap with colleague (optional)</label>
                <select value={swapStaffId} onChange={(e) => setSwapStaffId(e.target.value)} className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500">
                  <option value="">— No preference —</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>{st.name} — {st.role}</option>
                  ))}
                </select>
                <ThreeDButton label={swapSubmitting ? "Submitting…" : "Submit Swap Request"} onClick={handleSwapSubmit} disabled={!swapShiftId || swapSubmitting} loading={swapSubmitting} />
                {swapError && <p className="mt-2 text-sm text-red-600">{swapError}</p>}
              </div>
            )}
            {swapSubmitted && (
              <p className="px-5 pb-3 pl-[4.25rem] text-sm font-medium text-green-700">
                ✅ Your shift swap request has been submitted.
              </p>
            )}
          </div>

          {/* 5c. Report Fatigue or Injury */}
          <div>
            <button
              onClick={() => {
                setFatigueOpen(!fatigueOpen);
                setFatigueSubmitted(false);
                setFatigueNote("");
                setFatigueType("Fatigue");
              }}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg">⚠️</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">Report Fatigue or Injury</p>
                <p className="text-xs text-gray-500">Notify your coordinator immediately.</p>
              </div>
              <span className="shrink-0 text-sm text-gray-400">{fatigueOpen ? "▾" : "▸"}</span>
            </button>
            {fatigueOpen && !fatigueSubmitted && (
              <div className="px-5 pb-4 pl-[4.25rem]">
                <div className="mb-3 flex gap-3">
                  {(["Fatigue", "Injury"] as const).map((opt) => (
                    <label
                      key={opt}
                      className={`flex-1 cursor-pointer rounded-full py-2 text-center text-sm font-medium transition ${
                        fatigueType === opt
                          ? "bg-orange-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="fatigue-type"
                        value={opt}
                        checked={fatigueType === opt}
                        onChange={() => setFatigueType(opt)}
                        className="hidden"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                <textarea
                  value={fatigueNote}
                  onChange={(e) => setFatigueNote(e.target.value)}
                  placeholder="Optional note…"
                  className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  rows={2}
                />
                <ThreeDButton
                  label={fatigueSubmitting ? "Submitting…" : "Submit"}
                  onClick={handleFatigueSubmit}
                  disabled={fatigueSubmitting}
                  loading={fatigueSubmitting}
                />
                {fatigueError && (
                  <p className="mt-2 text-sm text-red-600">{fatigueError}</p>
                )}
              </div>
            )}
            {fatigueSubmitted && (
              <p className="px-5 pb-3 pl-[4.25rem] text-sm font-medium text-green-700">
                ✅ Your coordinator has been notified.
              </p>
            )}
          </div>

          {/* 5d. Wellness Resources */}
          <div>
            <button
              onClick={() => setResourcesOpen(!resourcesOpen)}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg">💡</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">Wellness Resources</p>
                <p className="text-xs text-gray-500">Guides, breathing exercises &amp; peer stories</p>
              </div>
              <span className="shrink-0 text-sm text-gray-400">{resourcesOpen ? "▾" : "▸"}</span>
            </button>
            {resourcesOpen && (
              <div className="space-y-3 px-5 pb-4 pl-[4.25rem]">
                {WELLNESS_TIPS.map((tip, i) => (
                  <div key={i}>
                    <h4 className="text-sm font-semibold text-gray-700">{tip.title}</h4>
                    <p className="mt-1 text-xs text-gray-500">{tip.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </FormSection>

      {/* 6. My Requests
      <FormSection title="My Requests" subtitle="Your recent wellbeing and support requests">
        {requestsLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : myRequests.length === 0 ? (
          <p className="text-sm text-gray-400">No requests yet.</p>
        ) : (
          <div className="space-y-3">
            {myRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{formatRequestType(req.request_type)}</p>
                  <p className="text-xs text-gray-500">
                    {req.requested_date
                      ? formatPlainDate(req.requested_date)
                      : formatPlainDate(req.created_at?.split("T")[0])}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(req.status)}`}>{req.status}</span>
                  {req.status === "pending" && (
                    <button
                      onClick={() => handleCancelRequest(req.id)}
                      disabled={cancellingId === req.id}
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancellingId === req.id ? "…" : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </FormSection> */}

      <Link
        to="/dashboard"
        className="block text-center text-sm text-blue-600 hover:underline"
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
