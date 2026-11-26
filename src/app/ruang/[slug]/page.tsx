import { notFound } from "next/navigation";
import { PublicPage } from "@/components/public-page";
import { PublishedList } from "@/components/published-list";
import { rooms } from "@/lib/rooms";

export const dynamic="force-dynamic";
export default async function RoomPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,unknown>>}) {
  const {slug}=await params;
  const room=rooms.find(item=>item.slug===slug);
  if (!room) notFound();
  return <PublicPage page="room" roomName={room.name} section={<PublishedList path={`/ruang/${slug}`} space={slug} params={await searchParams}/>}/>;
}
