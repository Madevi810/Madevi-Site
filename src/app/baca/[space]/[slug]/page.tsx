import { notFound } from "next/navigation";
import { z } from "zod";
import { PublicShell } from "@/components/public-shell";
import { spaces,slug } from "@/lib/api";
import { pool } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function ReadPage({params}:{params:Promise<{space:string;slug:string}>}){
  const p=await params;if(!z.enum(spaces).safeParse(p.space).success||!slug.safeParse(p.slug).success)notFound();
  const result=await pool.query("SELECT r.title,r.body FROM madevi_content c JOIN madevi_content_revisions r ON r.content_id=c.id AND r.revision=c.published_revision WHERE c.space=$1 AND c.slug=$2 AND c.published_revision IS NOT NULL AND c.workflow_status<>'archived'",[p.space,p.slug]);
  if(!result.rowCount)notFound();
  const body:unknown=result.rows[0].body;const blocks=typeof body==="object"&&body!==null&&"blocks" in body&&Array.isArray(body.blocks)?body.blocks:[];
  const paragraphs=blocks.flatMap((block:unknown)=>typeof block==="string"?[block]:typeof block==="object"&&block!==null&&"text" in block&&typeof block.text==="string"?[block.text]:[]);
  return <PublicShell page="content" contentTitle={result.rows[0].title} paragraphs={paragraphs}/>;
}
