import { notFound } from "next/navigation";
import { PublicPage } from "@/components/public-page";
import { readInformation } from "@/lib/site-config";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const pages=await readInformation().catch(()=>null);
  if(!pages) return <PublicPage page="content" contentTitle="Informasi" section={<p role="alert">Informasi sementara tidak tersedia.</p>}/>;
  const info=pages.find(page=>page.slug===slug && page.visible);
  if(!info)notFound();
  return <PublicPage page="content" contentTitle={info.title} section={<p className="whitespace-pre-wrap">{info.body}</p>}/>;
}
