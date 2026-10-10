import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  apiGetCurrentShift, apiUpdateTask, apiSaveReportDraft,
  type Shift, type ShiftTask,
} from "../lib/api";
import FormSection from "../components/ui/FormSection";
import IconButton from "../components/ui/IconButton";
import InputField from "../components/ui/InputField";

export default function CarePlanScreen() {
  useAppContext(); // keep context mount for RequireAuth
  const navigate = useNavigate();

  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState("");
  const [pulse, setPulse] = useState("");
  const [bp, setBp] = useState("");
  const [notes, setNotes] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGetCurrentShift()
      .then((data) => {
        if (cancelled) return;
        setShift(data);
        if (data.report) {
          setTemp(data.report.temp_f != null ? String(data.report.temp_f) : "");
          setPulse(data.report.pulse_bpm != null ? String(data.report.pulse_bpm) : "");
          setBp(data.report.bp ?? "");
          setNotes(data.report.notes ?? "");
        }
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.detail ?? "Failed to load shift.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function handleToggleTask(taskId: string, currentDone: boolean) {
    if (!shift) return;
    setShift((prev) => {
      if (!prev) return prev;
      return { ...prev, tasks: prev.tasks?.map((t) => t.id === taskId ? { ...t, done: !currentDone } : t) };
    });
    try {
      await apiUpdateTask(taskId, !currentDone);
    } catch {
      setShift((prev) => {
        if (!prev) return prev;
        return { ...prev, tasks: prev.tasks?.map((t) => t.id === taskId ? { ...t, done: currentDone } : t) };
      });
    }
  }

  const saveDraft = useCallback(async () => {
    if (!shift) return;
    setSavingDraft(true);
    setDraftSaved(false);
    try {
      await apiSaveReportDraft(shift.id, {
        temp_f: temp ? parseFloat(temp) : null,
        pulse_bpm: pulse ? parseInt(pulse, 10) : null,
        bp: bp || null,
        notes: notes || null,
      });
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch { /* silent */ } finally {
      setSavingDraft(false);
    }
  }, [shift, temp, pulse, bp, notes]);

  async function handleComplete() {
    if (!shift) return;
    await saveDraft();
    navigate("/sync", { state: { action: "shift-submit", shiftId: shift.id } });
  }

  const tasks = shift?.tasks ?? [];
  const doneCount = tasks.filter((t: ShiftTask) => t.done).length;

  if (loading) {
    return <div className="mx-auto max-w-md px-4 py-8"><p className="text-sm text-gray-400">Loading care plan…</p></div>;
  }
  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-2 text-sm text-blue-600 hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">
        {shift?.patient_name ?? "Patient"}&apos;s Care Plan
      </h1>

      <FormSection title="Tasks">
        {tasks.map((task: ShiftTask) => (
          <label key={task.id} className="flex items-start gap-2 py-1">
            <input type="checkbox" checked={task.done} onChange={() => handleToggleTask(task.id, task.done)} className="mt-1" />
            <div>
              <span className={task.done ? "line-through text-gray-400" : ""}>{task.label}</span>
              {task.medication_note && <p className="text-xs text-gray-500">{task.medication_note}</p>}
            </div>
          </label>
        ))}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Progress</span>
            <span>{doneCount} of {tasks.length} tasks complete</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0}%` }} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Vitals">
        <div className="grid grid-cols-3 gap-3">
          <InputField label="Temp (°F)" type="number" value={temp}
            onChange={(e) => setTemp(e.target.value)} onBlur={() => saveDraft()} placeholder="98.6" />
          <InputField label="Pulse (bpm)" type="number" value={pulse}
            onChange={(e) => setPulse(e.target.value)} onBlur={() => saveDraft()} placeholder="72" />
          <InputField label="BP (mmHg)" value={bp}
            onChange={(e) => setBp(e.target.value)} onBlur={() => saveDraft()} placeholder="120/80" />
        </div>
      </FormSection>

      <FormSection title="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => saveDraft()}
          className="w-full rounded border px-3 py-2 text-sm" rows={3} placeholder="Any observations or notes…" />
      </FormSection>

      <div className="mb-4 flex items-center gap-2">
        <button onClick={saveDraft} disabled={savingDraft}
          className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50">
          {savingDraft ? "Saving…" : "Save draft"}
        </button>
        {draftSaved && <span className="text-sm text-green-600">✓ Saved</span>}
      </div>

      <IconButton label="Complete Shift & Log Data" onClick={handleComplete} />
    </div>
  );
}
