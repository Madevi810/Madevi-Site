import Link from "next/link";
import {authScreen,authCard,authMark,textButton} from "@/components/styles";
export default function ResetPage(){return <main className={authScreen}><div className={authCard}><div className={authMark}>M</div><h1>Atur ulang kata sandi</h1><p>Buka menu Profile di Madevi, lalu pilih Lupa password untuk meminta kode OTP melalui email.</p><Link href="/" className={textButton}>← Kembali ke Madevi</Link></div></main>}
