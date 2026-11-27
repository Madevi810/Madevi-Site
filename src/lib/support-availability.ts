import { z } from "zod";

function validZone(name:string) {
  try {new Intl.DateTimeFormat("en",{timeZone:name});return !/^[+-]/.test(name);}
  catch {return false;}
}
const time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const window=z.object({day:z.number().int().min(0).max(6),start:time,end:z.union([time,z.literal("24:00")])}).strict().refine(item=>item.start<item.end);
export const availabilityInput=z.object({
  mode:z.enum(["schedule","available","unavailable"]),
  zone:z.string().max(64).refine(validZone), windows:z.array(window).max(28),
  awayReply:z.string().trim().max(2000),
}).strict().refine(({windows})=>windows.every((item,i)=>windows.slice(i+1).every(other=>item.day!==other.day||item.start>=other.end||other.start>=item.end)));
export type Availability=z.infer<typeof availabilityInput>;
export const defaultAvailability:Availability={mode:"available",zone:"Asia/Jakarta",windows:[],awayReply:""};

export function isAdminAvailable(settings:Availability,now:Date) {
  if(settings.mode!=="schedule")return settings.mode==="available";
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:settings.zone,weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const find=(type:string)=>parts.find(part=>part.type===type)?.value;
  const day=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(find("weekday")??"");
  const clock=`${find("hour")}:${find("minute")}`;
  return settings.windows.some(window=>window.day===day&&window.start<=clock&&clock<window.end);
}
