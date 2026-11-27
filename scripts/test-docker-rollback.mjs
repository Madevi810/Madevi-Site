// Uses the actual Docker/Compose activator against an isolated HTTP health fixture.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createHostActivator, hostChoices, runHostRollback } from "./host-profile.mjs";
import { migrationVersions } from "../src/lib/schema-version.ts";

const execute=promisify(execFile);
const docker=(...args)=>execute("docker",["--host","unix:///var/run/docker.sock",...args],{timeout:90000});
const project="madeviqa-"+randomUUID().slice(0,8);
const directory=await mkdtemp(join(tmpdir(),project+"-"));
const statePath=join(directory,"active.json"),overridePath=join(directory,"profile.json"),composeFile=join(directory,"compose.json");
const compose=(...args)=>docker("compose","-p",project,"-f",composeFile,"-f",overridePath,...args);
const sourceImage="caddy:2.10-alpine";
const images=[];
async function fixtureImage(status) {
  const container=(await docker("create","--label","madevi.scope=synthetic-rollback",sourceImage)).stdout.trim();
  try {
    const name=`${project}:${status}`;
    const id=(await docker("commit","--change",`ENV FIXTURE_READY=${status}`,container,name)).stdout.trim();
    images.push(name);
    return id;
  } finally {await docker("rm",container);}
}
async function unusedPort() {
  const socket=createServer();
  try {
    await new Promise((resolve,reject)=>{socket.once("error",reject);socket.listen(0,"127.0.0.1",resolve);});
    return socket.address().port;
  } finally {await new Promise(resolve=>socket.close(resolve));}
}
try {
  await docker("image","inspect",sourceImage);
  const port=await unusedPort();
  const caddy=join(directory,"Caddyfile");
  await writeFile(caddy,'{\n  admin off\n}\n:8080 {\n  respond /api/health/live 200\n  respond /api/health/ready {$FIXTURE_READY:200}\n}\n',{mode:0o600});
  await writeFile(composeFile,JSON.stringify({services:{madevi:{
    image:sourceImage, command:["caddy","run","--config","/etc/caddy/Caddyfile","--adapter","caddyfile"],
    ports:[`127.0.0.1:${port}:8080`],volumes:[`${caddy}:/etc/caddy/Caddyfile:ro`],labels:{"madevi.scope":"synthetic-rollback"}
  }}}),{mode:0o600});
  const good={id:"known-good",image:await fixtureImage(200),migrations:migrationVersions};
  const bad={id:"unready",image:await fixtureImage(503),migrations:migrationVersions};
  const normal={id:"normal",cpus:1,memoryMiB:512},limited={id:"limited",cpus:0.5,memoryMiB:384};
  const host={catalog:{project,releases:[good,bad],configurations:[normal,limited]},state:{release:good,configuration:normal},statePath,overridePath};
  const activateProfile=createHostActivator({composeFile,downloads:null,probeOrigin:`http://127.0.0.1:${port}`,attempts:8,retryMs:300});
  async function check(image,configuration) {
    const id=(await compose("ps","-q","madevi")).stdout.trim();
    assert.ok(id);
    assert.equal((await docker("inspect","--format","{{.Image}} {{.HostConfig.NanoCpus}}",id)).stdout.trim(),`${image} ${configuration.cpus*1e9}`);
    assert.equal(JSON.parse(await readFile(statePath,"utf8")).configuration.id,configuration.id);
    return id;
  }
  await activateProfile(host,host.state);
  const first=await check(good.image,normal);
  const client={query:async()=>({rows:migrationVersions.map(version=>({version}))})};
  const phases=[];
  const base={host,client,progress:async phase=>phases.push(phase),artifact:async()=>{},activateProfile};
  await runHostRollback({...base,kind:"host_config",target:limited.id,revision:hostChoices(host).configurations[1].revision});
  assert.notEqual(await check(good.image,limited),first);
  host.state={release:good,configuration:limited};
  await assert.rejects(runHostRollback({...base,kind:"release",target:bad.id,revision:hostChoices(host).releases[1].revision}),/sebelumnya dipulihkan/);
  assert.equal(phases.at(-1),"recovering");
  await check(good.image,limited);
  console.log("Docker Compose terisolasi lulus: container dibuat ulang, profil CPU diterapkan, dan image sebelumnya dipulihkan setelah probe 503.");
} finally {
  await compose("down","--volumes","--remove-orphans").catch(()=>{});
  for(const image of images)await docker("image","rm",image).catch(()=>{});
  await rm(directory,{recursive:true,force:true});
}
