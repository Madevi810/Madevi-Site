import "server-only";
import sharp from "sharp";
import { pool } from "./db";
export type Variant = "small"|"medium"|"large";
export interface MediaStore { putAvatar(userId:string, input:Buffer):Promise<void>; getAvatar(userId:string,variant:Variant):Promise<Buffer|null> }
class PostgresMediaStore implements MediaStore {
  async putAvatar(userId:string,input:Buffer){
    const source=sharp(input,{limitInputPixels:16000000});const meta=await source.metadata();
    if(!["jpeg","png","webp"].includes(meta.format||""))throw new Error("INVALID_IMAGE");
    const images=await Promise.all(([64,256,512] as const).map(size=>sharp(input,{limitInputPixels:16000000}).rotate().resize(size,size,{fit:"cover"}).webp({quality:80}).toBuffer()));
    const client=await pool.connect();try{await client.query("BEGIN");for(const [i,variant] of (["small","medium","large"] as const).entries())await client.query("INSERT INTO madevi_media_variants(user_id,variant,data) VALUES ($1,$2,$3) ON CONFLICT(user_id,variant) DO UPDATE SET data=EXCLUDED.data,created_at=now()",[userId,variant,images[i]]);await client.query("INSERT INTO madevi_avatars(user_id,image) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET image=EXCLUDED.image,updated_at=now()",[userId,images[2]]);await client.query("COMMIT")}catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
  }
  async getAvatar(userId:string,variant:Variant){const result=await pool.query("SELECT data AS image FROM madevi_media_variants WHERE user_id=$1 AND variant=$2 UNION ALL SELECT image FROM madevi_avatars WHERE user_id=$1 LIMIT 1",[userId,variant]);return result.rowCount?result.rows[0].image:null}
}
export function getMediaStore():MediaStore{if((process.env.MEDIA_BACKEND||"postgres")!=="postgres")throw new Error("Penyedia media belum tersedia");return new PostgresMediaStore()}
