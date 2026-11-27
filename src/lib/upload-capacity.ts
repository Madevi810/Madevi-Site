import { failure } from "./api";

let active = 0;

export async function withUploadCapacity(run:()=>Promise<Response>) {
  if(active>=4)return failure("Pemrosesan unggahan sedang penuh.",429,5);
  active++;
  try {return await run();}
  finally {active--;}
}
