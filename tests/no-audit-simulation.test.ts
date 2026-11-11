import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

// The real UI must never offer browser-only mock accounts or simulated mutations.
test("application components do not contain audit-only access or example data", () => {
  const components = ["profile", "public-shell", "admin-shell", "admin-content", "admin-notifications", "notification-center", "social-profile-settings"];
  for (const name of components) {
    const source = readFileSync(`src/components/${name}.tsx`, "utf8");
    assert.doesNotMatch(source, /AuditUserAccess|onAuditLogout|data-audit-step|audit-(?:user|content|general|system|social)|Tampilan uji: kode tidak dikirim/);
  }
  assert.equal(existsSync("audit-preview"), false);
});
