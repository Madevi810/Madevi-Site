import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { can, canEdit } from "./permissions";
import type { z } from "zod";
import { contentInput, revisionInput, transitionInput, queryInput } from "./api";
import { contentSearch } from "./search";

type Actor = { id:string; role:string };
type Query = z.infer<typeof queryInput>;
type Item = { id:string; author_id:string; workflow_status:string; latest_revision:number };
export class ContentError extends Error { constructor(public status:number, message:string){super(message)} }
async function tx<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T>{const client=await pool.connect();try{await client.query("BEGIN");const result=await fn(client);await client.query("COMMIT");return result}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}}
async function lock(client:PoolClient,id:string):Promise<Item>{const r=await client.query("SELECT id,author_id,workflow_status,latest_revision FROM madevi_content WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",[id]);if(!r.rowCount)throw new ContentError(404,"Konten tidak ditemukan");return r.rows[0]}
function checkRevision(item:Item, revision:number){if(item.latest_revision!==revision)throw new ContentError(409,"Data berubah; muat ulang sebelum menyimpan")}
async function audit(client:PoolClient,actor:Actor,action:string,id:string){await client.query("INSERT INTO madevi_audit (actor_id,action,target_id) VALUES ($1,$2,$3)",[actor.id,action,id])}

export async function listContent(query:Query, actor?:Actor){
  const values:unknown[]=[];const where:string[]=actor&&can(actor.role,"content.readAny")?[]:["c.deleted_at IS NULL"];const add=(value:unknown)=>{values.push(value);return `$${values.length}`};
  if(!actor)where.push("c.published_revision IS NOT NULL", "c.workflow_status <> 'archived'");
  else if(!can(actor.role,"content.readAny"))where.push(`c.author_id = ${add(actor.id)}`);
  if(query.space)where.push(`c.space = ${add(query.space)}`);if(query.type)where.push(`c.content_type = ${add(query.type)}`);
  if(query.status && actor)where.push(`c.workflow_status = ${add(query.status)}`);
  if(query.q)where.push(contentSearch.clause(add(query.q)));
  const wh=where.length?`WHERE ${where.join(" AND ")}`:"";const column={updated:"c.updated_at",created:"c.created_at",title:"r.title"}[query.sort];const direction=query.order==="asc"?"ASC":"DESC";
  const join=`JOIN madevi_content_revisions r ON r.content_id=c.id AND r.revision=${actor?"c.latest_revision":"c.published_revision"}`;
  const count=await pool.query(`SELECT count(*)::int AS total FROM madevi_content c ${join} ${wh}`,values);
  const fields=actor?"c.id,c.space,c.content_type AS type,c.slug,c.workflow_status,c.latest_revision,c.published_revision,c.created_at,c.updated_at,c.deleted_at,r.title,r.metadata,r.body":"c.id,c.space,c.content_type AS type,c.slug,c.created_at,c.updated_at,r.title,r.metadata";
  const result=await pool.query(`SELECT ${fields} FROM madevi_content c ${join} ${wh} ORDER BY ${column} ${direction},c.id ASC LIMIT ${add(query.limit)} OFFSET ${add((query.page-1)*query.limit)}`,values);
  return {items:result.rows,page:query.page,limit:query.limit,total:count.rows[0].total};
}
export async function createContent(actor:Actor,input:z.infer<typeof contentInput>){
  if(!can(actor.role,"content.create"))throw new ContentError(403,"Tidak diizinkan");
  return tx(async client=>{const existing=await client.query("SELECT 1 FROM madevi_content WHERE space=$1 AND slug=$2",[input.space,input.slug]);if(existing.rowCount)throw new ContentError(409,"Slug sudah digunakan");const id=randomUUID();await client.query("INSERT INTO madevi_content (id,space,content_type,slug,author_id,latest_revision) VALUES ($1,$2,$3,$4,$5,1)",[id,input.space,input.type,input.slug,actor.id]);await client.query("INSERT INTO madevi_content_revisions (content_id,revision,title,body,metadata,created_by) VALUES ($1,1,$2,$3,$4,$5)",[id,input.title,JSON.stringify(input.body),JSON.stringify(input.metadata),actor.id]);await audit(client,actor,"content.create",id);return {id,revision:1,status:"draft"}});
}
export async function getContent(actor:Actor,id:string,revision?:number){
  const item=await pool.query("SELECT id,author_id,space,content_type AS type,slug,workflow_status,latest_revision,published_revision,created_at,updated_at FROM madevi_content WHERE id=$1 AND deleted_at IS NULL",[id]);
  if(!item.rowCount)throw new ContentError(404,"Konten tidak ditemukan");const row=item.rows[0];
  if(!can(actor.role,"content.readAny") && !(can(actor.role,"content.readOwn")&&actor.id===row.author_id))throw new ContentError(403,"Tidak diizinkan");
  const rev=revision??row.latest_revision;const data=await pool.query("SELECT revision,title,body,metadata,created_at FROM madevi_content_revisions WHERE content_id=$1 AND revision=$2",[id,rev]);if(!data.rowCount)throw new ContentError(404,"Revisi tidak ditemukan");return {...row,revision:data.rows[0]};
}
export async function reviseContent(actor:Actor,id:string,input:z.infer<typeof revisionInput>){return tx(async client=>{const item=await lock(client,id);if(!canEdit(actor.role,actor.id,item.author_id))throw new ContentError(403,"Tidak diizinkan");checkRevision(item,input.expectedRevision);if(!["draft","published"].includes(item.workflow_status))throw new ContentError(409,"Revisi hanya dapat dibuat saat draf atau setelah terbit");const rev=item.latest_revision+1;await client.query("INSERT INTO madevi_content_revisions (content_id,revision,title,body,metadata,created_by) VALUES ($1,$2,$3,$4,$5,$6)",[id,rev,input.title,JSON.stringify(input.body),JSON.stringify(input.metadata),actor.id]);await client.query("UPDATE madevi_content SET latest_revision=$2,workflow_status='draft',updated_at=now() WHERE id=$1",[id,rev]);await audit(client,actor,"content.revise",id);return {id,revision:rev,status:"draft"}})}
export async function transitionContent(actor:Actor,id:string,input:z.infer<typeof transitionInput>){return tx(async client=>{const item=await lock(client,id);checkRevision(item,input.expectedRevision);const old=item.workflow_status;let next:string;
  if(input.action==="submit"&&old==="draft"&&(can(actor.role,"content.submitAny")||(actor.id===item.author_id&&can(actor.role,"content.submitOwn"))))next="in_review";
  else if(input.action==="approve"&&old==="in_review"&&can(actor.role,"content.review"))next="approved";
  else if(input.action==="publish"&&old==="approved"&&can(actor.role,"content.publish"))next="published";
  else if(input.action==="archive"&&old!=="archived"&&can(actor.role,"content.moderate"))next="archived";
  else if(input.action==="reopen"&&old==="archived"&&can(actor.role,"content.moderate"))next="draft";
  else throw new ContentError(403,"Transisi tidak diizinkan untuk status atau peran ini");
  await client.query(`UPDATE madevi_content SET workflow_status=$2, published_revision=CASE WHEN $2='published' THEN latest_revision WHEN $2='archived' OR $2='draft' AND $3='archived' THEN NULL ELSE published_revision END, updated_at=now() WHERE id=$1`,[id,next,old]);
  await client.query("INSERT INTO madevi_moderation_events (content_id,actor_id,from_status,to_status,note) VALUES ($1,$2,$3,$4,$5)",[id,actor.id,old,next,input.note||null]);await audit(client,actor,`content.${input.action}`,id);return {id,revision:item.latest_revision,status:next};});}
