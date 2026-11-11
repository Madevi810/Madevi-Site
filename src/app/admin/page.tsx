import { currentAdmin, currentAccount } from "@/lib/access";
import { AdminLogin } from "@/components/admin-login";
import { AdminShell } from "@/components/admin-shell";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const admin = await currentAdmin();
  if (admin) return <AdminShell name={admin.session.user.name} />;
  const account = await currentAccount();
  return <AdminLogin needsMfa={Boolean(account && account.row.madeviRole === "admin" && !account.row.twoFactorEnabled)} />;
}

