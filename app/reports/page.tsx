"use client";

import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Report = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  severity: string;
  description: string | null;
  photoUrl: string | null;
  status: string;
  submittedAt: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-800",
  reviewed: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
};

// BUG-H06: API contract uses "normal" not "info" — keep both keys so old
// records stored before this fix continue to render correctly.
const SEVERITY_STYLES: Record<string, string> = {
  normal:   "bg-blue-100 text-blue-800",
  info:     "bg-blue-100 text-blue-800",   // backward-compat alias
  warning:  "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

function formatTime(isoString: string | null): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-MY", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function ReportsPage() {
  const { isDark } = useTheme();
  const { accessToken } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const url = filterStatus ? `/api/reports?status=${filterStatus}` : "/api/reports";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed");
      setReports(await res.json());
    } catch {
      setReports([]);
      toast.error("Failed to load reports. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, filterStatus]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  async function updateStatus(id: string, status: string) {
    if (!accessToken) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/reports/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated: Report = await res.json();
      setReports(prev => prev.map(r => r.id === id ? updated : r));
    } catch {
      toast.error("Failed to update report status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  const bg    = isDark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900";
  const card  = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const th    = isDark ? "bg-gray-750 text-gray-300 border-gray-700" : "bg-gray-50 text-gray-600 border-gray-200";
  const sel   = isDark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-white border-gray-300 text-gray-900";

  const pending  = reports.filter(r => r.status === "pending").length;
  const resolved = reports.filter(r => r.status === "resolved").length;

  return (
    <div className={`min-h-screen p-6 ${bg}`}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Incident Reports</h1>
            <p className={`text-sm mt-1 ${muted}`}>Review and action community flood incident submissions</p>
          </div>
          <div className="flex gap-3 text-center">
            <div className={`rounded-lg border px-4 py-2 ${card}`}>
              <p className="text-lg font-bold text-amber-500">{pending}</p>
              <p className={`text-xs ${muted}`}>Pending</p>
            </div>
            <div className={`rounded-lg border px-4 py-2 ${card}`}>
              <p className="text-lg font-bold text-green-500">{resolved}</p>
              <p className={`text-xs ${muted}`}>Resolved</p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${sel}`}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
          </select>
          <span className={`text-sm ${muted}`}>{reports.length} reports</span>
        </div>

        {/* Table */}
        <div className={`rounded-xl border overflow-hidden ${card}`}>
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <p className={`p-8 text-center text-sm ${muted}`}>No reports found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-left text-xs uppercase tracking-wide ${th}`}>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit">
                  {reports.map(r => (
                    // UX-S4-02: dark-mode hover now uses white/5 so it is visible
                    <tr key={r.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{formatTime(r.submittedAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${SEVERITY_STYLES[r.severity] ?? "bg-gray-100 text-gray-700"}`}>
                          {r.severity}
                        </span>
                      </td>
                      {/* BUG-S4-03: coordinates now link to Google Maps */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <a
                          href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-500 hover:text-orange-600 underline underline-offset-2 transition-colors"
                        >
                          {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)} 📍
                        </a>
                      </td>
                      {/* UX-S4-02: title tooltip shows full description on hover */}
                      <td className={`px-4 py-3 max-w-xs truncate ${muted}`} title={r.description ?? ""}>
                        {r.description ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status !== "resolved" && (
                          <div className="flex gap-2">
                            {r.status === "pending" && (
                              <button
                                disabled={updatingId === r.id}
                                onClick={() => updateStatus(r.id, "reviewed")}
                                className="px-2 py-1 text-xs font-medium rounded-md bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors"
                              >
                                Review
                              </button>
                            )}
                            <button
                              disabled={updatingId === r.id}
                              onClick={() => updateStatus(r.id, "resolved")}
                              className="px-2 py-1 text-xs font-medium rounded-md bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
