import { NextResponse } from "next/server";
import { currentPrincipal } from "@/lib/access";
import { securityLog } from "@/lib/security-log";
import { pool } from "@/lib/db";
import { bodyJson, sameOrigin } from "@/lib/api";
import { z } from "zod";
import { parseAdminUsersQuery } from "@/lib/admin-users-query";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await currentPrincipal("accounts.manage")) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  const parsed = parseAdminUsersQuery(request.url);
  if (!parsed.success) return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
  const { page, limit, q } = parsed.data;
  try {
    const { rows } = await pool.query(`SELECT id,name,email,username,"emailVerified",suspended,"createdAt" FROM "user"
      WHERE ($1='' OR position(lower($1) in lower(name))>0 OR position(lower($1) in lower(email))>0 OR position(lower($1) in lower(coalesce(username,'')))>0)
      ORDER BY "createdAt" DESC, id DESC LIMIT $2 OFFSET $3`, [q, limit + 1, (page - 1) * limit]);
    return NextResponse.json({ users: rows.slice(0, limit), pagination: { page, limit, hasNext: rows.length > limit } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({error:"Data pengguna belum tersedia"},{status:503,headers:{"Cache-Control":"no-store"}}); }
}
export async function POST(request: Request) {
  const admin = await currentPrincipal("accounts.manage");
  if (!admin) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Asal permintaan tidak valid" }, { status: 403 });
  const parsed = z.object({id:z.string().min(1).max(128),action:z.enum(["block","restore"])}).strict().safeParse(await bodyJson(request).catch(()=>null));
  if (!parsed.success || parsed.data.id === admin.row.id) return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  const input = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query('UPDATE "user" SET suspended=$1 WHERE id=$2 AND "madeviRole"=\'user\' RETURNING id', [input.action === "block", input.id]);
    if (!res.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 }); }
    if (input.action === "block") await client.query('DELETE FROM "session" WHERE "userId"=$1', [input.id]);
    await client.query('INSERT INTO madevi_audit (actor_id,action,target_id) VALUES ($1,$2,$3)', [admin.row.id, input.action, input.id]);
    await client.query("COMMIT"); securityLog("admin.account",{outcome:"success",action:input.action});return NextResponse.json({ ok: true });
  } catch { await client.query("ROLLBACK"); return NextResponse.json({ error: "Gagal mengubah akun" }, { status: 500 }); }
  finally { client.release(); }
}

