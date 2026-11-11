import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/access";
import { AdminSecurity } from "@/components/admin-security";
export const dynamic="force-dynamic";
export default async function AdminSecurityPage(){const account=await currentAccount();if(!account || account.row.madeviRole!=="admin")redirect("/admin");return <AdminSecurity enabled={Boolean(account.row.twoFactorEnabled)}/>}

