/**
 * @deprecated — MongoDB has been replaced by Neon PostgreSQL.
 *
 * This file is kept for backward compatibility only.
 * All new queries should use `lib/db.ts` (Neon) directly:
 *
 *   import { sql } from '@/lib/db';
 *   const rows = await sql`SELECT * FROM sensor_nodes`;
 *
 * Re-exports type helpers from lib/types.ts so existing
 * imports of { NodeData } from '@/lib/mongodb' keep working.
 */

export type { NodeData } from "./types";
export { getWaterLevelStatus, getNodeStatus } from "./types";

// connectToDatabase() is no longer available — use lib/db.ts instead.
// If you need to migrate old Mongo queries, replace:
//   const { db } = await connectToDatabase();
//   const docs = await db.collection('nodes').find({}).toArray();
// with:
//   import { sql } from '@/lib/db';
//   const docs = await sql`SELECT * FROM sensor_nodes`;
