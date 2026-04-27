/**
 * MongoDB → Neon PostgreSQL migration
 * Run: node migrate.mjs   (from the fyp-flood-monitoring root)
 *
 * Steps:
 *  1. Connect to Neon and check if data already exists
 *  2. If data found → report and exit (no overwrite)
 *  3. If empty     → create schema + bulk-insert all 8 collections
 *
 * The 200 k events are inserted in chunks of 500 using
 * postgres json_array_elements() to avoid per-row round-trips.
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir   = dirname(fileURLToPath(import.meta.url));
const EXPORT  = join(__dir, "..", "mongodb-export");

const DATABASE_URL =
  "postgresql://neondb_owner:npg_wWQz47ALcopb@ep-empty-wave-anxnq609-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const sql = neon(DATABASE_URL);

// ── helpers ───────────────────────────────────────────────────────────────────

const load = (name) =>
  JSON.parse(readFileSync(join(EXPORT, name + ".json"), "utf8"));

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ts(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── step 1: existence check ───────────────────────────────────────────────────

async function checkExisting() {
  console.log("\n🔍  Checking Neon database for existing tables / data…\n");

  const tableRows = await sql`
    SELECT table_name
    FROM   information_schema.tables
    WHERE  table_schema = 'public'
    ORDER  BY table_name
  `;
  const tableNames = tableRows.map((r) => r.table_name);

  if (tableNames.length === 0) {
    console.log("  Tables found  : (none)");
    console.log("  → Fresh database. Will create schema and insert data.\n");
    return { hasData: false, tableNames };
  }

  console.log("  Tables found  :", tableNames.join(", "));

  // Check row counts for the key collections (use separate tagged queries — no dynamic SQL)
  async function countIf(table, query) {
    if (!tableNames.includes(table)) return null;
    const [row] = await query();
    return row.c;
  }

  const report = {
    nodes:       await countIf("nodes",       () => sql`SELECT COUNT(*)::int AS c FROM nodes`),
    events:      await countIf("events",      () => sql`SELECT COUNT(*)::int AS c FROM events`),
    users:       await countIf("users",       () => sql`SELECT COUNT(*)::int AS c FROM users`),
    commands:    await countIf("commands",    () => sql`SELECT COUNT(*)::int AS c FROM commands`),
    heartbeats:  await countIf("heartbeats",  () => sql`SELECT COUNT(*)::int AS c FROM heartbeats`),
    master_logs: await countIf("master_logs", () => sql`SELECT COUNT(*)::int AS c FROM master_logs`),
    data_updates:await countIf("data_updates",() => sql`SELECT COUNT(*)::int AS c FROM data_updates`),
  };

  let anyData = false;
  console.log("\n  Row counts:");
  for (const [t, c] of Object.entries(report)) {
    const label = c === null ? "(table missing)" : c.toLocaleString();
    console.log(`    ${t.padEnd(20)} → ${label}`);
    if (c !== null && c > 0) anyData = true;
  }
  console.log();
  return { hasData: anyData, tableNames };
}

// ── step 2: schema ────────────────────────────────────────────────────────────

async function createSchema() {
  console.log("📐  Creating / verifying schema…");

  await sql`
    CREATE TABLE IF NOT EXISTS sensor_nodes (
      id            TEXT PRIMARY KEY,
      node_id       TEXT        NOT NULL,
      latitude      DOUBLE PRECISION,
      longitude     DOUBLE PRECISION,
      current_level INTEGER     DEFAULT 0,
      is_dead       BOOLEAN     DEFAULT false,
      last_updated  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sn_node_id ON sensor_nodes(node_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS water_level_events (
      id         TEXT PRIMARY KEY,
      node_id    TEXT        NOT NULL,
      event_type TEXT,
      new_level  INTEGER,
      created_at TIMESTAMPTZ
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_wle_node_id    ON water_level_events(node_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_wle_created_at ON water_level_events(created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS node_heartbeats (
      id            TEXT PRIMARY KEY,
      node_id       TEXT        NOT NULL,
      timestamp     TIMESTAMPTZ,
      status        TEXT,
      checked_by    TEXT,
      response_time TIMESTAMPTZ
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS node_commands (
      id                TEXT PRIMARY KEY,
      command_id        INTEGER,
      node_id           TEXT        NOT NULL,
      from_master       TEXT,
      to_node           TEXT,
      action            TEXT,
      timestamp         TIMESTAMPTZ,
      status            TEXT,
      ack_received      BOOLEAN,
      ack_response_time TIMESTAMPTZ
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS master_logs (
      id        TEXT PRIMARY KEY,
      log_id    INTEGER,
      master_id TEXT,
      action    TEXT,
      timestamp TIMESTAMPTZ,
      details   JSONB
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS sensor_data_updates (
      id                 TEXT PRIMARY KEY,
      node_id            TEXT        NOT NULL,
      timestamp          TIMESTAMPTZ,
      temperature        DOUBLE PRECISION,
      humidity           DOUBLE PRECISION,
      water_level_meters DOUBLE PRECISION,
      gps_latitude       DOUBLE PRECISION,
      gps_longitude      DOUBLE PRECISION,
      raw_message        TEXT
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id               TEXT PRIMARY KEY,
      user_id          INTEGER,
      first_name       TEXT,
      last_name        TEXT,
      email            TEXT UNIQUE,
      password_hash    TEXT,
      role             TEXT,
      last_login       TIMESTAMPTZ,
      registered_nodes TEXT[]
    )`;

  console.log("  ✓ Schema ready\n");
}

// ── step 3: insert helpers ────────────────────────────────────────────────────

async function insertNodes() {
  const rows = load("nodes");
  console.log(`📡  Inserting ${rows.length} sensor nodes…`);
  for (const r of rows) {
    await sql`
      INSERT INTO sensor_nodes
        (id, node_id, latitude, longitude, current_level, is_dead, last_updated, created_at)
      VALUES
        (${r._id}, ${r.node_id}, ${r.latitude ?? null}, ${r.longitude ?? null},
         ${r.current_level ?? 0}, ${r.is_dead ?? false},
         ${ts(r.last_updated)}, ${ts(r.created_at)})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${rows.length} nodes\n`);
}

async function insertHeartbeats() {
  const rows = load("heartbeats");
  console.log(`💓  Inserting ${rows.length} heartbeats…`);
  for (const r of rows) {
    await sql`
      INSERT INTO node_heartbeats
        (id, node_id, timestamp, status, checked_by, response_time)
      VALUES
        (${r._id}, ${r.node_id}, ${ts(r.timestamp)}, ${r.status ?? null},
         ${r.master_check?.checkedBy ?? null}, ${ts(r.master_check?.responseTime)})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${rows.length} heartbeats\n`);
}

async function insertCommands() {
  const rows = load("commands");
  console.log(`📟  Inserting ${rows.length} commands…`);
  for (const r of rows) {
    await sql`
      INSERT INTO node_commands
        (id, command_id, node_id, from_master, to_node, action, timestamp,
         status, ack_received, ack_response_time)
      VALUES
        (${r._id}, ${r.command_id ?? null}, ${r.node_id},
         ${r.from ?? null}, ${r.to ?? null}, ${r.action ?? null},
         ${ts(r.timestamp)}, ${r.status ?? null},
         ${r.ack?.received ?? null}, ${ts(r.ack?.response_time)})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${rows.length} commands\n`);
}

async function insertMasterLogs() {
  const rows = load("master_logs");
  console.log(`📋  Inserting ${rows.length} master logs…`);
  for (const r of rows) {
    await sql`
      INSERT INTO master_logs (id, log_id, master_id, action, timestamp, details)
      VALUES
        (${r._id}, ${r.log_id ?? null}, ${r.master_id ?? null},
         ${r.action ?? null}, ${ts(r.timestamp)},
         ${JSON.stringify(r.details ?? {})})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${rows.length} master logs\n`);
}

async function insertDataUpdates() {
  const rows = load("data_updates");
  console.log(`🌡️   Inserting ${rows.length} sensor data updates…`);
  for (const r of rows) {
    await sql`
      INSERT INTO sensor_data_updates
        (id, node_id, timestamp, temperature, humidity,
         water_level_meters, gps_latitude, gps_longitude, raw_message)
      VALUES
        (${r._id}, ${r.node_id}, ${ts(r.timestamp)},
         ${r.sensor_data?.temperature ?? null},
         ${r.sensor_data?.humidity    ?? null},
         ${r.sensor_data?.water_level ?? null},
         ${r.gps_data?.latitude       ?? null},
         ${r.gps_data?.longitude      ?? null},
         ${r.raw_message              ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${rows.length} data updates\n`);
}

async function insertUsers() {
  const admins    = load("user_admins");
  const customers = load("user_customers");
  const all       = [...admins, ...customers];
  console.log(`👤  Inserting ${all.length} users (${admins.length} admin, ${customers.length} customer)…`);
  for (const r of all) {
    await sql`
      INSERT INTO users
        (id, user_id, first_name, last_name, email, password_hash,
         role, last_login, registered_nodes)
      VALUES
        (${r._id}, ${r.user_id ?? null},
         ${r.first_name ?? null}, ${r.last_name ?? null},
         ${r.email ?? null}, ${r.password ?? null},
         ${r.role ?? null}, ${ts(r.last_login)},
         ${r.registered_nodes ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`  ✓ ${all.length} users\n`);
}

/**
 * Bulk-insert events using json_array_elements() so we send 500 rows
 * per HTTP request instead of one row per request.
 */
