"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import OverviewCard from "@/components/cards/OverviewCard";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";

// ─── Types matching AnalyticsDataDto ────────────────────────────────────────
interface StatDto        { label: string; value: string; icon: string; trend: string; }
interface WaterLevelDto  { nodeId: string; level: number; status: string; }
interface FloodByStateDto{ state: string; total: number; }
interface RecentEventDto { title: string; timestamp: string; type: string; }

interface AnalyticsData {
  stats:            StatDto[];
  chartData:        number[];
  yearlyChartData:  number[];
  waterLevelByNode: WaterLevelDto[];
  floodByState:     FloodByStateDto[];
  recentEvents:     RecentEventDto[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const LEVEL_TO_METERS: Record<number, number> = { 0: 0.0, 1: 1.0, 2: 2.5, 3: 4.0 };

function levelColor(level: number): string {
  if (level >= 3) return "#ED1C24";
  if (level === 2) return "#FF9F1C";
  if (level === 1) return "#FFD54F";
  return "#56E40A";
}

const PIE_COLORS = ["#ED1C24", "#FF9F1C", "#56E40A", "#BFBFBF"];

const bubbleLegendData = [
  { value: "Safe (0 ft)",      color: "#56E40A" },
  { value: "Warning L1 (1 ft)", color: "#FFD54F" },
  { value: "Warning L2 (2 ft)", color: "#FF9F1C" },
  { value: "Danger (3+ ft)",   color: "#ED1C24" },
];

// Last 7 day labels
const weekLabels = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return d.toLocaleDateString("en-MY", { weekday: "short", day: "numeric" });
});

// Last 5 month labels
const monthLabels = Array.from({ length: 5 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - (4 - i));
  return d.toLocaleDateString("en-MY", { month: "short", year: "2-digit" });
});

