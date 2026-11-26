import test from "node:test";
import assert from "node:assert/strict";
import { createDatabasePool } from "../src/lib/postgres.ts";

const pool = createDatabasePool("postgresql://127.0.0.1/madevi_ci_unit");

test("an idle database error is handled without logging connection secrets", () => {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...items: unknown[]) => { lines.push(items.join(" ")); };
  try {
    assert.doesNotThrow(() => pool.emit("error", new Error("private-connection-value")));
    assert.equal(lines.length, 1);
    assert.deepEqual(JSON.parse(lines[0]), {event:"database.pool.error",outcome:"unavailable"});
    assert.ok(!lines[0].includes("private-connection-value"));
  } finally { console.error = original; }
});
