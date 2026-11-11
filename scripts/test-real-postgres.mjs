// Isolated local PostgreSQL test: never run against an existing cluster.
import { mkdtemp, cp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile as execFileCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import assert from 'node:assert/strict';
const execFile=promisify(execFileCb);
const bin=process.env.MADEVI_POSTGRES_BIN_DIR;
if(!bin) throw Error('Set MADEVI_POSTGRES_BIN_DIR to an installed PostgreSQL bin directory.');
const base=await mkdtemp(path.join(tmpdir(),'madevi-pg-test-'));
const data=path.join(base,'data'), backup=path.join(base,'restored'), log=path.join(base,'postgres.log');
const env={...process.env,LD_LIBRARY_PATH:[path.join(bin,'..','lib'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')};
const command=async(name,args)=>execFile(path.join(bin,name),args,{env,maxBuffer:2_000_000});
let running=null;
const start=async(dir,port)=>{try{await command('pg_ctl',['-D',dir,'-l',log,'-o',`-h 127.0.0.1 -p ${port} -c unix_socket_directories=''`,'-w','start']);running=dir}catch(e){console.error(await readFile(log,'utf8').catch(()=>''));throw e}};
const stop=async()=>{if(running){const dir=running;running=null;await command('pg_ctl',['-D',dir,'-m','fast','-w','stop'])}};
try{
 await command('initdb',['-D',data,'--auth=trust','--username=madevi','--no-locale','--encoding=UTF8']);
 await start(data,25435);
 let client=new pg.Client({connectionString:'postgresql://madevi@127.0.0.1:25435/postgres'});await client.connect();await client.query('CREATE DATABASE madevi_ci_test');await client.end();
 await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['scripts/test-db-local.mjs'],{stdio:'inherit',env:{...env,MADEVI_TEST_DATABASE_URL:'postgresql://madevi@127.0.0.1:25435/madevi_ci_test'}});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`Integration exited ${code}`)))});
 if(process.env.MADEVI_TEST_BUILD==='1' && process.env.MADEVI_VISUAL_CHECK==='1'){
  const origin='http://127.0.0.1:3001';
  const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3001'],{stdio:'ignore',env:{...env,NODE_ENV:'production',MADEVI_ENV:'staging',MADEVI_DEMO_MODE:'false',DATABASE_URL:'postgresql://madevi@127.0.0.1:25435/madevi_ci_test',BETTER_AUTH_URL:'https://localhost',BETTER_AUTH_SECRET:'local-integration-test-secret-only-at-least-32'}});
  try{
   let ready=false;for(let i=0;i<30;i++){try{if((await fetch(origin)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}assert.ok(ready,'production server');
   const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true,executablePath:process.env.MADEVI_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--single-process']});
   try{const page=await browser.newPage({viewport:{width:390,height:844}});const violations=[];page.on('console',m=>{if(m.type()==='error'&&/content security policy/i.test(m.text()))violations.push(m.text())});await page.goto(origin);await page.getByRole('button',{name:'Buka menu'}).click();await page.getByText('Ruang Madevi',{exact:true}).last().waitFor();assert.deepEqual(violations,[]);console.log('Lulus: build production, nonce CSP dan interaksi sidebar di browser.')}finally{await browser.close()}
  }finally{app.kill('SIGTERM');await new Promise(r=>app.once('exit',r))}
 }
 await stop();await cp(data,backup,{recursive:true});await start(backup,25436);
 client=new pg.Client({connectionString:'postgresql://madevi@127.0.0.1:25436/madevi_ci_test'});await client.connect();
 const result=await client.query(`SELECT (SELECT count(*) FROM "user" WHERE username='madevi-admin') AS admins, (SELECT count(*) FROM madevi_content WHERE slug='uji-sistem') AS contents, (SELECT count(*) FROM madevi_schema_migrations WHERE version='001_foundation') AS migrations`);await client.end();
 for(const value of Object.values(result.rows[0]))assert.equal(Number(value),1);
 console.log('Lulus: backup fisik PostgreSQL saat berhenti, restore pada cluster terpisah, dan verifikasi data.');
}finally{await stop();await rm(base,{recursive:true,force:true})}
