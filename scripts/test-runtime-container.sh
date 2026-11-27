#!/usr/bin/env bash
# Only runs against its own disposable Docker network and PostgreSQL container.
set -euo pipefail
image=${1:?Provide the locally built Madevi image}
scope="madevi-runtime-qa-$(date +%s)-$$"
pg="$scope-pg"
web="$scope-web"
docker network create --internal --label madevi.scope=synthetic-ci "$scope" >/dev/null
cleanup() {
  docker rm -f "$web" "$pg" >/dev/null 2>&1 || true
  docker network rm "$scope" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker run -d --name "$pg" --network "$scope" --label madevi.scope=synthetic-ci \
  -e POSTGRES_USER=madevi_test -e POSTGRES_PASSWORD=local-test-only -e POSTGRES_DB=madevi_ci_runtime postgres:18 >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$pg" pg_isready -q -h 127.0.0.1 -U madevi_test -d madevi_ci_runtime; then break; fi
  sleep 1
done
common=(--network "container:$pg" --read-only --cap-drop ALL --security-opt no-new-privileges:true --pids-limit 256
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m,uid=1000,gid=1000,mode=0700
  --tmpfs /app/.next/cache:rw,noexec,nosuid,nodev,size=128m,uid=1000,gid=1000,mode=0700
  -e "DATABASE_URL=postgresql://madevi_test:local-test-only@127.0.0.1:5432/madevi_ci_runtime"
  -e MADEVI_ENV=staging -e BETTER_AUTH_URL=https://localhost
  -e BETTER_AUTH_SECRET=runtime-test-placeholder-at-least-32-characters)
docker run --rm "${common[@]}" "$image" node scripts/migrate.mjs
docker exec -i "$pg" psql -X -v ON_ERROR_STOP=1 -U madevi_test -d madevi_ci_runtime   -c "CREATE ROLE madevi_container_runtime LOGIN NOSUPERUSER PASSWORD 'local-runtime-only'" >/dev/null
docker exec -i "$pg" psql -X -U madevi_test -d madevi_ci_runtime   -v migrator=madevi_test -v runtime=madevi_container_runtime < database/roles.example.sql >/dev/null
runtimeDb=postgresql://madevi_container_runtime:local-runtime-only@127.0.0.1:5432/madevi_ci_runtime
docker run --rm "${common[@]}" -e "DATABASE_URL=$runtimeDb" "$image" node scripts/check-ready.mjs
docker run -d --init --name "$web" "${common[@]}" -e "DATABASE_URL=$runtimeDb" "$image" >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$web" node -e 'fetch("http://127.0.0.1:3000/api/health/ready").then(r=>{if(!r.ok)process.exitCode=1}).catch(()=>{process.exitCode=1})' 2>/dev/null; then break; fi
  sleep 1
done
docker exec "$web" node --input-type=module -e '
  import assert from "node:assert/strict";
  import fs from "node:fs";
  assert.notEqual(process.getuid(),0);
  assert.match(fs.readFileSync("/proc/self/status","utf8"),/^CapEff:\s+0+$/m);
  assert.match(fs.readFileSync("/proc/self/status","utf8"),/^NoNewPrivs:\s+1$/m);
  assert.equal(fs.existsSync("/var/run/docker.sock"),false);
  assert.equal(fs.existsSync("/app/node_modules/playwright"),false);
  assert.equal(fs.existsSync("/usr/local/lib/node_modules/npm"),false);
  assert.equal(fs.existsSync("/app/scripts/run-operations.mjs"),false);
  assert.throws(()=>fs.writeFileSync("/app/.next/readonly-check","fixture"));
  fs.writeFileSync("/app/.next/cache/writable-check","fixture");
  for (const path of ["/","/api/health/live","/api/health/ready"]) {
    assert.equal((await fetch("http://127.0.0.1:3000"+path)).status,200,path);
  }
  console.log("Container lulus: non-root, filesystem baca-saja, cache eksplisit, migrasi, liveness dan readiness.");
'
