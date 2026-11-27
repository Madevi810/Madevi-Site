import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
// @ts-expect-error operational entry point is plain Node JavaScript
import { hostChoices, runHostRollback } from "../scripts/host-profile.mjs";

test("host rollback verifies compatibility and restores the previous profile after unhealthy restart",async(t)=>{
  const directory=await mkdtemp(join(tmpdir(),"madevi-profile-test-"));
  t.after(()=>rm(directory,{force:true,recursive:true}));
  const migrations=["001_foundation","002_notifications"];
  const initial={id:"initial",image:"sha256:"+"a".repeat(64),migrations};
  const target={id:"earlier",image:"sha256:"+"b".repeat(64),migrations};
  const wrong={id:"old",image:"sha256:"+"c".repeat(64),migrations:["001_foundation"]};
  const configuration={id:"default",cpus:1,memoryMiB:512};
  const host={statePath:join(directory,"active.json"),state:{release:initial,configuration},catalog:{releases:[initial,target,wrong],configurations:[configuration]}};
  const choices=hostChoices(host);
  const client={query:async()=>({rows:migrations.map(version=>({version}))})};
  const phases:string[]=[],seen:string[]=[];
  let verified=0;
  const common={host,kind:"release",client,artifact:async()=>{verified++;},progress:async(phase:string)=>{phases.push(phase);}};
  await assert.rejects(()=>runHostRollback({...common,target:"old",revision:choices.releases[2].revision,
    activateProfile:async()=>{assert.fail("host should not be touched");}}),/tidak kompatibel/);
  assert.equal(verified,0);
  await assert.rejects(()=>runHostRollback({...common,target:"earlier",revision:choices.releases[1].revision,
    activateProfile:async(_host:unknown,state:typeof host.state)=>{
      seen.push(state.release.id);
      if(state.release.id==="earlier")throw Error("simulated unhealthy container");
    }}),/dipulihkan dan lulus probe/);
  assert.deepEqual(seen,["earlier","initial"]);
  assert.deepEqual(phases,["verifying","restarting","recovering"]);
  assert.equal(verified,1);
  const outcome=await runHostRollback({...common,kind:"host_config",target:configuration.id,
    revision:choices.configurations[0].revision,activateProfile:async(_host:unknown,state:typeof host.state)=>{
      assert.equal(state.release.id,"initial");assert.deepEqual(state.configuration,configuration);
    }});
  assert.match(outcome.details,/Probe live, ready/);
});


test("host preparation creates a private Compose profile and refuses overwriting it",async(t)=>{
  const dir=await mkdtemp(join(tmpdir(),"madevi-prepare-test-"));
  t.after(()=>rm(dir,{force:true,recursive:true}));
  const directory=join(dir,"profiles");
  await mkdir(directory,{mode:0o700});
  const catalog=join(dir,"catalog.json");
  const choice={id:"normal",cpus:1,memoryMiB:768};
  const release={id:"current",image:"sha256:"+"a".repeat(64),migrations:["001_foundation"]};
  await writeFile(catalog,JSON.stringify({directory,project:"madevi-test",releases:[release],configurations:[choice]}),{mode:0o600});
  const command=()=>promisify(execFile)(process.execPath,["scripts/host-profile.mjs","current","normal"],{env:{...process.env,MADEVI_HOST_CATALOG:catalog}});
  await command();
  assert.deepEqual(JSON.parse(await readFile(join(directory,"active.json"),"utf8")),{release,configuration:choice});
  const profile=JSON.parse(await readFile(join(directory,"compose.override.json"),"utf8"));
  assert.deepEqual(profile,{services:{madevi:{image:release.image,cpus:1,mem_limit:"768m"}}});
  await assert.rejects(command);
});
