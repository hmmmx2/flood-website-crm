"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useAuth } from "@/lib/AuthContext";
import { authFetch } from "@/lib/authFetch";

type CommunityPost = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  imageUrl?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
};

type PagedPosts = {
  content: CommunityPost[];
  totalElements: number;
  last: boolean;
  number: number;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommunityModerationPage() {
  const { isDark } = useTheme();
  const { accessToken, silentRefresh } = useAuth();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  // BUG-S4-06: inline delete confirmation replaces native confirm()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "top">("new");

  const fetchPosts = useCallback(async (p: number, s: string, replace: boolean) => {
    if (!accessToken) return;
    if (replace) setLoading(true);
    try {
      const res = await authFetch(
        `/api/community/posts?page=${p}&size=20&sort=${s}`,
        accessToken,
        silentRefresh
      );
      if (!res.ok) return;
      const data: PagedPosts = await res.json();
      setPosts(prev => replace ? data.content : [...prev, ...data.content]);
      setHasMore(!data.last);
      setPage(p);
    } finally { setLoading(false); }
  }, [accessToken, silentRefresh]);

  useEffect(() => {
    if (accessToken) fetchPosts(0, sort, true);
  }, [accessToken, sort, fetchPosts]);

  async function handleDelete(postId: string) {
    // BUG-S4-06: two-step inline confirmation — first tap arms, second confirms
    if (pendingDeleteId !== postId) { setPendingDeleteId(postId); return; }
    setPendingDeleteId(null);
    setDeleting(postId);
    try {
      const res = await authFetch(
        `/api/community/posts/${postId}`,
        accessToken!,
        silentRefresh,
        { method: "DELETE" }
      );
      if (res.ok || res.status === 204) {
        setPosts(prev => prev.filter(p => p.id !== postId));
      }
    } finally { setDeleting(null); }
  }

  const filtered = posts.filter(p =>
    !search ||
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.authorName.toLowerCase().includes(search.toLowerCase())
  );

  const pendingPost = posts.find(p => p.id === pendingDeleteId);

  return (
    <section className="space-y-6">
      {/* BUG-S4-06 — inline delete confirmation bar */}
      {pendingDeleteId && pendingPost && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl bg-white border border-red-200 shadow-xl px-5 py-3 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium text-gray-700 max-w-xs truncate">
            Remove &ldquo;{pendingPost.title}&rdquo;?
          </span>
          <button
            type="button"
            onClick={() => handleDelete(pendingDeleteId)}
            className="text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={() => setPendingDeleteId(null)}
            className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className={`text-3xl font-semibold ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
            Community Moderation
          </h1>
          <p className={`text-sm ${isDark ? "text-dark-text-secondary" : "text-dark-charcoal/70"}`}>
            Review and manage user-submitted community posts.
          </p>
        </div>
        <div className={`text-sm font-semibold rounded-2xl px-4 py-2 border ${isDark ? "border-dark-border bg-dark-card text-dark-text" : "border-light-grey bg-pure-white text-dark-charcoal"}`}>
          {posts.length} posts loaded
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or author…"
          className={`flex-1 min-w-[200px] rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-primary-red/60 focus:ring-2 focus:ring-primary-red/10 ${
            isDark ? "bg-dark-card border-dark-border text-dark-text placeholder:text-dark-text-muted" : "bg-pure-white border-light-grey text-dark-charcoal"
          }`}
        />
        <div className={`flex rounded-xl border overflow-hidden ${isDark ? "border-dark-border" : "border-light-grey"}`}>
          {(["new", "top"] as const).map(s => (
            <button key={s} type="button" onClick={() => setSort(s)}
              className={`px-4 py-2.5 text-sm font-semibold transition capitalize ${
                sort === s
                  ? "bg-primary-red text-pure-white"
                  : isDark ? "bg-dark-card text-dark-text-secondary hover:bg-dark-border/40" : "bg-pure-white text-dark-charcoal/70 hover:bg-very-light-grey"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-3xl border overflow-hidden ${isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"}`}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className={`h-10 w-10 animate-spin rounded-full border-4 ${isDark ? "border-dark-border border-t-primary-red" : "border-light-grey border-t-primary-red"}`} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-12 w-12 ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/30"}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <p className={`text-sm ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/50"}`}>No posts found</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--divider)]" style={{ ["--divider" as string]: isDark ? "#2d3a5a" : "#edeff1" }}>
            {filtered.map(post => (
              <div key={post.id} className={`p-5 hover:bg-opacity-50 transition-colors ${isDark ? "hover:bg-dark-bg" : "hover:bg-very-light-grey"}`}>
                <div className="flex items-start gap-4">
                  {/* Post image */}
                  {post.imageUrl && (
                    <div className="flex-shrink-0 h-16 w-16 rounded-xl overflow-hidden bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={post.imageUrl} alt="" className="h-full w-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
                        {post.authorName}
                      </span>
                      <span className={`text-xs ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/50"}`}>
                        • {timeAgo(post.createdAt)}
                      </span>
                    </div>
                    <h3 className={`font-semibold text-sm mb-1 line-clamp-1 ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
                      {post.title}
                    </h3>
                    <p className={`text-xs line-clamp-2 mb-2 ${isDark ? "text-dark-text-secondary" : "text-dark-charcoal/70"}`}>
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className={`flex items-center gap-1 text-xs ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/50"}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777z" />
                        </svg>
                        {post.likesCount}
                      </span>
                      <span className={`flex items-center gap-1 text-xs ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/50"}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                        {post.commentsCount}
                      </span>
                    </div>
                  </div>

                  {/* Delete — arms on first click, confirmation bar appears */}
                  <button
                    type="button"
                    onClick={() => handleDelete(post.id)}
                    disabled={deleting === post.id}
                    className={`flex-shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                      pendingDeleteId === post.id
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-primary-red/30 bg-primary-red/5 text-primary-red hover:bg-primary-red hover:text-pure-white"
                    }`}
                  >
                    {deleting === post.id ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    )}
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <button type="button" onClick={() => fetchPosts(page + 1, sort, false)}
          className="w-full py-3 rounded-2xl border border-primary-red/30 text-sm font-semibold text-primary-red hover:bg-primary-red hover:text-pure-white transition">
          Load more
        </button>
      )}
    </section>
  );
}
