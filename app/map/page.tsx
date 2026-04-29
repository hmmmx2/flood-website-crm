"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NodeMap from "@/components/map/NodeMap";
import { useAuth } from "@/lib/AuthContext";
import { authFetch } from "@/lib/authFetch";
import { useTheme } from "@/lib/ThemeContext";
import { NodeData } from "@/lib/types";

// ── SSE support ───────────────────────────────────────────────────────────────

type SseSensorDto = {
  id: string;
  nodeId: string;
  name?: string;
  area: string;
  location: string;
  state: string;
  latitude: number;
  longitude: number;
  currentLevel: 0 | 1 | 2 | 3;
  status: "active" | "warning" | "critical" | "inactive";
  isDead?: boolean;
  lastUpdated: string;
};

function sseToNodeData(dto: SseSensorDto, prev?: NodeData): NodeData {
  return {
    _id: dto.id,
    node_id: dto.nodeId,
    name: dto.name ?? "",
    area: dto.area,
    location: dto.location,
    state: dto.state,
    latitude: dto.latitude,
    longitude: dto.longitude,
    current_level: dto.currentLevel,
    is_dead: dto.isDead ?? dto.status === "inactive",
    last_updated: dto.lastUpdated,
    created_at: prev?.created_at ?? dto.lastUpdated,
  };
}

// ── icon helpers ────────────────────────────────────────────────────────────

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function FilterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function XMarkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

// ── types & constants ────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { key: "normal",   label: "Normal",   dotClass: "bg-status-green"    },
  { key: "alert",    label: "Alert",    dotClass: "bg-status-warning-1" },
  { key: "warning",  label: "Warning",  dotClass: "bg-status-warning-2" },
  { key: "critical", label: "Critical", dotClass: "bg-status-danger"    },
  { key: "offline",  label: "Offline",  dotClass: "bg-gray-400"         },
] as const;

type StatusKey = (typeof STATUS_OPTIONS)[number]["key"];

const STATUS_LEGEND = [
  { label: "Normal",  description: "No flood risk",           water_level: 0, color: "bg-status-green text-pure-white"    },
  { label: "Alert",   description: "Minor flooding possible",  water_level: 1, color: "bg-status-warning-1 text-dark-charcoal" },
  { label: "Warning", description: "Moderate flood risk",      water_level: 2, color: "bg-status-warning-2 text-pure-white" },
  { label: "Danger",  description: "Severe flooding",          water_level: 3, color: "bg-status-danger text-pure-white"   },
];

// ── node helpers ─────────────────────────────────────────────────────────────

function nodeStatusKey(node: NodeData): StatusKey {
  if (node.is_dead) return "offline";
  if (node.current_level === 0) return "normal";
  if (node.current_level === 1) return "alert";
  if (node.current_level === 2) return "warning";
  return "critical";
}

function statusDotClass(node: NodeData) {
  if (node.is_dead) return "bg-status-danger";
  if (node.current_level === 0) return "bg-status-green";
  if (node.current_level === 1) return "bg-status-warning-1";
  if (node.current_level === 2) return "bg-status-warning-2";
  return "bg-status-danger";
}

function statusLabel(node: NodeData) {
  if (node.is_dead) return "Offline";
  return ["Normal", "Alert", "Warning", "Critical"][node.current_level] ?? "Unknown";
}

function formatTimeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function FloodMapPage() {
  const { isDark } = useTheme();
  const { accessToken, silentRefresh } = useAuth();

  // ── data ───────────────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const isFirstFetch = useRef(true);

  // ── favourites ─────────────────────────────────────────────────────────────
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("mapFavouriteNodes");
      return saved ? new Set<string>(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  function toggleFavourite(nodeId: string) {
    setFavouriteIds(prev => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      localStorage.setItem("mapFavouriteNodes", JSON.stringify([...next]));
      return next;
    });
  }

  function focusNode(nodeId: string) {
    setFocusNodeId(null);
    requestAnimationFrame(() => setFocusNodeId(nodeId));
  }

  // ── filters ────────────────────────────────────────────────────────────────
  const [filterState, setFilterState]       = useState("");
  const [filterCity, setFilterCity]         = useState("");
  const [filterStatuses, setFilterStatuses] = useState<Set<StatusKey>>(new Set());
  const [searchQuery, setSearchQuery]       = useState("");
  const [panelOpen, setPanelOpen]           = useState(true);

  // Unique sorted states from all nodes
  const availableStates = useMemo(() => {
    const s = new Set<string>();
    nodes.forEach(n => { if (n.state) s.add(n.state); });
    return [...s].sort();
  }, [nodes]);

  // Unique sorted cities — scoped to selected state when applicable
  const availableCities = useMemo(() => {
    const src = filterState ? nodes.filter(n => n.state === filterState) : nodes;
    const c = new Set<string>();
    src.forEach(n => { if (n.area) c.add(n.area); });
    return [...c].sort();
  }, [nodes, filterState]);

  // Reset city when state changes
  useEffect(() => { setFilterCity(""); }, [filterState]);

  function toggleStatus(key: StatusKey) {
    setFilterStatuses(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function clearAll() {
    setFilterState("");
    setFilterCity("");
    setFilterStatuses(new Set());
    setSearchQuery("");
  }

  const activeFilterCount = useMemo(() => {
    let n = filterStatuses.size;
    if (filterState) n++;
    if (filterCity) n++;
    if (searchQuery.trim()) n++;
    return n;
  }, [filterState, filterCity, filterStatuses, searchQuery]);

  // Apply all filters
  const filteredNodes = useMemo(() => {
    let r = nodes;
    if (filterState) r = r.filter(n => n.state === filterState);
    if (filterCity)  r = r.filter(n => n.area  === filterCity);
    if (filterStatuses.size > 0) r = r.filter(n => filterStatuses.has(nodeStatusKey(n)));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      r = r.filter(n =>
        n.node_id.toLowerCase().includes(q) ||
        (n.name     ?? "").toLowerCase().includes(q) ||
        (n.location ?? "").toLowerCase().includes(q) ||
        (n.area     ?? "").toLowerCase().includes(q) ||
        (n.state    ?? "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [nodes, filterState, filterCity, filterStatuses, searchQuery]);

  // ── derived lists ──────────────────────────────────────────────────────────
  const favouriteNodes = useMemo(
    () => filteredNodes.filter(n => favouriteIds.has(n._id)),
    [filteredNodes, favouriteIds],
  );

  const recentlyUpdated = useMemo(() =>
    [...nodes]
      .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
      .slice(0, 5),
    [nodes],
  );

  const recentlyUpdatedIds = useMemo(
    () => new Set(recentlyUpdated.map(n => n._id)),
    [recentlyUpdated],
  );

  // ── stats (always from filteredNodes) ─────────────────────────────────────
  const stats = useMemo(() => ({
    total:    filteredNodes.length,
    totalAll: nodes.length,
    online:   filteredNodes.filter(n => !n.is_dead).length,
    offline:  filteredNodes.filter(n =>  n.is_dead).length,
    normal:   filteredNodes.filter(n => !n.is_dead && n.current_level === 0).length,
    alert:    filteredNodes.filter(n => !n.is_dead && n.current_level === 1).length,
    warning:  filteredNodes.filter(n => !n.is_dead && n.current_level === 2).length,
    critical: filteredNodes.filter(n => !n.is_dead && n.current_level === 3).length,
  }), [filteredNodes, nodes]);

  // ── settings ───────────────────────────────────────────────────────────────
  const [autoRefresh, setAutoRefresh]       = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(1000);

  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem("crmSettings");
      if (saved) {
        const s = JSON.parse(saved);
        setAutoRefresh(s.liveDataEnabled ?? true);
        setRefreshInterval(s.refreshInterval ?? 1000);
      }
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  // ── data fetching ──────────────────────────────────────────────────────────
  const fetchNodes = useCallback(async () => {
    if (!accessToken) { setIsLoading(false); return; }
    if (isFirstFetch.current) setIsLoading(true);
    try {
      const res = await authFetch("/api/nodes", accessToken, silentRefresh);
      if (!res.ok) throw new Error("Failed to fetch nodes");
      const result = await res.json();
      if (result.success) {
        setNodes(result.data);
        setLastFetch(new Date());
        setError(null);
        isFirstFetch.current = false;
      } else {
        throw new Error(result.error ?? "Failed to fetch nodes");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, silentRefresh]);

  // Initial fetch
  useEffect(() => {
    if (!accessToken) return;
    fetchNodes();
  }, [accessToken, fetchNodes]);

  // SSE real-time updates (replaces setInterval polling)
  useEffect(() => {
    if (!accessToken || !autoRefresh) return;

    const es = new EventSource("/api/sse/sensors");
    es.addEventListener("sensor-update", (e: MessageEvent) => {
      try {
        const dto: SseSensorDto = JSON.parse(e.data as string);
        setNodes(prev => {
          const idx = prev.findIndex(n => n._id === dto.id);
          const updated = sseToNodeData(dto, idx >= 0 ? prev[idx] : undefined);
          if (idx === -1) return [...prev, updated];
          const next = [...prev];
          next[idx] = updated;
          return next;
        });
        setLastFetch(new Date());
      } catch { /* malformed event — ignore */ }
    });

    return () => es.close();
  }, [accessToken, autoRefresh]);

  // ── reusable classnames ────────────────────────────────────────────────────
  const card = `rounded-3xl border p-5 shadow-sm transition-colors ${isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"}`;
  const muted = isDark ? "text-dark-text-muted" : "text-dark-charcoal/50";
  const body  = isDark ? "text-dark-text"        : "text-dark-charcoal";
  const sub   = isDark ? "text-dark-text-secondary" : "text-dark-charcoal/70";

  // ── loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className={`h-12 w-12 animate-spin rounded-full border-4 ${isDark ? "border-dark-border border-t-primary-blue" : "border-light-grey border-t-primary-blue"}`} />
            <p className={`text-sm font-medium ${sub}`}>Loading map data…</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-6">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className={`rounded-3xl border p-8 text-center ${isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"}`}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-blue/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-primary-blue">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className={`mb-2 text-xl font-semibold ${body}`}>Connection Error</h2>
            <p className={`mb-4 text-sm ${muted}`}>{error}</p>
            <button type="button" onClick={fetchNodes}
              className="rounded-xl bg-primary-blue px-5 py-2.5 text-sm font-semibold text-pure-white transition hover:bg-primary-blue/90">
              Retry Connection
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className={`text-3xl font-semibold transition-colors ${body}`}>Flood Map</h1>
          <p className={`text-sm transition-colors ${sub}`}>
            Real-time IoT sensor locations. Filter by state, city, or status to narrow your view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lastFetch && (
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-status-green animate-pulse" : "bg-dark-charcoal/40"}`} />
              <span className={`text-xs ${muted}`}>
                {autoRefresh ? "Live" : "Paused"} · Updated {lastFetch.toLocaleTimeString()}
              </span>
            </div>
          )}
          <button type="button" onClick={fetchNodes} title="Refresh data"
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
              isDark ? "border-dark-border text-dark-text hover:border-primary-blue hover:text-primary-blue"
                     : "border-light-grey text-dark-charcoal hover:border-primary-blue hover:text-primary-blue"}`}>
            <RefreshIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Filter panel ─────────────────────────────────────────────────── */}
      <div className={`rounded-3xl border shadow-sm transition-colors ${isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"}`}>

        {/* Panel toggle header */}
        <div className="flex items-center justify-between px-5 py-4">
          <button type="button" onClick={() => setPanelOpen(p => !p)}
            className="flex items-center gap-2.5 focus:outline-none">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${isDark ? "bg-dark-bg" : "bg-very-light-grey"}`}>
              <FilterIcon className={`h-3.5 w-3.5 ${muted}`} />
            </span>
            <span className={`text-sm font-semibold ${body}`}>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary-blue px-2 py-0.5 text-[10px] font-bold text-pure-white">
                {activeFilterCount} active
              </span>
            )}
            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${panelOpen ? "rotate-180" : ""} ${muted}`} />
          </button>

          <div className="flex items-center gap-3">
            <span className={`text-xs ${muted}`}>
              Showing{" "}
              <span className={`font-bold ${body}`}>{stats.total}</span>
              {" "}of{" "}
              <span className="font-bold">{stats.totalAll}</span>
              {" "}nodes
            </span>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearAll}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isDark ? "bg-dark-bg text-primary-blue hover:bg-primary-blue/10"
                         : "bg-light-blue/20 text-primary-blue hover:bg-light-blue/50"}`}>
                <XMarkIcon className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Collapsible filter body */}
        {panelOpen && (
          <div className={`border-t px-5 pb-5 pt-4 ${isDark ? "border-dark-border" : "border-light-grey"}`}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              {/* Search */}
              <div>
                <label className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-wide ${muted}`}>
                  Search
                </label>
                <div className="relative">
                  <SearchIcon className={`absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${muted}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Node ID, location, area…"
                    className={`w-full rounded-xl border py-2.5 pl-9 pr-8 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-blue/30 ${
                      isDark ? "border-dark-border bg-dark-bg text-dark-text placeholder-dark-text-muted"
                             : "border-light-grey bg-very-light-grey text-dark-charcoal placeholder-dark-charcoal/40"
                    } ${searchQuery ? (isDark ? "border-primary-blue/40" : "border-primary-blue/30") : ""}`}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery("")}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${muted} hover:text-primary-blue`}>
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* State */}
              <div>
                <label className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-wide ${muted}`}>
                  State
                </label>
                <div className="relative">
                  <select
                    value={filterState}
                    onChange={e => setFilterState(e.target.value)}
                    className={`w-full appearance-none rounded-xl border py-2.5 pl-3 pr-9 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-blue/30 ${
                      isDark ? "border-dark-border bg-dark-bg text-dark-text"
                             : "border-light-grey bg-very-light-grey text-dark-charcoal"
                    } ${filterState ? (isDark ? "border-primary-blue/50 bg-primary-blue/5" : "border-primary-blue/30 bg-light-blue/10") : ""}`}>
                    <option value="">All States ({availableStates.length})</option>
                    {availableStates.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDownIcon className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${muted}`} />
                </div>
              </div>

              {/* City / Area — cascades from state */}
              <div>
                <label className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-wide ${muted}`}>
                  City / Area
                </label>
                <div className="relative">
                  <select
                    value={filterCity}
                    onChange={e => setFilterCity(e.target.value)}
                    disabled={availableCities.length === 0}
                    className={`w-full appearance-none rounded-xl border py-2.5 pl-3 pr-9 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-blue/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isDark ? "border-dark-border bg-dark-bg text-dark-text"
                             : "border-light-grey bg-very-light-grey text-dark-charcoal"
                    } ${filterCity ? (isDark ? "border-primary-blue/50 bg-primary-blue/5" : "border-primary-blue/30 bg-light-blue/10") : ""}`}>
                    <option value="">All Cities ({availableCities.length})</option>
                    {availableCities.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDownIcon className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${muted}`} />
                </div>
              </div>

              {/* Status multi-select chips */}
              <div>
                <label className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-wide ${muted}`}>
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map(opt => {
                    const on = filterStatuses.has(opt.key);
                    return (
                      <button key={opt.key} type="button" onClick={() => toggleStatus(opt.key)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                          on
                            ? "bg-primary-blue text-pure-white shadow-sm scale-[1.02]"
                            : isDark
                              ? "bg-dark-bg text-dark-text hover:bg-dark-border/60"
                              : "bg-very-light-grey text-dark-charcoal hover:bg-light-grey"
                        }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-pure-white/80" : opt.dotClass}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Active filter chips row */}
            {activeFilterCount > 0 && (
              <div className={`mt-4 flex flex-wrap items-center gap-2 border-t pt-3 ${isDark ? "border-dark-border" : "border-light-grey"}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${muted}`}>Active filters:</span>

                {filterState && (
                  <FilterChip label="State" value={filterState} isDark={isDark}
                    onRemove={() => setFilterState("")} />
                )}
                {filterCity && (
                  <FilterChip label="City" value={filterCity} isDark={isDark}
                    onRemove={() => setFilterCity("")} />
                )}
                {[...filterStatuses].map(s => (
                  <FilterChip key={s} label="Status"
                    value={STATUS_OPTIONS.find(o => o.key === s)?.label ?? s}
                    isDark={isDark} onRemove={() => toggleStatus(s)} />
                ))}
                {searchQuery.trim() && (
                  <FilterChip label="Search" value={`"${searchQuery.trim()}"`} isDark={isDark}
                    onRemove={() => setSearchQuery("")} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)]">

        {/* Left column */}
        <div className="flex flex-col gap-5">

          {/* Map card */}
          <article className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`text-xs uppercase tracking-wide ${muted}`}>Live View</p>
                <h2 className={`text-lg font-semibold ${body}`}>IoT Sensor Nodes</h2>
              </div>
              <div className={`flex flex-wrap items-center gap-4 text-sm font-semibold ${body}`}>
                <span>Online: <span className="text-status-green">{stats.online}</span></span>
                <span>Offline: <span className="text-primary-blue">{stats.offline}</span></span>
                {activeFilterCount > 0 && (
                  <span className={`text-xs font-medium ${muted}`}>({stats.total} / {stats.totalAll} shown)</span>
                )}
              </div>
            </div>

            {/* Recently updated chip bar */}
            {recentlyUpdated.length > 0 && (
              <div className="mt-4">
                <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${muted}`}>
                  Recently Updated
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentlyUpdated.map((node, i) => (
                    <button key={node._id} type="button" onClick={() => focusNode(node._id)}
                      title={`Jump to ${node.node_id}${node.location ? ` · ${node.location}` : ""}`}
                      className={`group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        isDark ? "border-dark-border bg-dark-bg hover:border-amber-400/60 hover:bg-amber-400/10 text-dark-text"
                               : "border-light-grey bg-very-light-grey hover:border-amber-400 hover:bg-amber-50 text-dark-charcoal"}`}>
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                        i === 0 ? "bg-amber-400 text-dark-charcoal"
                                : isDark ? "bg-dark-border text-dark-text-muted" : "bg-light-grey text-dark-charcoal/60"}`}>
                        {i + 1}
                      </span>
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusDotClass(node)}`} />
                      <span>{node.node_id}</span>
                      {node.area && <span className={muted}>· {node.area}</span>}
                      <span className={`text-[10px] ${muted}`}>{formatTimeAgo(new Date(node.last_updated))}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`mt-4 rounded-3xl border ${isDark ? "border-dark-border" : "border-light-grey"}`}>
              <NodeMap
                nodes={filteredNodes}
                height={460}
                zoom={12}
                focusNodeId={focusNodeId}
                highlightedIds={recentlyUpdatedIds}
                favouriteIds={favouriteIds}
                onToggleFavourite={toggleFavourite}
              />
            </div>

            {/* Water-level legend row */}
            <div className={`mt-4 flex flex-wrap items-center gap-4 text-sm ${sub}`}>
              <span className={`font-semibold ${body}`}>Water Level:</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-green" /> Normal ({stats.normal})</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-warning-1" /> Alert ({stats.alert})</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-warning-2" /> Warning ({stats.warning})</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-danger" /> Critical ({stats.critical})</span>
            </div>
          </article>

          {/* All-nodes grid */}
          <article className={card}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className={`text-base font-semibold ${body}`}>All Sensor Nodes</h2>
                <p className={`text-xs ${muted}`}>
                  Click a node to focus the map · click ★ to add to Favourites
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isDark ? "bg-dark-bg text-dark-text-muted" : "bg-very-light-grey text-dark-charcoal/60"}`}>
                {stats.total}{activeFilterCount > 0 ? ` / ${stats.totalAll}` : ""} nodes
              </span>
            </div>

            {filteredNodes.length === 0 ? (
              /* Empty state */
              <div className={`flex flex-col items-center gap-3 rounded-2xl py-12 ${isDark ? "bg-dark-bg" : "bg-very-light-grey"}`}>
                <FilterIcon className={`h-10 w-10 ${isDark ? "text-dark-border" : "text-light-grey"}`} />
                <div className="text-center">
                  <p className={`text-sm font-semibold ${body}`}>No nodes match your filters</p>
                  <p className={`mt-1 text-xs ${muted}`}>
                    Try broadening your criteria or clearing all filters.
                  </p>
                </div>
                <button type="button" onClick={clearAll}
                  className="rounded-lg bg-primary-blue px-4 py-2 text-xs font-semibold text-pure-white transition hover:bg-primary-blue/90">
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {filteredNodes.map(node => {
                  const isFav = favouriteIds.has(node._id);
                  return (
                    <div key={node._id}
                      className={`group relative flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-xs transition-colors ${
                        isFav
                          ? isDark ? "border-amber-400/30 bg-amber-400/10" : "border-amber-200 bg-amber-50"
                          : isDark ? "border-transparent bg-dark-bg hover:bg-dark-border/40" : "border-transparent bg-very-light-grey hover:bg-light-grey"}`}>
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusDotClass(node)}`} />
                      <div className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => focusNode(node._id)}
                        title={`Focus: ${node.node_id}${node.location ? ` · ${node.location}` : ""}`}>
                        <p className={`truncate font-semibold hover:underline ${body}`}>{node.node_id}</p>
                        {(node.location || node.area) && (
                          <p className={`truncate text-[10px] leading-tight ${muted}`}>
                            {[node.location, node.area].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <span className={`flex-shrink-0 font-mono text-[10px] ${muted}`}>{node.current_level}ft</span>
                      <button type="button" onClick={() => toggleFavourite(node._id)}
                        title={isFav ? "Remove from favourites" : "Add to favourites"}
                        className={`flex-shrink-0 transition-colors ${
                          isFav ? "text-amber-400 hover:text-amber-500"
                                : `opacity-0 group-hover:opacity-100 ${isDark ? "text-dark-text-muted hover:text-amber-400" : "text-dark-charcoal/30 hover:text-amber-400"}`}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                          fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"
                          className="h-3.5 w-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </div>

        {/* Right sidebar */}
        <aside className="flex flex-col gap-5">

          {/* Filter summary — shown only when filters are active */}
          {activeFilterCount > 0 && (
            <div className={card}>
              <div className="mb-3 flex items-center gap-2">
                <FilterIcon className={`h-4 w-4 ${muted}`} />
                <h2 className={`text-sm font-bold uppercase tracking-wide ${body}`}>Filter Summary</h2>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: "Normal",   value: stats.normal,   dot: "bg-status-green"    },
                  { label: "Alert",    value: stats.alert,    dot: "bg-status-warning-1" },
                  { label: "Warning",  value: stats.warning,  dot: "bg-status-warning-2" },
                  { label: "Critical", value: stats.critical, dot: "bg-status-danger"    },
                  { label: "Offline",  value: stats.offline,  dot: "bg-gray-400"         },
                ].map(row => (
                  <div key={row.label}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 ${isDark ? "bg-dark-bg" : "bg-very-light-grey"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${row.dot}`} />
                      <span className={`text-xs font-medium ${sub}`}>{row.label}</span>
                    </div>
                    <span className={`text-xs font-bold ${body}`}>{row.value}</span>
                  </div>
                ))}
              </div>
              <p className={`mt-3 text-center text-xs ${muted}`}>
                {stats.total} of {stats.totalAll} nodes visible
              </p>
            </div>
          )}

          {/* Favourites */}
          <div className={card}>
            <div className="mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                className="h-4 w-4 text-amber-400">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005z" clipRule="evenodd" />
              </svg>
              <h2 className={`text-sm font-bold uppercase tracking-wide ${body}`}>Favourites</h2>
              {favouriteNodes.length > 0 && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                  {favouriteNodes.length}
                </span>
              )}
            </div>

            {favouriteNodes.length === 0 ? (
              <div className={`flex flex-col items-center gap-1.5 rounded-2xl py-6 ${isDark ? "bg-dark-bg" : "bg-very-light-grey"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" className={`h-7 w-7 ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/30"}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                <p className={`px-4 text-center text-xs leading-relaxed ${muted}`}>
                  Click ★ on any node to pin it here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {favouriteNodes.map(node => (
                  <div key={node._id}
                    className={`group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 transition-colors ${
                      isDark ? "bg-dark-bg hover:bg-dark-border/40" : "bg-very-light-grey hover:bg-amber-50"}`}
                    onClick={() => focusNode(node._id)} title="Click to focus on map">
                    <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${statusDotClass(node)}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs font-semibold ${body}`}>{node.node_id}</p>
                      <p className={`text-[10px] ${muted}`}>{statusLabel(node)} · {node.current_level}ft</p>
                      {(node.location || node.area) && (
                        <p className={`mt-0.5 truncate text-[9px] ${isDark ? "text-dark-text-muted/70" : "text-dark-charcoal/35"}`}>
                          {[node.location, node.area].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2"
                      className={`h-3.5 w-3.5 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-60 ${body}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <button type="button"
                      onClick={e => { e.stopPropagation(); toggleFavourite(node._id); }}
                      className="flex-shrink-0 text-amber-400 transition-colors hover:text-amber-500"
                      title="Remove from favourites">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status legend */}
          <div className={card}>
            <h2 className={`text-lg font-semibold ${body}`}>Status Legend</h2>
            <p className={`text-xs ${sub}`}>Every pin follows the Sarawak flood SOP levels.</p>
            <ul className="mt-4 space-y-3">
              {STATUS_LEGEND.map(legend => (
                <li key={legend.label}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
                    isDark ? "border-dark-border bg-dark-bg" : "border-light-grey"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${legend.color}`}>
                      {legend.water_level}
                    </span>
                    <div>
                      <p className={`text-sm font-semibold ${body}`}>{legend.label}</p>
                      <p className={`text-xs ${sub}`}>{legend.description}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary-blue">LVL {legend.water_level}</span>
                </li>
              ))}
            </ul>
            <div className={`mt-4 rounded-2xl px-4 py-3 text-xs ${isDark ? "bg-dark-bg text-dark-text-secondary" : "bg-very-light-grey text-dark-charcoal/70"}`}>
              <p className={`font-semibold uppercase tracking-wide ${body}`}>Map Info</p>
              <p>Total: {stats.totalAll} · Visible: {stats.total} · Online: {stats.online} · Offline: {stats.offline}</p>
              <p className="mt-0.5">Auto-refreshes in Live mode.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

// ── FilterChip sub-component ──────────────────────────────────────────────────

function FilterChip({
  label, value, isDark, onRemove,
}: {
  label: string;
  value: string;
  isDark: boolean;
  onRemove: () => void;
}) {
  return (
    <span className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${
      isDark ? "border-dark-border bg-dark-bg text-dark-text" : "border-light-grey bg-very-light-grey text-dark-charcoal"}`}>
      <span className={`text-[10px] ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/50"}`}>{label}:</span>
      {value}
      <button type="button" onClick={onRemove}
        className="ml-0.5 text-primary-blue transition-opacity hover:opacity-70">
        <XMarkIcon className="h-3 w-3" />
      </button>
    </span>
  );
}
