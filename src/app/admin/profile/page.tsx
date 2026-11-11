import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/access";
import { AdminShell } from "@/components/admin-shell";
export const dynamic = "force-dynamic";
export default async function AdminProfile() {
  const admin = await currentAdmin(); if (!admin) redirect("/admin");
  return <AdminShell name={admin.session.user.name} profile email={admin.session.user.email} username={admin.row.username || ""} />;
}
