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
