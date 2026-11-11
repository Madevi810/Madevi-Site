import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { informationPages } from "@/lib/info-pages";
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const info=informationPages[slug as keyof typeof informationPages];if(!info)notFound();return <PublicShell page="content" contentTitle={info.title} paragraphs={[info.body]}/>}
