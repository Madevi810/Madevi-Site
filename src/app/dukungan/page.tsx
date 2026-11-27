import { currentAccount } from "@/lib/access";
import { PublicPage } from "@/components/public-page";
import { SupportInbox } from "@/components/support-inbox";

export const dynamic="force-dynamic";

export default async function SupportPage() {
  const account=await currentAccount().catch(()=>undefined);
  return <PublicPage page="content" contentTitle="Dukungan Madevi" section={
    account?<SupportInbox/>:account===undefined?<p role="alert">Sesi belum dapat diperiksa. Muat ulang halaman saat layanan pulih.</p>:
      <p>Masuk melalui Profil di menu website untuk membuat atau membuka percakapan. Laporan masalah anonim tetap tersedia.</p>
  }/>;
}
