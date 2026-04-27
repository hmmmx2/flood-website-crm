"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useAuth } from "@/lib/AuthContext";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string;
  displayName: string;
  email: string;
  role: string;       // "Admin" | "Customer"
  status: string;
  createdAt: string | null;
  lastLogin: string | null;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "customer",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function roleBadge(role: string) {
  const isAdmin = role.toLowerCase() === "admin";
  return isAdmin
    ? "bg-primary-red/10 text-primary-red border border-primary-red/30"
    : "bg-status-green/10 text-status-green border border-status-green/30";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { isDark } = useTheme();
  const { accessToken, user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // Form state
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── API calls ───────────────────────────────────────────────────────────────

  const authHeaders = useCallback((): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }), [accessToken]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AdminUser[] = await res.json();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Add user ────────────────────────────────────────────────────────────────

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.email.includes("@")) { setFormError("Valid email required"); return; }
    if (form.password.length < 8) { setFormError("Password must be at least 8 characters"); return; }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          firstName: form.firstName.trim() || form.email.split("@")[0],
          lastName: form.lastName.trim() || "-",
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const created: AdminUser = await res.json();
      setUsers((prev) => [created, ...prev]);
      setShowAddModal(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Edit user ───────────────────────────────────────────────────────────────

  function openEdit(u: AdminUser) {
    const [firstName, ...rest] = u.displayName.split(" ");
    setForm({
      firstName: firstName || "",
      lastName: rest.join(" "),
      email: u.email,
      password: "",
      role: u.role.toLowerCase(),
    });
    setFormError(null);
    setEditUser(u);
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setFormError(null);
    setIsSaving(true);
    try {
      const body: Record<string, string> = { role: form.role };
      if (form.firstName.trim()) body.firstName = form.firstName.trim();
      if (form.lastName.trim()) body.lastName = form.lastName.trim();

      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const updated: AdminUser = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditUser(null);
      setForm(EMPTY_FORM);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to update user");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Delete user ─────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      // BUG-S4-02: replaced native alert() with toast
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const card = isDark
    ? "border-dark-border bg-dark-card"
    : "border-light-grey bg-pure-white";
  const text = isDark ? "text-dark-text" : "text-dark-charcoal";
  const muted = isDark ? "text-dark-text-muted" : "text-dark-charcoal/60";
  const inputCls = `w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-red focus:ring-2 focus:ring-primary-red/20 ${
    isDark
      ? "border-dark-border bg-dark-bg text-dark-text placeholder:text-dark-text-muted"
      : "border-light-grey bg-very-light-grey text-dark-charcoal"
  }`;

  return (
    <div className={`min-h-screen p-6 ${isDark ? "bg-dark-bg" : "bg-very-light-grey"}`}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${text}`}>User Management</h1>
          <p className={`text-sm mt-1 ${muted}`}>
            Manage system accounts and roles
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormError(null); setShowAddModal(true); }}
          className="rounded-xl bg-primary-red px-4 py-2.5 text-sm font-semibold text-pure-white transition hover:bg-primary-red/90"
        >
          + Add User
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Users", value: users.length },
          { label: "Admins", value: users.filter((u) => u.role.toLowerCase() === "admin").length },
          { label: "Customers", value: users.filter((u) => u.role.toLowerCase() !== "admin").length },
          { label: "Active Today", value: users.filter((u) => u.lastLogin && Date.now() - new Date(u.lastLogin).getTime() < 86400000).length },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${card}`}>
            <p className={`text-xs font-medium ${muted}`}>{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className={`rounded-2xl border ${card} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${isDark ? "border-dark-border" : "border-light-grey"}`}>
          <h2 className={`text-base font-semibold ${text}`}>All Users</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className={`h-8 w-8 animate-spin rounded-full border-4 ${isDark ? "border-dark-border border-t-primary-red" : "border-light-grey border-t-primary-red"}`} />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm text-primary-red">{error}</p>
            <button onClick={fetchUsers} className="mt-3 text-sm underline text-primary-red">Retry</button>
          </div>
        ) : users.length === 0 ? (
          <p className={`py-12 text-center text-sm ${muted}`}>No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b text-left ${isDark ? "border-dark-border" : "border-light-grey"}`}>
                  {["Name", "Email", "Role", "Last Login", "Joined", "Actions"].map((h) => (
                    <th key={h} className={`px-6 py-3 text-xs font-semibold uppercase tracking-wide ${muted}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b transition-colors ${isDark ? "border-dark-border/50 hover:bg-dark-bg/50" : "border-light-grey/50 hover:bg-very-light-grey"}`}
                  >
                    <td className={`px-6 py-4 font-medium ${text}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${u.role.toLowerCase() === "admin" ? "bg-primary-red text-white" : "bg-status-green/20 text-status-green"}`}>
                          {u.displayName.charAt(0).toUpperCase()}
                        </div>
                        {u.displayName}
                        {u.id === currentUser?.id && (
                          <span className="text-xs text-primary-red font-normal">(you)</span>
                        )}
                      </div>
                    </td>
                    <td className={`px-6 py-4 ${muted}`}>{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${muted}`}>{relativeTime(u.lastLogin)}</td>
                    <td className={`px-6 py-4 ${muted}`}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${isDark ? "bg-dark-bg hover:bg-dark-border text-dark-text" : "bg-very-light-grey hover:bg-light-grey text-dark-charcoal"}`}
                        >
                          Edit
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium bg-primary-red/10 text-primary-red hover:bg-primary-red/20 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add User Modal ─────────────────────────────────────────────────── */}
      {showAddModal && (
        <Modal title="Add New User" onClose={() => setShowAddModal(false)} isDark={isDark}>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>First Name</label>
                <input className={inputCls} placeholder="First" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>Last Name</label>
                <input className={inputCls} placeholder="Last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>Email *</label>
              <input type="email" required className={inputCls} placeholder="user@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>Password *</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required className={inputCls + " pr-12"} placeholder="Min. 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${muted}`}>{showPassword ? "Hide" : "Show"}</button>
              </div>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>Role *</label>
              <select required className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {formError && <p className="text-xs text-primary-red">{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className={`rounded-xl px-4 py-2 text-sm font-medium ${isDark ? "bg-dark-bg text-dark-text hover:bg-dark-border" : "bg-very-light-grey text-dark-charcoal hover:bg-light-grey"}`}>Cancel</button>
              <button type="submit" disabled={isSaving} className="rounded-xl bg-primary-red px-4 py-2 text-sm font-semibold text-white hover:bg-primary-red/90 disabled:opacity-50">
                {isSaving ? "Creating…" : "Create User"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit User Modal ────────────────────────────────────────────────── */}
      {editUser && (
        <Modal title={`Edit — ${editUser.displayName}`} onClose={() => setEditUser(null)} isDark={isDark}>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>First Name</label>
                <input className={inputCls} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>Last Name</label>
                <input className={inputCls} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>Email (read-only)</label>
              <input className={inputCls + " opacity-60 cursor-not-allowed"} value={form.email} readOnly />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>Role</label>
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {formError && <p className="text-xs text-primary-red">{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditUser(null)} className={`rounded-xl px-4 py-2 text-sm font-medium ${isDark ? "bg-dark-bg text-dark-text hover:bg-dark-border" : "bg-very-light-grey text-dark-charcoal hover:bg-light-grey"}`}>Cancel</button>
              <button type="submit" disabled={isSaving} className="rounded-xl bg-primary-red px-4 py-2 text-sm font-semibold text-white hover:bg-primary-red/90 disabled:opacity-50">
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
      {deleteTarget && (
        <Modal title="Delete User" onClose={() => setDeleteTarget(null)} isDark={isDark}>
          <p className={`text-sm ${isDark ? "text-dark-text-secondary" : "text-dark-charcoal/80"}`}>
            Are you sure you want to delete <strong>{deleteTarget.displayName}</strong> ({deleteTarget.email})?
            This action cannot be undone.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className={`rounded-xl px-4 py-2 text-sm font-medium ${isDark ? "bg-dark-bg text-dark-text hover:bg-dark-border" : "bg-very-light-grey text-dark-charcoal hover:bg-light-grey"}`}>Cancel</button>
            <button onClick={handleDelete} disabled={isSaving} className="rounded-xl bg-primary-red px-4 py-2 text-sm font-semibold text-white hover:bg-primary-red/90 disabled:opacity-50">
              {isSaving ? "Deleting…" : "Delete User"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({
  title,
  children,
  onClose,
  isDark,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isDark: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-xl ${isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"}`}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className={`text-base font-semibold ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>{title}</h3>
          <button onClick={onClose} className={`text-lg leading-none ${isDark ? "text-dark-text-muted hover:text-dark-text" : "text-dark-charcoal/50 hover:text-dark-charcoal"}`}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
