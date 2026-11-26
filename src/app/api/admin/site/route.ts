import { currentAdmin } from "@/lib/access";
import { bodyJson, failure, sameOrigin } from "@/lib/api";
import { pool } from "@/lib/db";
import { informationInput, readInformation, readSite, siteInput } from "@/lib/site-config";

export async function GET() {
  if(!await currentAdmin()) return failure("Tidak diizinkan",403);
  try { return Response.json({settings:await readSite(),pages:await readInformation()}); }
  catch { return failure("Data pengaturan belum tersedia",503); }
}

export async function PUT(request:Request) {
  const account=await currentAdmin();
  if(!account || !sameOrigin(request)) return failure("Tidak diizinkan",403);
  const body=await bodyJson(request).catch(()=>null);
  const info=informationInput.safeParse(body);
  const site=siteInput.safeParse(body);
  if(!info.success && !site.success) return failure("Data tidak valid",400);
  try {
    const {rowCount}=info.success
      ? await pool.query(`WITH saved AS (
          INSERT INTO madevi_information_pages(slug,title,body,visible)
          SELECT $1,$2,$3,$4 WHERE $5=0 OR EXISTS(SELECT 1 FROM madevi_information_pages WHERE slug=$1)
          ON CONFLICT(slug) DO UPDATE SET title=$2,body=$3,visible=$4,version=madevi_information_pages.version+1,updated_at=now()
          WHERE madevi_information_pages.version=$5 RETURNING slug
        ) INSERT INTO madevi_audit(actor_id,action,target_id) SELECT $6,'site.page.update',slug FROM saved`,
        [info.data.slug,info.data.title,info.data.body,info.data.visible,info.data.expectedVersion,account.row.id])
      : site.success ? await pool.query(`WITH saved AS (
          INSERT INTO madevi_website_settings(id,navigation,announcement)
          SELECT 1,$1,$2 WHERE $3=0 OR EXISTS(SELECT 1 FROM madevi_website_settings WHERE id=1)
          ON CONFLICT(id) DO UPDATE SET navigation=$1,announcement=$2,version=madevi_website_settings.version+1,updated_at=now()
          WHERE madevi_website_settings.version=$3 RETURNING id
        ) INSERT INTO madevi_audit(actor_id,action,target_id) SELECT $4,'site.settings.update',id::text FROM saved`,
        [JSON.stringify(site.data.navigation),site.data.announcement,site.data.expectedVersion,account.row.id]) : {rowCount:0};
    return rowCount ? Response.json({ok:true}) : failure("Versi berubah. Muat kembali sebelum menyimpan.",409);
  } catch { return failure("Pengaturan belum tersimpan",503); }
}
