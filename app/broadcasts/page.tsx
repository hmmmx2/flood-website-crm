"use client";

import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import { useCallback, useEffect, useState } from "react";

type Broadcast = {
  id: string;
  title: string;
  body: string;
  targetZone: string;
  severity: string;
  sentBy: string | null;
  sentAt: string | null;
  recipientCount: number;
};

function SendIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2 .01 7z" />
    </svg>
  );
}

// BUG-H06: API contract uses "normal" not "info" — keep both keys so old
// records stored before this fix continue to render correctly.
const SEVERITY_STYLES: Record<string, string> = {
  normal:   "bg-blue-100 text-blue-800",
  info:     "bg-blue-100 text-blue-800",   // backward-compat alias
  warning:  "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

function relativeTime(isoString: string | null): string {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function BroadcastsPage() {
  const { isDark } = useTheme();
  const { accessToken, user } = useAuth();

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // FEAT-05: confirmation modal before POST
  const [confirmOpen, setConfirmOpen] = useState(false);
  // BUG-BCAST01 (website): real zones for the zone <select>
  const [zones, setZones] = useState<{ id: string; name: string; riskLevel: string }[]>([]);

  const [form, setForm] = useState({
    title: "",
    body: "",
    targetZone: "all",
    severity: "normal",
  });

  const fetchBroadcasts = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/broadcasts", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load broadcasts");
      setBroadcasts(await res.json());
    } catch {
      setError("Could not load broadcasts.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Fetch flood zones for the zone picker
  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/zones", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setZones(data);
      })
      .catch(() => { /* silently fall back to free-text */ });
  }, [accessToken]);

  useEffect(() => { fetchBroadcasts(); }, [fetchBroadcasts]);

  // FEAT-05 Step 1: validate form, show confirmation modal instead of sending immediately
  function handlePreviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setError(null);
    setSuccess(null);
    setConfirmOpen(true);
  }

  // FEAT-05 Step 2: user confirmed — now actually POST the broadcast
  async function handleConfirmedSend() {
    if (!accessToken) return;
    setConfirmOpen(false);
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Send failed");
      setSuccess("Broadcast sent successfully.");
      setForm({ title: "", body: "", targetZone: "all", severity: "warning" });
      fetchBroadcasts();
    } catch {
      setError("Failed to send broadcast. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const bg      = isDark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900";
  const card    = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const input   = isDark ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400";
  const label   = isDark ? "text-gray-300" : "text-gray-700";
  const muted   = isDark ? "text-gray-400" : "text-gray-500";

  const isAdmin = user?.role === "admin";

  return (
    <div className={`min-h-screen p-6 ${bg}`}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Emergency Broadcasts</h1>
          <p className={`text-sm mt-1 ${muted}`}>
            Send push notifications to all registered mobile users
          </p>
        </div>

        {/* Send form — admin only */}
        {isAdmin && (
          <div className={`rounded-xl border p-6 ${card}`}>
            <h2 className="text-lg font-semibold mb-4">Send New Broadcast</h2>
            <form onSubmit={handlePreviewSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${label}`}>Title</label>
                  <input
                    required
                    maxLength={255}
                    placeholder="Flood warning — Kuching area"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${input}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${label}`}>Severity</label>
                    <select
                      value={form.severity}
                      onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${input}`}
                    >
                      <option value="normal">Normal</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${label}`}>Target Zone</label>
                    <select
                      value={form.targetZone}
                      onChange={e => setForm(f => ({ ...f, targetZone: e.target.value }))}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${input}`}
                    >
                      <option value="all">All Zones</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.name}>{z.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${label}`}>
                  Message <span className={`font-normal ${muted}`}>({form.body.length}/160)</span>
                </label>
                <textarea
                  required
                  maxLength={160}
                  rows={3}
                  placeholder="Residents in low-lying areas should move to higher ground immediately."
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none ${input}`}
                />
              </div>

              {error   && <p className="text-sm text-red-500">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}

              <button
                type="submit"
                disabled={sending || !form.title.trim() || !form.body.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <SendIcon className="w-4 h-4" />
                {sending ? "Sending…" : "Review & Send"}
              </button>
            </form>
          </div>
        )}

        {/* Broadcast history */}
        <div className={`rounded-xl border ${card}`}>
          <div className="p-4 border-b border-inherit">
            <h2 className="font-semibold">Broadcast History</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : broadcasts.length === 0 ? (
            <p className={`p-8 text-center text-sm ${muted}`}>No broadcasts sent yet.</p>
          ) : (
            <div className="divide-y divide-inherit">
              {broadcasts.map(b => (
                <div key={b.id} className="p-4 flex items-start gap-4">
                  <span className={`mt-0.5 px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${SEVERITY_STYLES[b.severity] ?? "bg-gray-100 text-gray-700"}`}>
                    {b.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{b.title}</p>
                    <p className={`text-sm mt-0.5 ${muted}`}>{b.body}</p>
                    <p className={`text-xs mt-1 ${muted}`}>
                      Zone: {b.targetZone} · {b.recipientCount} recipients · {relativeTime(b.sentAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FEAT-05: Broadcast confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-xl ${isDark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"}`}>
            <h2 className="text-lg font-bold mb-1">Confirm Broadcast</h2>
            <p className={`text-sm mb-5 ${muted}`}>
              Review the details below. Once sent, this broadcast will be delivered to all
              registered users in the target zone and <strong>cannot be recalled</strong>.
            </p>

            {/* Preview card */}
            <div className={`rounded-xl border p-4 space-y-3 mb-6 ${isDark ? "border-gray-600 bg-gray-700/60" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${
                  SEVERITY_STYLES[form.severity] ?? "bg-gray-100 text-gray-700"
                }`}>
                  {form.severity}
                </span>
                <span className="text-sm font-semibold">{form.title}</span>
              </div>
              <p className={`text-sm leading-relaxed ${muted}`}>{form.body}</p>
              <div className={`flex items-center gap-4 text-xs border-t pt-2 ${isDark ? "border-gray-600 text-gray-400" : "border-gray-200 text-gray-500"}`}>
                <span>Zone: <strong>{form.targetZone || "all"}</strong></span>
                <span>Sent by: <strong>{user?.email ?? "admin"}</strong></span>
              </div>
            </div>

            {/* Warning */}
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs mb-5 ${
              isDark ? "bg-amber-900/30 text-amber-300 border border-amber-700/50" : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}>
              <SendIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Emergency broadcasts are irreversible. Ensure the information is accurate before proceeding.</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  isDark
                    ? "border-gray-600 hover:bg-gray-700 text-gray-300"
                    : "border-gray-300 hover:bg-gray-50 text-gray-700"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedSend}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                <SendIcon className="w-4 h-4" />
                Confirm Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
