import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { migrationVersions } from "../src/lib/schema-version.ts";

const exec=promisify(execFile);
const endpoint="/api/admin/operations";
export async function operationsFixture(database,container) {
  assert.match(container,/^[0-9a-f]{12,64}$/);
  assert.equal((await exec("docker",["inspect","-f",'{{index .Config.Labels "madevi.scope"}}',container])).stdout.trim(),"synthetic-ci");
  const root=await mkdtemp(join(tmpdir(),"madevi-ops-fixture-"));
  const dir=join(root,"backups"),bin=join(root,"bin"),profiles=join(root,"profiles");
  const targetUrl=new URL(database);
  const target="madevi_restore_"+randomBytes(6).toString("hex");
  targetUrl.pathname="/"+target;
  try {
    for(const path of [dir,bin,profiles])await mkdir(path,{mode:0o700});
    await exec("docker",["exec",container,"createdb","-U","madevi_test",target]);
    const rules={pg_dump:'docker exec "$container" pg_dump -U "$PGUSER" -d "$PGDATABASE" "$@"',
      pg_restore:'docker exec -i "$container" pg_restore -U "$PGUSER" "${@:1:$#-1}" < "${!#}"'};
    for(const [name,command] of Object.entries(rules)) {
      await writeFile(join(bin,name),`#!/usr/bin/env bash\nset -eu\ncontainer=${container}\n${command}\n`,{mode:0o700});
    }
    const configuration={id:"normal",cpus:1,memoryMiB:512};
    const current={id:"current",image:"sha256:"+"a".repeat(64),migrations:migrationVersions};
    const previous={id:"previous",image:"sha256:"+"b".repeat(64),migrations:migrationVersions.slice(0,-1)};
    const catalog=join(root,"catalog.json");
    await writeFile(join(profiles,"active.json"),JSON.stringify({release:current,configuration}),{mode:0o600});
    await writeFile(catalog,JSON.stringify({directory:profiles,project:"madevi-fixture",releases:[current,previous],configurations:[configuration]}),{mode:0o600});
    return {dir,target,container,source:new URL(database).pathname.slice(1),
      env:{PATH:`${bin}:${process.env.PATH}`,MADEVI_BACKUP_DIR:dir,MADEVI_BACKUP_KEY:randomBytes(32).toString("hex"),
        MADEVI_RESTORE_DATABASE_URL:targetUrl.href,MADEVI_HOST_CATALOG:catalog},
      close:()=>rm(root,{recursive:true,force:true})};
  } catch(error){await rm(root,{recursive:true,force:true});throw error;}
}

