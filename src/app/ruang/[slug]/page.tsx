import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { rooms } from "@/lib/rooms";
export default async function RoomPage({ params }: { params: Promise<{slug: string}> }) {
  const { slug } = await params; const room = rooms.find(r => r.slug === slug);
  if (!room) notFound();
  return <PublicShell page="room" roomName={room.name} />;
}