async function insertEvents() {
  const rows   = load("events");
  const BATCH  = 500;
  const groups = chunks(rows, BATCH);
  const total  = rows.length;

  console.log(`⚡  Inserting ${total.toLocaleString()} water level events`);
  console.log(`    (${groups.length} batches of ${BATCH}) — this may take a few minutes…`);

  let done = 0;
  for (const batch of groups) {
    // Normalise each row to a plain object for JSON serialisation
    const jsonRows = batch.map((r) => ({
      id:         r._id,
      node_id:    r.node_id,
      event_type: r.event_type ?? "water_level_update",
      new_level:  r.new_level  ?? null,
      created_at: ts(r.created_at),
    }));

    // Use postgres json_array_elements to unpack the array server-side
    await sql`
      INSERT INTO water_level_events (id, node_id, event_type, new_level, created_at)
      SELECT
        (elem->>'id')::text,
        (elem->>'node_id')::text,
        (elem->>'event_type')::text,
        (elem->>'new_level')::integer,
        (elem->>'created_at')::timestamptz
      FROM json_array_elements(${JSON.stringify(jsonRows)}::json) AS elem
      ON CONFLICT (id) DO NOTHING
    `;

    done += batch.length;
    const pct = Math.round((done / total) * 100);
    process.stdout.write(
      `\r  Progress: ${done.toLocaleString()} / ${total.toLocaleString()}  (${pct}%)`
    );
  }
  console.log(`\n  ✓ ${total.toLocaleString()} events\n`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  MongoDB → Neon PostgreSQL Migration");
  console.log("═══════════════════════════════════════════════════════");

  const { hasData, tableNames } = await checkExisting();

  if (hasData) {
    console.log("⚠️   EXISTING DATA DETECTED");
    console.log("    Neon tables already contain rows — aborting to prevent duplicates.");
    console.log("    To re-seed: TRUNCATE all tables first, then re-run this script.\n");
    process.exit(0);
  }

  await createSchema();

  // Insert small collections first, events (200 k rows) last
  await insertNodes();
  await insertHeartbeats();
  await insertCommands();
  await insertMasterLogs();
  await insertDataUpdates();
  await insertUsers();
  await insertEvents();

  // ── final summary ─────────────────────────────────────────────────────────
  console.log("📊  Final row counts:\n");
  const finalCounts = [
    ["nodes",        (await sql`SELECT COUNT(*)::int AS c FROM nodes`)[0].c],
    ["events",       (await sql`SELECT COUNT(*)::int AS c FROM events`)[0].c],
    ["heartbeats",   (await sql`SELECT COUNT(*)::int AS c FROM heartbeats`)[0].c],
    ["commands",     (await sql`SELECT COUNT(*)::int AS c FROM commands`)[0].c],
    ["master_logs",  (await sql`SELECT COUNT(*)::int AS c FROM master_logs`)[0].c],
    ["data_updates", (await sql`SELECT COUNT(*)::int AS c FROM data_updates`)[0].c],
    ["users",        (await sql`SELECT COUNT(*)::int AS c FROM users`)[0].c],
  ];
  for (const [t, c] of finalCounts) {
    console.log(`    ${t.padEnd(16)} → ${c.toLocaleString()} rows`);
  }
  console.log("\n✅  Migration complete!\n");
}

main().catch((err) => {
  console.error("\n❌  Migration failed:", err.message, "\n");
  process.exit(1);
});
