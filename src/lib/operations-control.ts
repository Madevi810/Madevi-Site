import "server-only";
import { z } from "zod";

const choice=z.object({
  id:z.string(),revision:z.string(),migrations:z.array(z.string()).optional(),
  cpus:z.number().optional(),memoryMiB:z.number().optional(),
});
export const capabilitiesSchema=z.object({
  backup:z.boolean(),restoreTarget:z.string().nullable(),
  host:z.object({active:z.object({release:z.string(),configuration:z.string()}),
    releases:z.array(choice),configurations:z.array(choice)}).nullable()
});

export const operationRequest=z.object({
  id:z.uuid(),kind:z.enum(["backup","verify","target_check","restore","release","host_config"]),
  artifactId:z.uuid().optional(),target:z.string().max(300).optional(),checkId:z.uuid().optional(),
  revision:z.string().regex(/^[a-f0-9]{64}$/).optional(),
  confirmation:z.string().max(480).optional(),password:z.string().min(1).max(128),
  retryOf:z.uuid().optional(),
}).strict().refine(input=>{
  const switching=input.kind==="release"||input.kind==="host_config";
  const restoring=input.kind==="restore";
  return Boolean(input.target)===(switching||restoring||input.kind==="target_check")
    && Boolean(input.revision)===switching && Boolean(input.checkId)===restoring
    && Boolean(input.confirmation)===(switching||restoring)
    && Boolean(input.artifactId)===(!["backup","target_check"].includes(input.kind));
});

export function restoreConfirmation(target:string,check:string,artifactId:string) {
  return `PULIHKAN ${target} ${check} ${artifactId}`;
}
