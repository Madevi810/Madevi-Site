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
CREATE ROLE madevi_qa_backup LOGIN NOSUPERUSER PASSWORD 'ci-backup-only';
CREATE ROLE madevi_qa_ops LOGIN NOSUPERUSER PASSWORD 'ci-ops-only';
CREATE ROLE madevi_qa_maintenance LOGIN NOSUPERUSER PASSWORD 'ci-maintenance-only';
CREATE DATABASE madevi_ci_roles OWNER madevi_qa_migrator;
SQL

grants() {
  psql_as_ci -d madevi_ci_roles -v migrator=madevi_qa_migrator -v runtime=madevi_qa_runtime -v backup=madevi_qa_backup -v operations=madevi_qa_ops -v maintenance=madevi_qa_maintenance < database/roles.example.sql
}
grants
export BETTER_AUTH_URL=https://localhost
export BETTER_AUTH_SECRET=qa-role-test-local-secret-at-least-32
export MADEVI_ENV=staging MADEVI_DEMO_MODE=false TRUST_PROXY_HEADERS=false
export GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASS= MAIL_FROM=
export MIGRATION_QA_URI="postgresql://madevi_qa_migrator:ci-migrator-only@127.0.0.1:${TEST_PG_PORT}/madevi_ci_roles"
DATABASE_URL="$MIGRATION_QA_URI" node scripts/migrate.mjs
grants
if DATABASE_URL="$MIGRATION_QA_URI" node scripts/check-ready.mjs; then
  echo "Web readiness unexpectedly accepts the migration role." >&2; exit 1
fi
export DATABASE_URL="postgresql://madevi_qa_runtime:ci-runtime-only@127.0.0.1:${TEST_PG_PORT}/madevi_ci_roles"
node scripts/check-ready.mjs
export OWNER_USERNAME=qa-owner OWNER_EMAIL=qa-owner@example.invalid OWNER_PASSWORD=qa-owner-local-password
if node scripts/create-owner.mjs; then
  echo "Runtime unexpectedly created the owner." >&2
  exit 1
fi
DATABASE_URL="$MIGRATION_QA_URI" node scripts/create-owner.mjs
if DATABASE_URL="$MIGRATION_QA_URI" node scripts/create-owner.mjs; then
  echo "Bootstrap unexpectedly created a second admin." >&2
  exit 1
fi
test "$(psql_as_ci -d madevi_ci_roles -tAc "SELECT count(*) FROM \"user\" WHERE \"madeviRole\"='admin'")" = "1"
test "$(psql_as_ci -d madevi_ci_roles -tAc "SELECT has_schema_privilege('madevi_qa_runtime','public','CREATE') OR has_table_privilege('madevi_qa_runtime','madevi_schema_migrations','UPDATE')")" = "f"
test "$(psql_as_ci -d madevi_ci_roles -tAc "SELECT has_table_privilege('madevi_qa_backup','madevi_content','SELECT') AND NOT has_table_privilege('madevi_qa_backup','madevi_content','UPDATE') AND has_sequence_privilege('madevi_qa_backup','madevi_report_events_id_seq','SELECT')")" = "t"
deny() {
  local role=$1 statement=$2
  local output
  if output=$(psql_as_ci -d madevi_ci_roles -c "SET ROLE "$role"; $statement" 2>&1); then
    echo "Role $role unexpectedly allowed a restricted command." >&2;exit 1
  fi
  if ! grep -Eq 'permission denied|must be owner|only be assigned by the schema owner' <<<"$output"; then
    echo "Expected an authorization failure for $role." >&2;exit 1
  fi
}
deny madevi_qa_runtime 'CREATE TABLE public.qa_unexpected(id int)'
deny madevi_qa_runtime 'UPDATE madevi_audit SET outcome=outcome'
deny madevi_qa_runtime 'DELETE FROM madevi_security_events'
deny madevi_qa_runtime 'TRUNCATE madevi_audit'
deny madevi_qa_runtime 'UPDATE "user" SET "madeviRole"="madeviRole"'
deny madevi_qa_runtime 'UPDATE madevi_operations SET status=status'
deny madevi_qa_ops 'SELECT password FROM "account"'
deny madevi_qa_ops 'SELECT token FROM "session"'
deny madevi_qa_ops 'DELETE FROM madevi_operations'
deny madevi_qa_backup 'DELETE FROM madevi_audit'
deny madevi_qa_maintenance 'DELETE FROM madevi_audit'
deny madevi_qa_maintenance 'DELETE FROM madevi_library'
psql_as_ci -d madevi_ci_roles <<'SQL'
SET ROLE madevi_qa_runtime;
INSERT INTO madevi_audit(actor_id,action) VALUES('fixture','security.fixture');
INSERT INTO madevi_rate_limits(key,window_start,hits) VALUES('qa-old',now()-interval '10 days',1);
INSERT INTO madevi_operations(id,kind) VALUES('7f1eb8a4-b794-4b2b-b5c3-29809bc27d76','backup');
RESET ROLE;
SET ROLE madevi_qa_ops;
UPDATE madevi_operations SET status='running' WHERE kind='backup';
RESET ROLE;
SQL
export MADEVI_MAINTENANCE_MODE=prune
if node scripts/maintenance.mjs; then
  echo "Destructive maintenance unexpectedly accepted the runtime role." >&2;exit 1
fi
MADEVI_MAINTENANCE_DATABASE_URL="postgresql://madevi_qa_maintenance:ci-maintenance-only@127.0.0.1:${TEST_PG_PORT}/madevi_ci_roles" node scripts/maintenance.mjs
test "$(psql_as_ci -d madevi_ci_roles -tAc "SELECT count(*) FROM madevi_rate_limits WHERE key='qa-old'")" = "0"
test "$(psql_as_ci -d madevi_ci_roles -tAc "SELECT count(*) FROM madevi_audit WHERE action='security.fixture'")" = "1"
export OWNER_RECOVERY_PASSWORD=qa-owner-recovery-fixture-password
if node scripts/recover-owner.mjs --confirm-owner=qa-owner; then
  echo "Runtime unexpectedly recovered the owner." >&2;exit 1
fi
DATABASE_URL="$MIGRATION_QA_URI" node scripts/recover-owner.mjs --confirm-owner=qa-owner
test "$(psql_as_ci -d madevi_ci_roles -tAc "SELECT count(*) FROM madevi_audit WHERE action='account.owner.recovered'")" = "1"
echo "Lulus: role runtime, backup, operasi, pemeliharaan dan pemulihan pemilik diuji pada PostgreSQL."
