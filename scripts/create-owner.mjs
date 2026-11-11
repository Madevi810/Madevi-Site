import pg from "pg";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
const {DATABASE_URL,OWNER_USERNAME,OWNER_EMAIL,OWNER_PASSWORD}=process.env;
if(!DATABASE_URL || !OWNER_USERNAME || !/^[a-zA-Z0-9_.-]{3,30}$/.test(OWNER_USERNAME) || !OWNER_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(OWNER_EMAIL) || !OWNER_PASSWORD || OWNER_PASSWORD.length<12)throw new Error("Konfigurasi admin tidak lengkap atau tidak valid.");
const pool=new pg.Pool({connectionString:DATABASE_URL});const client=await pool.connect();
try{
  await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(7412301)");
  const found=await client.query('SELECT id FROM "user" WHERE "madeviRole"=\'admin\' LIMIT 1');if(found.rowCount)throw new Error("Admin sudah ada; pembuatan admin tunggal ditolak.");
  const id=randomUUID(),now=new Date();
  await client.query('INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt",username,"displayUsername","madeviRole",suspended,"isDemo","twoFactorEnabled") VALUES ($1,$2,$3,true,$4,$4,$5,$2,\'admin\',false,false,false)',[id,OWNER_USERNAME,OWNER_EMAIL.toLowerCase(),now,OWNER_USERNAME.toLowerCase()]);
  await client.query('INSERT INTO "account" (id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES ($1,$2,\'credential\',$2,$3,$4,$4)',[randomUUID(),id,await hashPassword(OWNER_PASSWORD),now]);
  await client.query("COMMIT");console.log("Admin dibuat. Masuk lalu aktifkan autentikator sebelum membuka dashboard.");
}catch(error){await client.query("ROLLBACK");throw error}finally{client.release();await pool.end()}
