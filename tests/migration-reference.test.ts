import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

test("migration reference copies match the single executable source", async () => {
  const source = "scripts/migrations";
  const reference = "database/migrations";
  const names = (await readdir(source)).filter((name) => name.endsWith(".sql")).sort();
  const copies = (await readdir(reference)).filter((name) => name.endsWith(".sql")).sort();
  assert.ok(names.length > 0);
  assert.deepEqual(copies, names);
  for (const name of names) assert.deepEqual(await readFile(join(reference, name)), await readFile(join(source, name)), name);
});