export default function AnalyticsPage() {
  const { isDark } = useTheme();
  const { accessToken } = useAuth();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // nodeGpsMap: keyed by node_id — populated from /api/nodes to provide real lat/lng
  // for the bubble scatter map (analytics response only has nodeId, level, status).
  const [nodeGpsMap, setNodeGpsMap] = useState<Record<string, { latitude: number; longitude: number }>>({});

  // Chart colors
  const chartTextColor  = isDark ? "#a0a0a0" : "#4E4B4B";
  const chartGridColor  = isDark ? "#2d3a5a" : "#E5E5E5";
  const tooltipBg       = isDark ? "#16213e" : "#ffffff";
  const tooltipBorder   = isDark ? "#2d3a5a" : "#BFBFBF";

  useEffect(() => {
    if (!accessToken) return;

    // Fetch analytics KPI / chart data
    fetch("/api/analytics", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d: AnalyticsData) => setData(d))
      .catch((err) => {
        console.error("Analytics fetch failed:", err);
        toast.error("Failed to load analytics. Please refresh.");
      })
      .finally(() => setIsLoading(false));

    // BUG-ANAL01: Fetch real sensor GPS from /api/nodes so the bubble map uses
    // actual coordinates instead of hardcoded fake offsets around Kuching.
    // /api/nodes returns { success, data: NodeData[], count, timestamp }
    fetch("/api/nodes", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((result) => {
        const nodes: Array<{ node_id: string; latitude: number; longitude: number }> =
          Array.isArray(result) ? result : (result.data ?? []);
        const map: Record<string, { latitude: number; longitude: number }> = {};
        nodes.forEach((n) => {
          if (n.node_id && n.latitude != null && n.longitude != null) {
            map[n.node_id] = { latitude: n.latitude, longitude: n.longitude };
          }
        });
        setNodeGpsMap(map);
      })
      .catch(() => {
        // Silently fail — bubble map will render empty rather than show fake GPS
        console.warn("Node GPS fetch failed; bubble map will show no data.");
      });
  }, [accessToken]);

  // ── Derived chart data ───────────────────────────────────────────────────
  const lineChartData = (data?.chartData ?? Array(7).fill(0)).map((v, i) => ({
    name: weekLabels[i],
    events: v,
  }));

  const yearlyChartData = (data?.yearlyChartData ?? Array(5).fill(0)).map((v, i) => ({
    name: monthLabels[i],
    events: v,
  }));

  const barChartData = (data?.waterLevelByNode ?? []).map((n) => ({
    name: n.nodeId.slice(-6),
    level: LEVEL_TO_METERS[n.level] ?? 0,
    rawLevel: n.level,
  }));

  const stateBarData = (data?.floodByState ?? []).map((s) => ({
    name: s.state,
    total: s.total,
  }));

  // BUG-ANAL01 FIX: Join waterLevelByNode with real GPS from /api/nodes.
  // Only nodes whose node_id is in nodeGpsMap are plotted (no fake offsets).
  const bubbleData = (data?.waterLevelByNode ?? [])
    .filter((n) => nodeGpsMap[n.nodeId])
    .map((n) => ({
      x: nodeGpsMap[n.nodeId].longitude,
      y: nodeGpsMap[n.nodeId].latitude,
      z: (n.level + 1) * 120,
      name: n.nodeId,
      level: n.level,
    }));

  // KPI cards from stats array
  const kpiCards = data?.stats ?? [
    { label: "Active Sensors", value: "—", trend: "—", icon: "" },
    { label: "Alerts (24h)",   value: "—", trend: "—", icon: "" },
    { label: "Data Points",    value: "—", trend: "—", icon: "" },
  ];

  const pieChartData = stateBarData.map((s, i) => ({
    name: s.name,
    value: s.total,
    color: PIE_COLORS[i % PIE_COLORS.length],
  })).filter(d => d.value > 0);

  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className={`h-12 w-12 animate-spin rounded-full border-4 ${isDark ? "border-dark-border border-t-primary-red" : "border-light-grey border-t-primary-red"}`} />
            <p className={`text-sm font-medium ${isDark ? "text-dark-text-secondary" : "text-dark-charcoal/70"}`}>
              Loading analytics...
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1
          className={`text-3xl font-semibold transition-colors ${
            isDark ? "text-dark-text" : "text-dark-charcoal"
          }`}
        >
          Analytics
        </h1>
        <p
          className={`text-sm transition-colors ${
            isDark ? "text-dark-text-secondary" : "text-dark-charcoal/70"
          }`}
        >
          Insights derived from live sensor telemetry to aid planning and mitigation.
        </p>
      </header>

      {/* ─── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {kpiCards.map((card) => (
          <OverviewCard
            key={card.label}
            title={card.label}
            value={card.value}
            helper="Live from sensor network"
            trend={{ label: card.trend, direction: "flat" }}
          />
        ))}
      </div>

      {/* ─── Row 1: Weekly trend + Water Level by Node ───────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <article
          className={`rounded-3xl border p-5 shadow-sm transition-colors ${
            isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg font-semibold transition-colors ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
                Event Trend (7 Days)
              </h2>
              <p className={`text-xs uppercase tracking-wide transition-colors ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/60"}`}>
                Sensor events per day
              </p>
            </div>
            <span className="rounded-full bg-light-red/70 px-3 py-1 text-xs font-semibold text-primary-red dark:bg-primary-red/20">
              Weekly
            </span>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineChartData}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ED1C24" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ED1C24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: chartTextColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, fontSize: 12, backgroundColor: tooltipBg, color: isDark ? "#e8e8e8" : "#4E4B4B" }}
                  formatter={(value: unknown) => [value, "Events"]}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 500, color: chartTextColor }} />
                <Area type="monotone" dataKey="events" name="Events" stroke="#ED1C24" strokeWidth={2} fill="url(#colorEvents)" dot={{ r: 4, fill: "#ED1C24" }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article
          className={`rounded-3xl border p-5 shadow-sm transition-colors ${
            isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"
          }`}
        >
          <h2 className={`text-lg font-semibold transition-colors ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
            Water Level by Node
          </h2>
          <p className={`text-xs uppercase tracking-wide transition-colors ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/60"}`}>
            Top 10 nodes — current readings (m)
          </p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} label={{ value: "Node ID", position: "insideBottom", offset: -5, fontSize: 11, fill: chartTextColor }} />
                <YAxis tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} domain={[0, 4.5]} label={{ value: "Level (m)", angle: -90, position: "insideLeft", fontSize: 11, fill: chartTextColor }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, fontSize: 12, backgroundColor: tooltipBg, color: isDark ? "#e8e8e8" : "#4E4B4B" }}
                  formatter={(value: unknown) => [`${value} m`, "Water Level"]}
                />
                <Legend verticalAlign="top" height={36} iconType="square" wrapperStyle={{ fontSize: 12, fontWeight: 500, color: chartTextColor }} />
                <Bar dataKey="level" name="Water Level" radius={[6, 6, 0, 0]}>
                  {barChartData.map((entry) => (
                    <Cell key={entry.name} fill={levelColor(entry.rawLevel)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      {/* ─── Row 2: Monthly trend + Bubble map ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <article
          className={`rounded-3xl border p-5 shadow-sm transition-colors ${
            isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg font-semibold transition-colors ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
                Monthly Event Volume
              </h2>
              <p className={`text-xs uppercase tracking-wide transition-colors ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/60"}`}>
                Last 5 months
              </p>
            </div>
            <span className="rounded-full bg-light-red/70 px-3 py-1 text-xs font-semibold text-primary-red dark:bg-primary-red/20">
              Monthly
            </span>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearlyChartData}>
                <defs>
                  <linearGradient id="colorMonthly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ED1C24" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ED1C24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, fontSize: 12, backgroundColor: tooltipBg, color: isDark ? "#e8e8e8" : "#4E4B4B" }}
                  formatter={(value: unknown) => [value, "Events"]}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 500, color: chartTextColor }} />
                <Area type="monotone" dataKey="events" name="Events" stroke="#ED1C24" strokeWidth={2} fill="url(#colorMonthly)" dot={{ r: 4, fill: "#ED1C24" }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article
          className={`rounded-3xl border p-5 shadow-sm transition-colors ${
            isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"
          }`}
        >
          <h2 className={`text-lg font-semibold transition-colors ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
            Node Severity Bubble Map
          </h2>
          <p className={`text-xs uppercase tracking-wide transition-colors ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/60"}`}>
            Real GPS coordinates · bubble size = water level severity
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {bubbleLegendData.map((item) => (
              <div key={item.value} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className={`text-[10px] font-medium transition-colors ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 h-64">
            {bubbleData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <span className={`text-3xl`}>📡</span>
                <p className={`text-sm font-medium ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/60"}`}>
                  No GPS data available for mapped nodes.
                </p>
                <p className={`text-xs ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/50"}`}>
                  Ensure sensor nodes have valid coordinates registered.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                  <XAxis type="number" dataKey="x" name="Longitude" tick={{ fontSize: 10, fill: chartTextColor }} domain={["dataMin - 0.1", "dataMax + 0.1"]} tickFormatter={(v) => v.toFixed(2)} label={{ value: "Longitude (°E)", position: "insideBottom", offset: -5, fontSize: 11, fill: chartTextColor }} />
                  <YAxis type="number" dataKey="y" name="Latitude"  tick={{ fontSize: 10, fill: chartTextColor }} domain={["dataMin - 0.05", "dataMax + 0.05"]} tickFormatter={(v) => v.toFixed(2)} label={{ value: "Latitude (°N)", angle: -90, position: "insideLeft", fontSize: 11, fill: chartTextColor }} />
                  <ZAxis type="number" dataKey="z" range={[60, 400]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, fontSize: 12, backgroundColor: tooltipBg, color: isDark ? "#e8e8e8" : "#4E4B4B" }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: unknown, name: unknown) => {
                      if (name === "z") return null;
                      return [typeof value === "number" ? value.toFixed(4) : value, name];
                    }) as any}
                  />
                  <Scatter name="Nodes" data={bubbleData}>
                    {bubbleData.map((entry) => (
                      <Cell key={entry.name} fill={levelColor(entry.level)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </div>

      {/* ─── Row 3: Flood by State ───────────────────────────────────────────── */}
      <article
        className={`rounded-3xl border p-5 shadow-sm transition-colors ${
          isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"
        }`}
      >
        <h2 className={`text-lg font-semibold transition-colors ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
          Total Flood Incidents by State
        </h2>
        <p className={`text-xs uppercase tracking-wide transition-colors ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/60"}`}>
          Cumulative alert events per state
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stateBarData} layout="vertical" barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
              <XAxis type="number" tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} label={{ value: "Number of Incidents", position: "insideBottom", offset: -5, fontSize: 11, fill: chartTextColor }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: chartTextColor }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, fontSize: 12, backgroundColor: tooltipBg, color: isDark ? "#e8e8e8" : "#4E4B4B" }}
              />
              <Legend verticalAlign="top" height={36} iconType="square" wrapperStyle={{ fontSize: 12, fontWeight: 500, color: chartTextColor }} />
              <Bar dataKey="total" name="Total Incidents" fill="#ED1C24" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      {/* ─── Recent Events ───────────────────────────────────────────────────── */}
      <article
        className={`rounded-3xl border p-5 shadow-sm transition-colors ${
          isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"
        }`}
      >
        <h2 className={`text-lg font-semibold transition-colors ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
          Recent Events
        </h2>
        <ul className="mt-4 space-y-3">
          {(data?.recentEvents ?? []).map((event, i) => (
            <li
              key={i}
              className={`flex items-start justify-between rounded-2xl border px-4 py-3 transition-colors ${
                isDark ? "border-dark-border bg-dark-bg" : "border-light-grey"
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${event.type === "warning" ? "text-primary-red" : isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
                  {event.title}
                </p>
                <p className={`text-xs mt-0.5 transition-colors ${isDark ? "text-dark-text-muted" : "text-dark-charcoal/60"}`}>
                  {event.timestamp}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                event.type === "warning"
                  ? "bg-primary-red/20 text-primary-red"
                  : "bg-status-green/20 text-status-green"
              }`}>
                {event.type}
              </span>
            </li>
          ))}
        </ul>
      </article>

      {/* ─── Recommendation Engine ──────────────────────────────────────────── */}
      <article
        className={`rounded-3xl border p-5 shadow-sm transition-colors ${
          isDark ? "border-dark-border bg-dark-card" : "border-light-grey bg-pure-white"
        }`}
      >
        <h2 className={`text-lg font-semibold transition-colors ${isDark ? "text-dark-text" : "text-dark-charcoal"}`}>
          Recommendation Engine
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className={`rounded-2xl border p-4 transition-colors ${isDark ? "border-dark-border" : "border-light-grey"}`}>
            <p className="text-sm font-semibold text-primary-red">Escalate</p>
            <p className={`mt-2 text-sm transition-colors ${isDark ? "text-dark-text-secondary" : "text-dark-charcoal/80"}`}>
              {data?.waterLevelByNode?.[0]
                ? `Node ${data.waterLevelByNode[0].nodeId} is at level ${data.waterLevelByNode[0].level} (${data.waterLevelByNode[0].status}). Monitor closely.`
                : "No critical nodes detected."}
            </p>
          </div>
          <div className={`rounded-2xl border p-4 transition-colors ${isDark ? "border-dark-border" : "border-light-grey"}`}>
            <p className="text-sm font-semibold text-status-warning-2">Preventive</p>
            <p className={`mt-2 text-sm transition-colors ${isDark ? "text-dark-text-secondary" : "text-dark-charcoal/80"}`}>
              Schedule maintenance for offline nodes. Check sensor calibration for nodes reporting steady level 3.
            </p>
          </div>
          <div className={`rounded-2xl border p-4 transition-colors ${isDark ? "border-dark-border" : "border-light-grey"}`}>
            <p className="text-sm font-semibold text-status-green">Operational</p>
            <p className={`mt-2 text-sm transition-colors ${isDark ? "text-dark-text-secondary" : "text-dark-charcoal/80"}`}>
              Auto-share a CSV snapshot with the command center every 6 hours.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}
