import { apiRoute } from "@/lib/api-response";
import { currentPrincipal } from "@/lib/access";
import { pool } from "@/lib/db";
async function handleGET(_request:Request,{params}:{params:Promise<{id:string}>}){if(!await currentPrincipal('reports.read'))return new Response(null,{status:403});const {id}=await params;if(!/^[1-9]\d{0,15}$/.test(id))return new Response(null,{status:400});const result=await pool.query('SELECT image_webp FROM madevi_reports WHERE id=$1',[id]);const bytes:Buffer|undefined=result.rows[0]?.image_webp;if(!bytes)return new Response(null,{status:404});return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}})}

export const GET=apiRoute("/api/admin/reports/[id]/image", "GET", handleGET);
