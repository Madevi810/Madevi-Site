import "server-only";
import sharp from "sharp";
import { pool } from "./db";
export class InvalidImageError extends Error {}
export type Variant = "small"|"medium"|"large";
export interface MediaStore { putAvatar(userId:string, input:Buffer):Promise<void>; getAvatar(userId:string,variant:Variant):Promise<Buffer|null> }
class PostgresMediaStore implements MediaStore {
  async putAvatar(userId:string,input:Buffer){
    let images:Buffer[];
    try {
      const source=sharp(input,{limitInputPixels:16000000});const meta=await source.metadata();
      if(!["jpeg","png","webp"].includes(meta.format||""))throw new InvalidImageError("INVALID_IMAGE");
      images=await Promise.all(([64,256,512] as const).map(size=>sharp(input,{limitInputPixels:16000000}).rotate().resize(size,size,{fit:"cover"}).webp({quality:80}).toBuffer()));
    } catch {throw new InvalidImageError("INVALID_IMAGE");}
    const client=await pool.connect();try{await client.query("BEGIN");for(const [i,variant] of (["small","medium","large"] as const).entries())await client.query("INSERT INTO madevi_media_variants(user_id,variant,data) VALUES ($1,$2,$3) ON CONFLICT(user_id,variant) DO UPDATE SET data=EXCLUDED.data,created_at=now()",[userId,variant,images[i]]);await client.query("DELETE FROM madevi_avatars WHERE user_id=$1",[userId]);await client.query("INSERT INTO madevi_audit(actor_id,action,target_id) VALUES($1,$2,$1)",[userId,"account.avatar.update"]);await client.query("COMMIT")}catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
  }
  async getAvatar(userId:string,variant:Variant){const result = await pool.query<{image: Buffer | null}>(
      `SELECT COALESCE(
        (SELECT data FROM madevi_media_variants WHERE user_id=$1 AND variant=$2),
        (SELECT image FROM madevi_avatars WHERE user_id=$1)
      ) AS image`, [userId,variant],
    );
    return result.rows[0]?.image ?? null;}
}
export function getMediaStore():MediaStore{if((process.env.MEDIA_BACKEND||"postgres")!=="postgres")throw new Error("Penyedia media belum tersedia");return new PostgresMediaStore()}
