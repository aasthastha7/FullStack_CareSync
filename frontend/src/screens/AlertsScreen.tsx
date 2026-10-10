import { useState, useEffect } from "react";
import { apiGetAlerts, apiMarkAlertRead, type Alert } from "../lib/api";
import { formatDateTime } from "../lib/utils";

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetAlerts()
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAlertClick(alert: Alert) {
    if (alert.is_read) return;
    try {
      await apiMarkAlertRead(alert.id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, is_read: true } : a))
      );
    } catch {
      // silent
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Alerts</h1>

      {loading ? (
        <p className="text-center text-sm text-gray-400">Loading alerts…</p>
      ) : alerts.length === 0 ? (
        <p className="text-center text-sm text-gray-400">No alerts right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => handleAlertClick(alert)}
              className={`rounded-lg bg-white p-4 shadow cursor-pointer transition ${
                alert.is_read ? "opacity-60" : "border-l-4 border-blue-500"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{alert.icon || "🔔"}</span>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-gray-700">{alert.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{alert.body}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {formatDateTime(alert.created_at)}
                  </p>
                </div>
                {!alert.is_read && (
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* <div className="mt-6 text-center">
        <Link to="/search" className="text-sm text-blue-600 hover:underline">Search colleagues →</Link>
      </div> */}
    </div>
  );
}
