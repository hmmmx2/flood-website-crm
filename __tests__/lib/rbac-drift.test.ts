/**
 * RBAC drift check.
 *
 * `lib/rbac.ts` is the single source of truth for role-based-access-control
 * decisions across both Next.js apps. It MUST be byte-identical between:
 *
 *   flood-website-community/lib/rbac.ts
 *   flood-website-crm/lib/rbac.ts
 *
 * The two apps don't share a workspace package today, so we duplicate the
 * file by hand and let CI scream if anyone forgets to mirror a change.
 *
 * If this test fails:
 *   1. Diff the two files.
 *   2. Decide which version is canonical (usually the one that just changed).
 *   3. Copy it verbatim to the other side.
 *   4. Run this test again. SHA-256s should match.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CRM_RBAC = resolve(__dirname, "../../lib/rbac.ts");
const COMMUNITY_RBAC = resolve(
  __dirname,
  "../../../flood-website-community/lib/rbac.ts",
);

describe("lib/rbac.ts drift check", () => {
  it("exists in both CRM and community apps", () => {
    expect(existsSync(CRM_RBAC)).toBe(true);
    expect(existsSync(COMMUNITY_RBAC)).toBe(true);
  });

  it("has byte-identical SHA-256 across both apps", () => {
    const crmHash = createHash("sha256").update(readFileSync(CRM_RBAC)).digest("hex");
    const communityHash = createHash("sha256")
      .update(readFileSync(COMMUNITY_RBAC))
      .digest("hex");
    expect(crmHash).toBe(communityHash);
  });
});
