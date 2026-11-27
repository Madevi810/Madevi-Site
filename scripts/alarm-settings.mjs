import { smtpSettings } from "../src/lib/env.ts";
import { integerSetting } from "./maintenance.mjs";

export function alertSettings(env=process.env) {
  const recipient=env.MADEVI_ALERT_TO;
  if(!recipient)return null;
  const smtp=smtpSettings(env);
  if(!smtp||!env.MADEVI_OPS_STATE_DIR||recipient.length>254||!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(recipient))throw Error("invalid_alert_channel");
  return {recipient,smtp,directory:env.MADEVI_OPS_STATE_DIR,
    failures:integerSetting(env.MADEVI_ALERT_FAILURES,3,2,30),
    repeatMs:integerSetting(env.MADEVI_ALERT_REPEAT_MINUTES,360,15,1440)*60000,
    maxRepeats:integerSetting(env.MADEVI_ALERT_MAX_REPEATS,2,0,5),
    freePercent:integerSetting(env.MADEVI_ALERT_DISK_FREE_PERCENT,10,1,50)};
}
