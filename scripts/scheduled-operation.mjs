import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const tasks=new Map([
  ["messages","dispatch-messages.mjs"],["operations","run-operations.mjs"],
  ["maintenance","maintenance.mjs"],["alarm","operational-alarm.mjs"],
]);
const name=process.argv[2];
if(!tasks.has(name)||process.argv.length!==3) {
  console.error("Pilih satu tugas host: messages, operations, maintenance, alarm.");
  process.exitCode=1;
} else {
  const script=fileURLToPath(new URL(tasks.get(name),import.meta.url));
  const child=spawn(process.execPath,[script],{stdio:"inherit"});
  process.exitCode=await new Promise(resolve=>{
    child.once("error",()=>resolve(1));
    child.once("exit",code=>resolve(code??1));
  });
}
