import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, stat, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("backup protects existing files, private permissions and failed dumps", async () => {
  const dir = await mkdtemp(join(tmpdir(), "madevi-backup-test-"));
  try {
    const bin=join(dir,"bin");await mkdir(bin);
    await writeFile(join(bin,"pg_dump"),"#!/bin/sh\nif [ \"$TEST_DUMP_FAIL\" = 1 ]; then exit 1; fi\nif [ \"$TEST_DUMP_EMPTY\" = 1 ]; then exit 0; fi\nprintf 'synthetic dump'\n",{mode:0o700});
    const env={...process.env,PATH:bin,DATABASE_URL:"postgresql://localhost/test"};
    const run=(path:string,extra:Record<string,string>={})=>spawnSync(process.execPath,["scripts/backup.mjs",path],{encoding:"utf8",env:{...env,...extra}});
    const dest=join(dir,"backup.dump");
    assert.equal(run(dest).status,0);
    assert.equal(await readFile(dest,"utf8"),"synthetic dump");
    assert.equal((await stat(dest)).mode & 0o777,0o600);
    assert.notEqual(run(dest).status,0,"an existing backup must not be overwritten");
    assert.equal(await readFile(dest,"utf8"),"synthetic dump");
    const failed=join(dir,"failed.dump");assert.notEqual(run(failed,{TEST_DUMP_FAIL:"1"}).status,0);
    const empty=join(dir,"empty.dump");assert.notEqual(run(empty,{TEST_DUMP_EMPTY:"1"}).status,0);
    assert.ok(!(await readdir(dir)).includes("failed.dump"));
    assert.ok(!(await readdir(dir)).includes("empty.dump"));
    assert.ok(!(await readdir(dir)).some(name=>name.startsWith(".madevi-backup-")));
    assert.notEqual(run(join(process.cwd(),"should-not-be-created.dump")).status,0,"a backup must not be put into the project");
  } finally {await rm(dir,{recursive:true,force:true});}
});
