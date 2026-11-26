#!/usr/bin/env bash
# For the disposable postgres:18 service used by Madevi CI.
set -euo pipefail

: "${PG_CONTAINER:?Set PG_CONTAINER to the disposable PostgreSQL test container}"
: "${TEST_PG_PORT:=25435}"
test "$(docker inspect --format '{{ index .Config.Labels "madevi.scope" }}' "$PG_CONTAINER")" = "synthetic-ci" || {
  echo "Role tests require a disposable container labeled madevi.scope=synthetic-ci." >&2
  exit 1
}

psql_as_ci() {
  docker exec -i "$PG_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U madevi_test "$@"
}
psql_as_ci -d postgres <<'SQL'
CREATE ROLE madevi_qa_migrator LOGIN NOSUPERUSER PASSWORD 'ci-migrator-only';
CREATE ROLE madevi_qa_runtime LOGIN NOSUPERUSER PASSWORD 'ci-runtime-only';
CREATE DATABASE madevi_ci_roles OWNER madevi_qa_migrator;
SQL

grants() {
  psql_as_ci -d madevi_ci_roles -v migrator=madevi_qa_migrator -v runtime=madevi_qa_runtime < database/roles.example.sql
}
grants
export BETTER_AUTH_URL=https://localhost
export BETTER_AUTH_SECRET=qa-role-test-local-secret-at-least-32
export MADEVI_ENV=staging MADEVI_DEMO_MODE=false TRUST_PROXY_HEADERS=false
export GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASS= MAIL_FROM=
export DATABASE_URL="postgresql://madevi_qa_migrator:ci-migrator-only@127.0.0.1:${TEST_PG_PORT}/madevi_ci_roles"
node scripts/migrate.mjs
grants
export DATABASE_URL="postgresql://madevi_qa_runtime:ci-runtime-only@127.0.0.1:${TEST_PG_PORT}/madevi_ci_roles"
node scripts/check-ready.mjs
export OWNER_USERNAME=qa-owner OWNER_EMAIL=qa-owner@example.invalid OWNER_PASSWORD=qa-owner-local-password
node scripts/create-owner.mjs
if node scripts/create-owner.mjs; then
  echo "Bootstrap unexpectedly created a second admin." >&2
  exit 1
fi
test "$(psql_as_ci -d madevi_ci_roles -tAc "SELECT count(*) FROM \"user\" WHERE \"madeviRole\"='admin'")" = "1"
test "$(psql_as_ci -d madevi_ci_roles -tAc "SELECT has_schema_privilege('madevi_qa_runtime','public','CREATE') OR has_table_privilege('madevi_qa_runtime','madevi_schema_migrations','UPDATE')")" = "f"
echo "Lulus: migrasi dengan role non-superuser, pemeriksaan runtime dan bootstrap pemilik tunggal."
