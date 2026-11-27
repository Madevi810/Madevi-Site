import "server-only";
import { z } from "zod";
import { pool } from "./db";
import { webReference } from "./content-metadata";
import { informationPages } from "./info-pages";

const href=z.union([z.string().max(240).regex(/^\/[a-z0-9][a-z0-9/_-]*$/),webReference]);
const nav=z.array(z.object({label:z.string().trim().min(1).max(60),href}).strict()).max(12)
  .refine(items=>new Set(items.map(item=>item.href)).size===items.length);
export const siteInput=z.object({navigation:nav,announcement:z.string().trim().max(200),expectedVersion:z.number().int().nonnegative()}).strict();
export const informationInput=z.object({slug:z.enum(["tentang","privasi","ketentuan","bantuan"]),title:z.string().trim().min(1).max(160),body:z.string().trim().max(12000),visible:z.boolean(),expectedVersion:z.number().int().nonnegative()}).strict();

export async function readSite() {
  const {rows}=await pool.query("SELECT version,navigation,announcement FROM madevi_website_settings WHERE id=1");
  return rows[0] ?? {version:0,navigation:[],announcement:""};
}
export async function readInformation() {
  const {rows}=await pool.query("SELECT slug,title,body,visible,version FROM madevi_information_pages");
  return Object.entries(informationPages).map(([slug,page])=>rows.find(row=>row.slug===slug) ?? {slug,...page,visible:true,version:0});
}

export type SiteResource=z.infer<typeof siteResource>;
export const siteResource=z.enum(["settings","tentang","privasi","ketentuan","bantuan"]);
export class SiteVersionError extends Error {}
type SiteInput=z.infer<typeof siteInput>;
type InformationInput=z.infer<typeof informationInput>;

export async function changeSite(actor:string, resource:SiteResource, expectedVersion:number, patch?:SiteInput|InformationInput, restore?:number) {
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",["madevi-site:"+resource]);
    const info=resource!=="settings";
    const previous=(await client.query(info
      ? "SELECT slug,title,body,visible,version FROM madevi_information_pages WHERE slug=$1"
      : "SELECT navigation,announcement,version FROM madevi_website_settings WHERE id=1",info?[resource]:[])).rows[0]
      ?? (info?{slug:resource,...informationPages[resource],visible:true,version:0}:{navigation:[],announcement:"",version:0});
    const {version,...snapshot}=previous;
    if(version!==expectedVersion)throw new SiteVersionError("Versi berubah. Muat kembali sebelum menyimpan.");
    await client.query(`INSERT INTO madevi_site_history(resource,version,snapshot) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[resource,version,snapshot]);
    let source:unknown=patch;
    if(restore!==undefined) {
      if(restore>=version)throw new SiteVersionError("Pilih versi yang lebih lama.");
      const earlier=(await client.query("SELECT snapshot FROM madevi_site_history WHERE resource=$1 AND version=$2",[resource,restore])).rows[0];
      if(!earlier)throw new SiteVersionError("Snapshot tidak ditemukan.");
      source={...earlier.snapshot,expectedVersion};
    }
    const nextVersion=version+1;
    let nextSnapshot:Record<string,unknown>;
    if(info) {
      const data=informationInput.parse(source);
      const {slug,title,body,visible}=data;
      nextSnapshot={slug,title,body,visible};
      await client.query(`INSERT INTO madevi_information_pages(slug,title,body,visible,version) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(slug) DO UPDATE SET title=$2,body=$3,visible=$4,version=$5,updated_at=now()`,[resource,title,body,visible,nextVersion]);
    } else {
      const {navigation,announcement}=siteInput.parse(source);
      nextSnapshot={navigation,announcement};
      await client.query(`INSERT INTO madevi_website_settings(id,navigation,announcement,version) VALUES(1,$1,$2,$3)
        ON CONFLICT(id) DO UPDATE SET navigation=$1,announcement=$2,version=$3,updated_at=now()`,[JSON.stringify(navigation),announcement,nextVersion]);
    }
    await client.query(`INSERT INTO madevi_site_history(resource,version,snapshot,actor_id,restored_from) VALUES($1,$2,$3,$4,$5)`,[resource,nextVersion,nextSnapshot,actor,restore??null]);
    await client.query("INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$3)",[actor,restore===undefined?"site.update":"site.restore",resource]);
    await client.query("COMMIT");
    return nextVersion;
  } catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}
  finally{client.release();}
}
