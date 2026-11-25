import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";

test("migration SQL lives in one directory with up and down pairs", async () => {
  const source = (await readdir("scripts/migrations")).filter((name) => name.endsWith(".sql"));
  const reference = (await readdir("database/migrations")).filter((name) => name.endsWith(".sql"));
  const up = source.filter((name) => name.endsWith(".up.sql"));
  assert.ok(up.length > 0);
  assert.deepEqual(reference, [], "reference directory must not duplicate executable SQL");
  const pairs = up.flatMap((name) => [name, name.replace(/\.up\.sql$/, ".down.sql")]);
  assert.deepEqual(source.sort(), pairs.sort());
});
