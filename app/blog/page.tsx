"use client";

import { useTheme } from "@/lib/ThemeContext";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BlogDto = {
  id: string;
  imageKey: string;
  imageUrl?: string | null;
  category: string;
  title: string;
  body: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

type PageDto = {
  content: BlogDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  last: boolean;
};

type BlogForm = {
  title: string;
  body: string;
  imageUrl: string;
  imageKey: string;
  category: string;
  isFeatured: boolean;
};

// BUG-S4-01: "General" is not a recognised category on the community side —
// articles tagged "General" would match no filter chip and become invisible
// to end-users. Canonical list must match flood-website-community & flood-mobile.
const CATEGORIES = ["Flood Alert", "Safety Tips", "Community", "Updates", "Research"];

const EMPTY_FORM: BlogForm = {
  title: "",
  body: "",
  imageUrl: "",
  imageKey: "blog-1",
  category: "Updates",
  isFeatured: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function readingTime(body: string): string {
  const words = (body ?? "").trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function categoryColor(cat: string): { bg: string; text: string } {
  switch (cat) {
    case "Flood Alert": return { bg: "bg-blue-100 dark:bg-blue-900/30",    text: "text-blue-700 dark:text-blue-400" };
    case "Safety Tips": return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" };
    case "Community":   return { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400" };
    case "Updates":     return { bg: "bg-blue-100 dark:bg-blue-900/30",   text: "text-blue-700 dark:text-blue-400" };
    case "Research":    return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" };
    default:            return { bg: "bg-gray-100 dark:bg-gray-700",      text: "text-gray-700 dark:text-gray-300" };
  }
}

function CategoryBadge({ category }: { category: string }) {
  const { bg, text } = categoryColor(category);
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      {category}
    </span>
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ─── Blog Form Modal ──────────────────────────────────────────────────────────

function BlogFormModal({
  show,
  initial,
  onClose,
  onSave,
}: {
  show: boolean;
  initial: BlogForm;
  onClose: () => void;
  onSave: (form: BlogForm) => Promise<void>;
}) {
  const { isDark } = useTheme();
  const [form, setForm] = useState<BlogForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (show) setForm(initial); }, [show]);

  const set = (key: keyof BlogForm, val: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.body.trim())  { setError("Content is required."); return; }
    // FEAT-S4-02: validate image URL format if provided
    if (form.imageUrl.trim()) {
      try { new URL(form.imageUrl.trim()); }
      catch { setError("Image URL must be a valid URL (e.g. https://…)."); return; }
    }
    setError(""); setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${isDark ? "bg-gray-900" : "bg-white"}`}>

        {/* Modal header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {initial.title ? "Edit Article" : "New Article"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className={`block text-sm font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="Enter article title..."
              className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
              }`}
            />
          </div>

          {/* Category */}
          <div>
            <label className={`block text-sm font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => set("category", cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    form.category === cat
                      ? "bg-blue-600 text-white border-blue-600"
                      : isDark
                        ? "border-gray-600 text-gray-400 hover:border-gray-400"
                        : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className={`block text-sm font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Image URL <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={e => set("imageUrl", e.target.value)}
              placeholder="https://example.com/image.jpg"
              className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
              }`}
            />
          </div>

          {/* Featured toggle */}
          <div className={`flex items-center justify-between p-4 rounded-lg border ${isDark ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-gray-50"}`}>
            <div>
              <p className={`text-sm font-semibold ${isDark ? "text-gray-200" : "text-gray-800"}`}>Featured Article</p>
              <p className="text-xs text-gray-500 mt-0.5">Show this article in the Featured section</p>
            </div>
            <button
              onClick={() => set("isFeatured", !form.isFeatured)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isFeatured ? "bg-blue-600" : isDark ? "bg-gray-600" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isFeatured ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {/* Body */}
          <div>
            <label className={`block text-sm font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.body}
              onChange={e => set("body", e.target.value)}
              rows={10}
              placeholder={"Write your article content here...\n\nUse double line breaks to separate paragraphs.\nUse **Heading** for section headings."}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                isDark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
              }`}
            />
            <p className="text-xs text-gray-400 mt-1">{(form.body.trim().split(/\s+/).filter(Boolean).length)} words · {readingTime(form.body)}</p>
          </div>
        </div>

        {/* Modal footer */}
        <div className={`flex items-center justify-end gap-3 p-6 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition flex items-center gap-2"
          >
            {saving && <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            {initial.title ? "Save Changes" : "Publish Article"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Blog Card ────────────────────────────────────────────────────────────────

function BlogCard({
  blog,
  onEdit,
  onDelete,
  onToggle,
}: {
  blog: BlogDto;
  onEdit: (blog: BlogDto) => void;
  onDelete: (blog: BlogDto) => void;
  onToggle: (blog: BlogDto) => void;
}) {
  const { isDark } = useTheme();
  const [deleting, setDeleting] = useState(false);

  return (
    <div className={`rounded-xl border overflow-hidden transition hover:shadow-md ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
      <div className="flex">
        {/* Thumbnail */}
        <div className={`w-36 shrink-0 ${isDark ? "bg-gray-700" : "bg-gray-100"} flex items-center justify-center`}>
          {blog.imageUrl ? (
            <img src={blog.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 p-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-gray-400">{blog.imageKey}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryBadge category={blog.category} />
              {blog.isFeatured && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                  ⭐ Featured
                </span>
              )}
            </div>
            <span className={`text-xs shrink-0 ${isDark ? "text-gray-400" : "text-gray-400"}`}>{readingTime(blog.body)}</span>
          </div>

          <h3 className={`font-bold text-sm leading-snug line-clamp-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            {blog.title}
          </h3>

          <p className={`text-xs line-clamp-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {blog.body}
          </p>

          <div className={`flex items-center gap-1 text-xs mt-auto ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(blog.createdAt)}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={() => onToggle(blog)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                blog.isFeatured
                  ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : isDark
                    ? "border-gray-600 text-gray-400 hover:bg-gray-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {blog.isFeatured ? "★ Unfeature" : "☆ Feature"}
            </button>
            <button
              onClick={() => onEdit(blog)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
            >
              ✏ Edit
            </button>
            <button
              onClick={() => onDelete(blog)}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-60"
            >
              🗑 Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const { isDark } = useTheme();
  const [blogs, setBlogs] = useState<BlogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<BlogDto | null>(null);
  // BUG-S4-05: inline delete confirmation replaces native confirm()
  const [deleteTarget, setDeleteTarget] = useState<BlogDto | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadBlogs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await apiFetch<PageDto>("/api/blogs?size=100");
      setBlogs(data.content ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load articles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBlogs(); }, [loadBlogs]);

  const displayed = blogs.filter(b => {
    const matchCat = filterCat === "All" || b.category === filterCat;
    const matchSearch = !search.trim() ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.body.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSave = async (form: BlogForm) => {
    const payload = {
      title: form.title,
      body: form.body,
      imageUrl: form.imageUrl || undefined,
      imageKey: form.imageKey,
      category: form.category,
      isFeatured: form.isFeatured,
    };
    if (editTarget) {
      await apiFetch(`/api/blogs/${editTarget.id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Article updated successfully");
    } else {
      await apiFetch("/api/blogs", { method: "POST", body: JSON.stringify(payload) });
      showToast("Article published successfully");
    }
    await loadBlogs();
  };

  const handleDelete = async (blog: BlogDto) => {
    // BUG-S4-05: two-step inline confirmation — first tap arms, second confirms
    if (deleteTarget?.id !== blog.id) { setDeleteTarget(blog); return; }
    setDeleteTarget(null);
    try {
      await apiFetch(`/api/blogs/${blog.id}`, { method: "DELETE" });
      setBlogs(prev => prev.filter(b => b.id !== blog.id));
      showToast("Article deleted");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", false);
    }
  };

  const handleToggleFeatured = async (blog: BlogDto) => {
    try {
      const updated = await apiFetch<BlogDto>(`/api/blogs/${blog.id}/featured`, { method: "PATCH" });
      setBlogs(prev => prev.map(b => b.id === blog.id ? updated : b));
      showToast(updated.isFeatured ? "Marked as featured" : "Removed from featured");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", false);
    }
  };

  const formInitial: BlogForm = editTarget
    ? { title: editTarget.title, body: editTarget.body, imageUrl: editTarget.imageUrl ?? "", imageKey: editTarget.imageKey ?? "blog-1", category: editTarget.category, isFeatured: editTarget.isFeatured }
    : EMPTY_FORM;

  const featuredCount = blogs.filter(b => b.isFeatured).length;
  const categoryCount = new Set(blogs.map(b => b.category)).size;

  return (
    <div className={`min-h-screen p-6 ${isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* BUG-S4-05 — inline delete confirmation bar */}
      {deleteTarget && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl bg-white border border-red-200 shadow-xl px-5 py-3 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium text-gray-700 max-w-xs truncate">
            Delete &ldquo;{deleteTarget.title}&rdquo;?
          </span>
          <button
            type="button"
            onClick={() => handleDelete(deleteTarget)}
            className="text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Blog Management</h1>
          <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Manage public blog articles and featured content
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-md"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Article
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Articles", value: blogs.length, icon: "📄" },
          { label: "Featured",       value: featuredCount, icon: "⭐" },
          { label: "Categories",     value: categoryCount, icon: "🏷️" },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-5 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{stat.value}</div>
            <div className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className={`flex items-center gap-2 flex-1 rounded-xl border px-4 py-2.5 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none ${isDark ? "text-white placeholder-gray-500" : "text-gray-900 placeholder-gray-400"}`}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All", ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                filterCat === cat
                  ? "bg-blue-600 text-white"
                  : isDark
                    ? "bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-700 font-semibold">{error}</p>
          <button onClick={loadBlogs} className="mt-3 text-sm text-red-600 underline">Retry</button>
        </div>
      ) : displayed.length === 0 ? (
        <div className={`rounded-xl border p-16 text-center ${isDark ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-white"}`}>
          <div className="text-5xl mb-4">📰</div>
          <p className={`text-lg font-semibold ${isDark ? "text-gray-300" : "text-gray-600"}`}>No articles found</p>
          <p className="text-sm text-gray-400 mt-1">
            {blogs.length === 0 ? "Create your first article to get started." : "Try adjusting your filters."}
          </p>
          {blogs.length === 0 && (
            <button
              onClick={() => { setEditTarget(null); setShowModal(true); }}
              className="mt-4 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
            >
              Create First Article
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Showing {displayed.length} of {blogs.length} articles
          </p>
          {displayed.map(blog => (
            <BlogCard
              key={blog.id}
              blog={blog}
              onEdit={b => { setEditTarget(b); setShowModal(true); }}
              onDelete={handleDelete}
              onToggle={handleToggleFeatured}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      <BlogFormModal
        show={showModal}
        initial={formInitial}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />
    </div>
  );
}
