"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

export function SessionActivity() {
  const {data}=authClient.useSession();
  const userId=data?.user.id;
  useEffect(()=>{
    if(!userId)return;
    let last=0;
    const activity=(event:Event)=>{
      if(!event.isTrusted||document.visibilityState!=="visible"||Date.now()-last<60000)return;
      last=Date.now();
      void fetch("/api/account/activity",{method:"POST",cache:"no-store"}).catch(()=>{});
    };
    window.addEventListener("pointerdown",activity,{passive:true});
    window.addEventListener("keydown",activity,{passive:true});
    return ()=>{
      window.removeEventListener("pointerdown",activity);
      window.removeEventListener("keydown",activity);
    };
  },[userId]);
  return null;
}
