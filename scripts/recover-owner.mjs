import { hashPassword } from "better-auth/crypto";
import { createDatabasePool } from "../src/lib/postgres.ts";

const [confirmation]=process.argv.slice(2);
const username=/^--confirm-owner=([a-zA-Z0-9_.-]{3,30})$/.exec(confirmation??"")?.[1]?.toLowerCase();
const password=process.env.OWNER_RECOVERY_PASSWORD;
if(process.argv.length!==3||!username||!password||password.length<12||password.length>128) {
  console.error("Gunakan --confirm-owner dengan username admin dan OWNER_RECOVERY_PASSWORD dari penyimpanan privat.");
  process.exit(1);
}

let pool,client;
try {
  pool=createDatabasePool(undefined,1);
  client=await pool.connect();
  await client.query("BEGIN");
  const migrator=(await client.query(`SELECT current_user=pg_get_userbyid(relowner) AS permitted
    FROM pg_class WHERE oid=to_regclass('public.madevi_schema_migrations')`)).rows[0];
  if(!migrator?.permitted)throw Error("role");
  await client.query("SELECT pg_advisory_xact_lock(7412301)");
  const {rows}=await client.query(`SELECT id,email FROM "user" WHERE "madeviRole"='admin' AND username=$1 AND NOT "isDemo"`,[username]);
  if(rows.length!==1)throw Error("owner");
  const {id,email}=rows[0];
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`account-security:${id}`]);
  const updated=await client.query(`UPDATE "account" SET password=$2,"updatedAt"=now()
    WHERE "userId"=$1 AND "providerId"='credential'`,[id,await hashPassword(password)]);
  if(updated.rowCount!==1)throw Error("credential");
  await client.query('DELETE FROM "twoFactor" WHERE "userId"=$1',[id]);
  await client.query('DELETE FROM "session" WHERE "userId"=$1',[id]);
  await client.query(`DELETE FROM verification WHERE
    (value=$1 AND (identifier LIKE '2fa-%' OR identifier LIKE 'trust-device-%'))
    OR identifier IN ('forget-password-otp-'||$2,'email-verification-otp-'||$2)
    OR starts_with(identifier,'change-email-otp-'||$1||':')`,[id,email]);
  await client.query(`UPDATE "user" SET "twoFactorEnabled"=false,"updatedAt"=now() WHERE id=$1`,[id]);
  await client.query(`INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,'account.owner.recovered',$1)`,[id]);
  await client.query("COMMIT");
  console.log("Pemulihan admin tercatat. Masuk dengan kata sandi baru dan daftarkan autentikator sebelum membuka panel.");
} catch {
  await client?.query("ROLLBACK").catch(()=>{});
  console.error("Pemulihan ditolak. Periksa role migrasi, username admin tunggal, dan status database.");
  process.exitCode=1;
} finally {
  client?.release();
  await pool?.end();
}
