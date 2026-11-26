#!/usr/bin/env bash
set -euo pipefail
: "${PG_CONTAINER:?Setel PG_CONTAINER ke container QA PostgreSQL}"
: "${MADEVI_TEST_DATABASE_URL:?Setel MADEVI_TEST_DATABASE_URL ke database PostgreSQL QA}"
test "$(docker inspect -f '{{index .Config.Labels "madevi.scope"}}' "$PG_CONTAINER")" = synthetic-ci
connection=$(node --input-type=module -e '
  const url=new URL(process.env.MADEVI_TEST_DATABASE_URL);
  if(!["127.0.0.1","localhost"].includes(url.hostname)||!/^\/madevi_ci_[a-z0-9_]+$/.test(url.pathname))process.exit(1);
  console.log(url.pathname.slice(1))')
# Private wrappers call the matching PostgreSQL 18 clients shipped in the CI service.
qa_dir=$(mktemp -d)
trap 'rm -rf "$qa_dir"' EXIT
mkdir -m 700 "$qa_dir/bin" "$qa_dir/backups"
printf '%s\n' "$PG_CONTAINER" > "$qa_dir/bin/container"
cat > "$qa_dir/bin/pg_dump" <<'SH'
#!/usr/bin/env bash
set -eu
container=$(cat "$(dirname "$0")/container")
docker exec "$container" pg_dump -U "$PGUSER" -d "$PGDATABASE" "$@"
SH
cat > "$qa_dir/bin/pg_restore" <<'SH'
#!/usr/bin/env bash
set -eu
container=$(cat "$(dirname "$0")/container")
docker exec -i "$container" pg_restore -U "$PGUSER" "${@:1:$#-1}" < "${!#}"
SH
chmod 700 "$qa_dir/bin/pg_dump" "$qa_dir/bin/pg_restore"
target="madevi_restore_$(node -e 'console.log(require("node:crypto").randomBytes(6).toString("hex"))')"
export DATABASE_URL="$MADEVI_TEST_DATABASE_URL"
export MADEVI_ENV=dev
export MADEVI_BACKUP_DATABASE_URL=""
export MADEVI_RESTORE_DATABASE_URL=$(node -e '
  const url=new URL(process.env.MADEVI_TEST_DATABASE_URL);
  url.pathname=process.argv[1]; console.log(url.href)' "$target")
export MADEVI_BACKUP_DIR="$qa_dir/backups"
export MADEVI_BACKUP_KEY=$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')
export PATH="$qa_dir/bin:$PATH"
docker exec "$PG_CONTAINER" createdb -U madevi_test "$target"
npm run db:backup:encrypted
files=("$MADEVI_BACKUP_DIR"/*.dump.gcm)
test "${#files[@]}" -eq 1
artifact=$(basename "${files[0]}")
test "$(stat -c '%a' "${files[0]}")" = 600
npm run db:verify:encrypted -- "$artifact"
if MADEVI_BACKUP_KEY=$(printf '0%.0s' {1..64}) npm run db:verify:encrypted -- "$artifact"; then
  echo "Verifikasi dengan kunci salah harus gagal" >&2
  exit 1
fi
cp "${files[0]}" "$MADEVI_BACKUP_DIR/madevi-tampered.dump.gcm"
node -e 'const fs=require("node:fs");const name=process.argv[1];const data=fs.readFileSync(name);data[21]^=1;fs.writeFileSync(name,data);' "$MADEVI_BACKUP_DIR/madevi-tampered.dump.gcm"
if npm run db:verify:encrypted -- madevi-tampered.dump.gcm; then
  echo "Verifikasi arsip yang berubah harus gagal" >&2
  exit 1
fi
if npm run db:restore:encrypted -- "$artifact" "RESTORE:target-salah"; then
  echo "Target tanpa konfirmasi harus ditolak" >&2
  exit 1
fi
confirm=$(node -e 'const url=new URL(process.env.MADEVI_RESTORE_DATABASE_URL);console.log("RESTORE:"+url.host+url.pathname);')
npm run db:restore:encrypted -- "$artifact" "$confirm"
query="SELECT version,checksum FROM madevi_schema_migrations ORDER BY version; SELECT count(*) FROM madevi_library;"
source_result=$(docker exec "$PG_CONTAINER" psql -U madevi_test -d "$connection" -tAc "$query")
restored_result=$(docker exec "$PG_CONTAINER" psql -U madevi_test -d "$target" -tAc "$query")
test -n "$source_result"
test "$source_result" = "$restored_result"
if npm run db:restore:encrypted -- "$artifact" "$confirm"; then
  echo "Restore kedua pada target yang sudah berisi harus ditolak" >&2
  exit 1
fi
history=$(docker exec "$PG_CONTAINER" psql -U madevi_test -d "$connection" -tAc "SELECT count(*) FROM madevi_operations WHERE status='completed' AND finished_at>=started_at AND bytes>0")
test "$history" -ge 2
echo "Lulus: backup AES-GCM diverifikasi, target kosong, penolakan kunci/berkas/target salah, dan kesamaan checksum/media."
