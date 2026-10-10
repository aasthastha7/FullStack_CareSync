import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGetStaff, type StaffMember } from "../lib/api";

const DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce the typed query
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiGetStaff(debouncedQuery)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setError("Something went wrong. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const hasSearched = debouncedQuery.length > 0;

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      {/* Back arrow */}
      <button
        onClick={() => navigate("/dashboard")}
        className="mb-4 text-sm text-blue-600 hover:underline"
      >
        ← Back
      </button>

      {/* Search field */}
      <div className="mb-6 flex items-center gap-2 rounded-full bg-white px-4 py-3 shadow">
        <span className="text-gray-400">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search colleagues"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {/* Results */}
      {loading ? (
        <p className="text-center text-sm text-gray-400">Searching…</p>
      ) : error ? (
        <p className="text-center text-sm text-red-500">{error}</p>
      ) : !hasSearched ? null : results.length > 0 ? (
        <ul className="divide-y divide-gray-100 rounded-lg bg-white shadow">
          {results.map((s) => (
            <li key={s.id}>
              <Link
                to={`/staff/${s.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.role}</p>
                </div>
                <span className="text-gray-400">›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm text-gray-400">No colleagues found</p>
      )}
    </div>
  );
}
