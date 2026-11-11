import test from "node:test";
import assert from "node:assert/strict";
import { can, canEdit } from "../src/lib/permissions.ts";
import { MemoryCache, NoopCache } from "../src/lib/cache.ts";
import { validateEnvironment } from "../src/lib/env.ts";
import { PostgresSearch } from "../src/lib/search.ts";

test("permissions deny unknown roles and restrict capabilities",()=>{
  assert.equal(can("user","content.publish"),false);assert.equal(can("admin","content.publish"),true);
  assert.equal(can("author","content.publish"),false);assert.equal(can("reviewer","content.publish"),true);
  assert.equal(can("moderator","accounts.manage"),false);assert.equal(can("__proto__","content.publish"),false);
  assert.equal(canEdit("author","a","a"),true);assert.equal(canEdit("author","a","b"),false);assert.equal(canEdit("admin","a","b"),true);
});
test("cache expiry, invalidation and no-op do not retain data",async()=>{const c=new MemoryCache();await c.set("a",1,5);assert.equal(await c.get("a"),1);await c.invalidate("a");assert.equal(await c.get("a"),undefined);await c.set("b",2,0);assert.equal(await c.get("b"),undefined);const noop=new NoopCache();await noop.set("x",1,60);assert.equal(await noop.get("x"),undefined)});
test("search parameter is a parameter placeholder, not SQL",()=>{const p=new PostgresSearch();assert.match(p.clause("$1"),/\$1/);assert.throws(()=>p.clause("1; DROP TABLE x"))});
test("configuration fails closed on unsafe settings",()=>{const base={DATABASE_URL:"postgresql://localhost/test",BETTER_AUTH_SECRET:"x".repeat(40),BETTER_AUTH_URL:"http://localhost:3000",MADEVI_ENV:"dev",NODE_ENV:"development"};assert.doesNotThrow(()=>validateEnvironment(base));assert.doesNotThrow(()=>validateEnvironment({...base,MADEVI_DEMO_MODE:"true"}));assert.throws(()=>validateEnvironment({...base,MADEVI_ENV:"production"}));assert.throws(()=>validateEnvironment({...base,MADEVI_ENV:"staging",MADEVI_DEMO_MODE:"true",BETTER_AUTH_URL:"https://example.invalid"}));assert.throws(()=>validateEnvironment({...base,MADEVI_DEMO_MODE:"true",DATABASE_URL:"postgresql://remote.example/db"}));assert.throws(()=>validateEnvironment({...base,MADEVI_DEMO_MODE:"true",BETTER_AUTH_URL:"https://example.invalid"}));assert.throws(()=>validateEnvironment({...base,GOOGLE_CLIENT_ID:"one"}));assert.throws(()=>validateEnvironment({...base,SMTP_HOST:"host"}));assert.throws(()=>validateEnvironment({...base,MEDIA_BACKEND:"unknown"}))});
test("production runtime must explicitly use staging or production mode",()=>{
  const base={DATABASE_URL:"postgresql://localhost/test",BETTER_AUTH_SECRET:"x".repeat(40),BETTER_AUTH_URL:"https://localhost",NODE_ENV:"production"};
  assert.throws(()=>validateEnvironment(base));
  assert.throws(()=>validateEnvironment({...base,MADEVI_ENV:"dev"}));
  assert.throws(()=>validateEnvironment({...base,MADEVI_ENV:"production",BETTER_AUTH_URL:"http://localhost"}));
  assert.doesNotThrow(()=>validateEnvironment({...base,MADEVI_ENV:"staging"}));
  assert.doesNotThrow(()=>validateEnvironment({...base,MADEVI_ENV:"production"}));
});
