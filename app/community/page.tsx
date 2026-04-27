"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useAuth } from "@/lib/AuthContext";
import { authFetch } from "@/lib/authFetch";

// ── Types ──────────────────────────────────────────────────────────────────────

type Post = {
  id: string; authorName: string; groupName?: string; groupSlug?: string;
  title: string; content: string; imageUrl?: string;
  likesCount: number; commentsCount: number; createdAt: string;
};

type Group = {
  id: string; slug: string; name: string; description?: string;
  iconLetter: string; iconColor: string; membersCount: number; postsCount: number;
};

type PagedPosts = { content: Post[]; last: boolean; number: number };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CommunityManagementPage() {
  const { isDark } = useTheme();
  const { accessToken, silentRefresh } = useAuth();
  const [tab, setTab] = useState<"posts" | "groups">("posts");

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsPage, setPostsPage] = useState(0);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postSearch, setPostSearch] = useState("");
  const [postSort, setPostSort] = useState<"new" | "top">("new");
  const [deletingPost, setDeletingPost] = useState<string | null>(null);

  // Groups state
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ slug: "", name: "", description: "", iconColor: "#ed1c24" });
  const [groupFormError, setGroupFormError] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const isFirstFetch = useRef(true);

  // ── Fetch posts ──────────────────────────────────────────────────────────────

  const fetchPosts = useCallback(async (page: number, sort: string, replace: boolean) => {
    if (!accessToken) return;
    if (replace) setPostsLoading(true);
    try {
      const res = await authFetch(`/api/community/posts?page=${page}&size=20&sort=${sort}`, accessToken, silentRefresh);
      if (!res.ok) return;
      const data: PagedPosts = await res.json();
      setPosts(prev => replace ? data.content : [...prev, ...data.content]);
      setPostsHasMore(!data.last);
      setPostsPage(page);
    } finally { setPostsLoading(false); }
  }, [accessToken, silentRefresh]);

  // ── Fetch groups ─────────────────────────────────────────────────────────────

  const fetchGroups = useCallback(async () => {
    if (!accessToken) return;
    setGroupsLoading(true);
    try {
      const res = await authFetch("/api/community/groups", accessToken, silentRefresh);
      if (!res.ok) return;
      setGroups(await res.json());
    } finally { setGroupsLoading(false); }
  }, [accessToken, silentRefresh]);

  useEffect(() => {
    if (!accessToken) return;
    if (isFirstFetch.current) { fetchGroups(); isFirstFetch.current = false; }
    fetchPosts(0, postSort, true);
  }, [accessToken, postSort, fetchPosts, fetchGroups]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function deletePost(id: string) {
    if (!confirm("Permanently remove this post?")) return;
    setDeletingPost(id);
    const res = await authFetch(`/api/community/posts/${id}`, accessToken!, silentRefresh, { method: "DELETE" });
    if (res.ok || res.status === 204) setPosts(p => p.filter(x => x.id !== id));
    setDeletingPost(null);
  }

  async function deleteGroup(id: string) {
    if (!confirm("Delete this group? All posts within it will be unlinked.")) return;
    setDeletingGroup(id);
    const res = await authFetch(`/api/community/groups/${id}`, accessToken!, silentRefresh, { method: "DELETE" });
    if (res.ok || res.status === 204) setGroups(g => g.filter(x => x.id !== id));
    setDeletingGroup(null);
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setGroupFormError(null);
    if (!groupForm.slug || !groupForm.name) { setGroupFormError("Slug and name are required"); return; }
    if (!/^[a-z0-9-]+$/.test(groupForm.slug)) { setGroupFormError("Slug: lowercase letters, numbers, hyphens only"); return; }
    setSavingGroup(true);
    try {
      const res = await authFetch("/api/community/groups", accessToken!, silentRefresh, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      });
      const data = await res.json();
      if (!res.ok) { setGroupFormError(data.error || "Failed"); setSavingGroup(false); return; }
      setGroups(g => [data, ...g]);
      setGroupForm({ slug: "", name: "", description: "", iconColor: "#ed1c24" });
      setShowCreateGroup(false);
    } finally { setSavingGroup(false); }
  }

  const filteredPosts = posts.filter(p =>
    !postSearch ||
    p.title.toLowerCase().includes(postSearch.toLowerCase()) ||
    p.authorName.toLowerCase().includes(postSearch.toLowerCase()) ||
    (p.groupName ?? "").toLowerCase().includes(postSearch.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  const card = `rounded-3xl border transition-colors ${isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"}`;
  const muted = isDark ? "text-dark-text-muted" : "text-dark-charcoal/50";
  const text = isDark ? "text-dark-text" : "text-dark-charcoal";
  const inputCls = `w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-primary-red/60 focus:ring-2 focus:ring-primary-red/10 ${isDark ? "bg-dark-card border-dark-border text-dark-text placeholder:text-dark-text-muted" : "bg-pure-white border-light-grey text-dark-charcoal"}`;

  return (
    <section className="space-y-6">
      {/* Header */}
      <header>
        <h1 className={`text-3xl font-semibold ${text}`}>Community Management</h1>
        <p className={`text-sm mt-1 ${muted}`}>Moderate user posts and manage community groups.</p>
      </header>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-2xl border w-fit ${isDark ? "border-dark-border bg-dark-bg" : "border-light-grey bg-very-light-grey"}`}>
        {(["posts", "groups"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${tab === t
              ? "bg-primary-red text-pure-white shadow-sm"
              : `${muted} hover:${text}`}`}>
            {t === "posts" ? `Posts ${posts.length ? `(${posts.length})` : ""}` : `Groups ${groups.length ? `(${groups.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── POSTS TAB ── */}
      {tab === "posts" && (
        <div className="space-y-4">
          {/* Sort + search row */}
          <div className="flex flex-wrap gap-3">
            <div className={`flex rounded-xl border overflow-hidden ${isDark ? "border-dark-border" : "border-light-grey"}`}>
              {(["new", "top"] as const).map(s => (
                <button key={s} type="button" onClick={() => setPostSort(s)}
                  className={`px-4 py-2.5 text-sm font-semibold transition capitalize ${
                    postSort === s
                      ? "bg-primary-red text-pure-white"
                      : isDark ? "bg-dark-card text-dark-text-secondary hover:bg-dark-border/40" : "bg-pure-white text-dark-charcoal/70 hover:bg-very-light-grey"
                  }`}>
                  {s === "new" ? "🕐 New" : "🔥 Top"}
                </button>
              ))}
            </div>
            <input type="text" value={postSearch} onChange={e => setPostSearch(e.target.value)}
              placeholder="Search by title, author, or group…" className={`${inputCls} flex-1 min-w-[200px]`} />
          </div>

          <div className={card}>
            {postsLoading ? (
              <div className="flex justify-center py-16">
                <div className={`h-10 w-10 animate-spin rounded-full border-4 ${isDark ? "border-dark-border border-t-primary-red" : "border-light-grey border-t-primary-red"}`} />
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-2">
                <span className="text-3xl">🌊</span>
                <p className={`text-sm ${muted}`}>No posts found</p>
              </div>
            ) : (
              <div className={`divide-y ${isDark ? "divide-dark-border" : "divide-light-grey"}`}>
                {filteredPosts.map(post => (
                  <div key={post.id} className={`flex items-start gap-4 p-5 transition-colors ${isDark ? "hover:bg-dark-bg" : "hover:bg-very-light-grey"}`}>
                    {/* Image thumbnail */}
                    {post.imageUrl && (
                      <div className="flex-shrink-0 h-14 w-14 rounded-xl overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={post.imageUrl} alt="" className="h-full w-full object-cover"
                          onError={e => (e.target as HTMLImageElement).style.display = "none"} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {/* Group badge */}
                      {post.groupName && (
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-primary-red bg-primary-red/10 px-2 py-0.5 rounded-full mb-1">
                          g/{post.groupSlug}
                        </span>
                      )}
                      <h3 className={`font-semibold text-sm line-clamp-1 ${text}`}>{post.title}</h3>
                      <p className={`text-xs line-clamp-2 mt-0.5 ${muted}`}>{post.content}</p>
                      <div className={`flex items-center gap-3 mt-1.5 text-xs ${muted}`}>
                        <span>{post.authorName}</span>
                        <span>•</span>
                        <span>{timeAgo(post.createdAt)}</span>
                        <span>•</span>
                        <span>👍 {post.likesCount}</span>
                        <span>💬 {post.commentsCount}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => deletePost(post.id)}
                      disabled={deletingPost === post.id}
                      className="flex-shrink-0 flex items-center gap-1 rounded-xl border border-primary-red/30 bg-primary-red/5 px-3 py-2 text-xs font-semibold text-primary-red hover:bg-primary-red hover:text-pure-white transition disabled:opacity-40">
                      {deletingPost === post.id
                        ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      }
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {postsHasMore && !postsLoading && (
            <button type="button" onClick={() => fetchPosts(postsPage + 1, postSort, false)}
              className="w-full py-3 rounded-2xl border border-primary-red/30 text-sm font-semibold text-primary-red hover:bg-primary-red hover:text-pure-white transition">
              Load more posts
            </button>
          )}
        </div>
      )}

      {/* ── GROUPS TAB ── */}
      {tab === "groups" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowCreateGroup(true)}
              className="flex items-center gap-2 rounded-2xl bg-primary-red px-5 py-2.5 text-sm font-semibold text-pure-white hover:bg-primary-red/90 transition">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Group
            </button>
          </div>

          {/* Create group form */}
          {showCreateGroup && (
            <div className={`${card} p-6`}>
              <h3 className={`font-bold mb-4 ${text}`}>Create Community Group</h3>
              {groupFormError && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{groupFormError}</div>
              )}
              <form onSubmit={createGroup} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${muted}`}>Slug (URL-safe)*</label>
                  <input value={groupForm.slug} onChange={e => setGroupForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                    placeholder="kuching-floods" className={inputCls} />
                  <p className={`text-[10px] mt-1 ${muted}`}>Community URL: /g/{groupForm.slug || "slug"}</p>
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${muted}`}>Name*</label>
                  <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Kuching Flood Updates" className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={`block text-xs font-semibold mb-1 ${muted}`}>Description</label>
                  <textarea value={groupForm.description} onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))}
                    rows={2} placeholder="What is this community about?"
                    className={`${inputCls} resize-none`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${muted}`}>Icon Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={groupForm.iconColor}
                      onChange={e => setGroupForm(f => ({ ...f, iconColor: e.target.value }))}
                      className="h-10 w-16 rounded-lg border border-light-grey cursor-pointer" />
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: groupForm.iconColor }}>
                      {groupForm.name?.[0]?.toUpperCase() || "G"}
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => { setShowCreateGroup(false); setGroupFormError(null); }}
                    className={`rounded-2xl border px-5 py-2.5 text-sm font-semibold transition ${isDark ? "border-dark-border text-dark-text-secondary hover:bg-dark-border/40" : "border-light-grey text-dark-charcoal/70 hover:bg-very-light-grey"}`}>
                    Cancel
                  </button>
                  <button type="submit" disabled={savingGroup}
                    className="rounded-2xl bg-primary-red px-6 py-2.5 text-sm font-semibold text-pure-white hover:bg-primary-red/90 transition disabled:opacity-50">
                    {savingGroup ? "Creating…" : "Create Group"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Groups list */}
          <div className={`${card} overflow-hidden`}>
            {groupsLoading ? (
              <div className="flex justify-center py-16">
                <div className={`h-10 w-10 animate-spin rounded-full border-4 ${isDark ? "border-dark-border border-t-primary-red" : "border-light-grey border-t-primary-red"}`} />
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-2">
                <span className="text-3xl">👥</span>
                <p className={`text-sm ${muted}`}>No groups yet. Create the first one!</p>
              </div>
            ) : (
              <div className={`divide-y ${isDark ? "divide-dark-border" : "divide-light-grey"}`}>
                {groups.map(g => (
                  <div key={g.id} className={`flex items-center gap-4 p-5 transition-colors ${isDark ? "hover:bg-dark-bg" : "hover:bg-very-light-grey"}`}>
                    <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                      style={{ backgroundColor: g.iconColor }}>
                      {g.iconLetter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm ${text}`}>{g.name}</span>
                        <span className={`text-xs ${muted}`}>g/{g.slug}</span>
                      </div>
                      {g.description && <p className={`text-xs line-clamp-1 mt-0.5 ${muted}`}>{g.description}</p>}
                      <div className={`flex gap-3 mt-1 text-xs ${muted}`}>
                        <span>👥 {g.membersCount} members</span>
                        <span>📝 {g.postsCount} posts</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => deleteGroup(g.id)}
                      disabled={deletingGroup === g.id}
                      className="flex-shrink-0 flex items-center gap-1 rounded-xl border border-primary-red/30 bg-primary-red/5 px-3 py-2 text-xs font-semibold text-primary-red hover:bg-primary-red hover:text-pure-white transition disabled:opacity-40">
                      {deletingGroup === g.id
                        ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
