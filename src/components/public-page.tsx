import type { ComponentProps } from "react";
import { readSite,readInformation } from "@/lib/site-config";
import { PublicShell } from "./public-shell";

export async function PublicPage(props:ComponentProps<typeof PublicShell>) {
  const [site,pages]=await Promise.all([readSite(),readInformation()]).catch(()=>[null,null]);
  return <PublicShell {...props} announcement={site?.announcement} navigation={site?.navigation}
    hiddenInformation={pages?.filter(page=>!page.visible).map(page=>page.slug)}/>;
}
