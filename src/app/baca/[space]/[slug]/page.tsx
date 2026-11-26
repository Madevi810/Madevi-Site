import { notFound } from "next/navigation";
import { z } from "zod";
import { PublicPage } from "@/components/public-page";
import { spaces,slug } from "@/lib/api";
import { readPublishedContent } from "@/lib/content";

export const dynamic="force-dynamic";
export default async function ReadPage({params}:{params:Promise<{space:string;slug:string}>}) {
  const p=await params;
  if(!z.enum(spaces).safeParse(p.space).success||!slug.safeParse(p.slug).success)notFound();
  const content=await readPublishedContent(p.space,p.slug).catch(()=>undefined);
  if(content===undefined) return <PublicPage page="content" contentTitle="Materi" section={<p role="alert">Materi sementara tidak tersedia.</p>}/>;
  if(!content)notFound();
  const blocks:unknown[]=Array.isArray(content.body?.blocks)?content.body.blocks:[];
  const paragraphs=blocks.flatMap(block=>typeof block==="string"?[block]:block && typeof block==="object" && "text" in block && typeof block.text==="string"?[block.text]:[]);
  return <PublicPage page="content" contentTitle={content.title} section={<article>
    {content.metadata.description && <p>{content.metadata.description}</p>}
    {content.metadata.category && <p>Kategori {content.metadata.category}</p>}
    {content.metadata.tags?.length ? <p>Tag {content.metadata.tags.join(", ")}</p> : null}
    {paragraphs.map((text,index)=><p key={index} className="whitespace-pre-wrap">{text}</p>)}
    {content.files.length>0 && <ul>{content.files.map((file:{id:string;name:string})=><li key={file.id}><a href={`/api/media/${file.id}`}>{file.name}</a></li>)}</ul>}
    {content.metadata.sources?.length ? <section><h2>Rujukan</h2><ul>{content.metadata.sources.map((source:{title:string;url:string})=><li key={source.url}><a rel="noreferrer" href={source.url}>{source.title}</a></li>)}</ul></section> : null}
  </article>}/>;
}
