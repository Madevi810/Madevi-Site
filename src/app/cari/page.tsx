import { PublicPage } from "@/components/public-page";
import { PublishedList } from "@/components/published-list";

export const dynamic="force-dynamic";
export default async function SearchPage({searchParams}:{searchParams:Promise<Record<string,unknown>>}) {
  return <PublicPage page="search" section={<PublishedList path="/cari" params={await searchParams}/>}/>;
}