export async function verifyOperations({origin,adminCookie,unverifiedCookie,userCookie,password,fixture,invoke,pool,browserEnabled}) {
  const request=(path=endpoint,{cookie=adminCookie,...options}={})=>fetch(origin+path,{
    ...options,headers:{cookie,origin,"content-type":"application/json"}
  });
  async function submit(body,code=202,cookie=adminCookie) {
    const response=await request(endpoint,{cookie,method:"POST",body:JSON.stringify({id:randomUUID(),password,...body})});
    assert.equal(response.status,code,await response.clone().text());
    return response.json();
  }
  const read=async()=>{
    const response=await request();assert.equal(response.status,200);return response.json();
  };
  const state=async(id,expected)=>{
    const result=(await read()).jobs.find(item=>item.id===id);assert.equal(result?.status,expected,JSON.stringify(result));
    return result;
  };
  await submit({kind:"backup"},403,userCookie);
  await submit({kind:"backup"},403,unverifiedCookie);
  await invoke();
  const config=(await read()).worker.capabilities;
  assert.equal(config.backup,true);
  assert.match(config.restoreTarget,/madevi_restore_/);
  const id=randomUUID();
  await submit({id,kind:"backup",password:"incorrect synthetic password"},403);
  async function useOwnerPage(run) {
    const browser=await chromium.launch({executablePath:process.env.MADEVI_CHROMIUM_PATH||undefined});
    try {
      const context=await browser.newContext({viewport:{width:390,height:844}});
      await context.addCookies(adminCookie.split("; ").map(token=>{const [name,...value]=token.split("=");return {name,value:value.join("="),url:origin};}));
      const page=await context.newPage();
      await page.goto(origin+"/admin?panel=system");
      await page.getByRole("heading",{name:"Ajukan pekerjaan"}).waitFor();
      return await run(page);
    } finally {await browser.close();}
  }
  async function confirmOnPage(page) {
    await page.getByLabel("Kata sandi admin").fill(password);
    await page.getByRole("button",{name:"Ajukan operasi"}).click();
    await page.getByText("Permintaan tercatat.",{exact:false}).waitFor();
  }
  if(browserEnabled) {
    await useOwnerPage(async page=>{
      await confirmOnPage(page);
      const queued=(await read()).jobs.find(item=>item.kind==="backup"&&item.status==="queued");
      assert.ok(queued);
      const lock=await pool.connect();
      try {
        await lock.query("SELECT pg_advisory_lock(7412311)");
        await invoke();
        await state(queued.id,"queued");
      } finally{await lock.query("SELECT pg_advisory_unlock(7412311)");lock.release();}
      await Promise.all([invoke(),invoke()]);
      await page.getByRole("button",{name:"Muat ulang status"}).click();
      await page.getByRole("link",{name:"Unduh terenkripsi"}).waitFor();
      await state(queued.id,"completed");
    });
  } else {
    await submit({id,kind:"backup"});
    await invoke();
  }
  const first=(await read()).artifacts[0];
  assert.ok(first?.id&&first.bytes);
  const replay=await submit({id:first.id,kind:"backup"},200);
  assert.equal(replay.status,"completed");
  assert.equal((await read()).artifacts.length,1);
  const secured=`${endpoint}/artifacts/${first.id}`;
  assert.equal((await request(secured,{cookie:userCookie})).status,403);
  const archive=await request(secured);assert.equal(archive.status,200);
  assert.match(archive.headers.get("content-disposition"),/^attachment/);
  assert.equal(Buffer.from(await archive.arrayBuffer()).subarray(0,8).toString(),"MADEVIB1");
  const verify=await submit({kind:"verify",artifactId:first.id});
  await invoke();
  await state(verify.id,"completed");
  const check=await submit({kind:"target_check",target:config.restoreTarget});
  await invoke();
  await state(check.id,"completed");
  const restore={kind:"restore",artifactId:first.id,target:config.restoreTarget,checkId:check.id};
  await submit({...restore,confirmation:"PULIHKAN target-lain"},409);
  const bound=`PULIHKAN ${config.restoreTarget} ${check.id} ${first.id}`;
  if(browserEnabled) {
    await useOwnerPage(async page=>{
      await page.getByRole("button",{name:"Pilih untuk restore",exact:true}).click();
      await page.getByText("Target lulus pemeriksaan pada",{exact:false}).waitFor();
      await page.getByText(bound,{exact:true}).waitFor();
      await page.locator('input[name="confirmation"]').fill(bound);
      await confirmOnPage(page);
      const job=(await read()).jobs.find(row=>row.kind==="restore"&&row.status==="queued");
      assert.ok(job);
      await invoke();
      await page.getByRole("button",{name:"Muat ulang status"}).click();
      await page.getByText("Restore database · Selesai",{exact:true}).waitFor();
      await state(job.id,"completed");
      await page.getByRole("combobox").first().selectOption("release");
      await page.getByRole("combobox").last().selectOption("previous");
      await page.getByText("Rilis tujuan tidak kompatibel dengan skema aktif.",{exact:true}).waitFor();
      assert.equal(await page.getByRole("button",{name:"Ajukan operasi"}).isDisabled(),true);
    });
  } else {
    const actual=await submit({...restore,confirmation:bound});
    await invoke();
    await state(actual.id,"completed");
  }
  const ddl="SELECT version,checksum FROM madevi_schema_migrations ORDER BY version; SELECT mime_type,count(*) FROM madevi_library WHERE mime_type IN ('text/csv','text/plain','application/pdf') GROUP BY mime_type ORDER BY mime_type";
  const dbValues=async(name)=>(await exec("docker",["exec",fixture.container,"psql","-X","-U","madevi_test","-d",name,"-Atc",ddl])).stdout.trim();
  assert.equal(await dbValues(fixture.source),await dbValues(fixture.target));
  const host=(await read()).worker.capabilities.host;
  const previous=host.releases.find(item=>item.id==="previous");
  await submit({kind:"release",artifactId:first.id,target:previous.id,revision:previous.revision,confirmation:`TERAPKAN ${previous.id}`},409);
  const res=await request("/api/admin/monitoring");
  assert.equal(res.status,200);
  const metrics=await res.json();
  assert.equal(metrics.host.metrics.live.ok,true);
  assert.ok(metrics.operations.some(item=>item.kind==="restore"&&item.completed===1));
  await pool.query("UPDATE madevi_operations_health SET checked_at=now()-interval '11 minutes' WHERE id=1");
  const stale=await (await request("/api/admin/monitoring")).json();
  assert.equal(stale.host.fresh,false);
  await invoke();
  const recovered=await (await request("/api/admin/monitoring")).json();
  assert.equal(recovered.host.fresh,true);
  assert.ok(recovered.incidents.some(item=>item.source==="worker.heartbeat"&&item.resolved_at));
  console.log("Operasi admin lulus pada PostgreSQL 18: MFA, idempotensi, lock, backup, unduh, restore, dan penolakan skema rollback.");
}
