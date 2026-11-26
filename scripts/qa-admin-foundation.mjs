import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyAdminFoundation({origin,adminCookie,userCookie,otherCookie,userId,image,dispatch,db}) {
  async function request(path,{cookie=adminCookie,method="GET",data}={}) {
    const multipart=data instanceof FormData;
    return fetch(origin+path,{method,headers:{...(cookie?{cookie}:{}),origin,...(data&&!multipart?{"Content-Type":"application/json"}:{})},body:multipart?data:data&&JSON.stringify(data)});
  }
  async function read(path,options) {
    const response=await request(path,options);
    assert.equal(response.status,200,`GET ${path}: ${response.status}`);
    return response.json();
  }
  async function send(path,data,method="POST",status=200) {
    const response=await request(path,{method,data});
    assert.equal(response.status,status,`${method} ${path}: ${await response.clone().text()}`);
    return response.json();
  }
  const outsider={cookie:otherCookie};
  for(const path of ["summary","media","site","support","messages","operations"]) {
    assert.equal((await request(`/api/admin/${path}`,outsider)).status,403);
  }
  const summary=await read("/api/admin/summary");
  assert.equal(summary.readiness,"ready");
  assert.ok(summary.users.reduce((count,row)=>count+row.count,0)>=3);
  assert.ok(summary.migrations.some(migration=>migration.version.startsWith("004")));
  assert.deepEqual((await read("/api/admin/operations")).jobs,[]);
  const upload=async visibility=>{
    const form=new FormData();
    form.set("name",`Bukti ${visibility}`);form.set("visibility",visibility);
    form.set("file",new Blob([image],{type:"image/png"}),"bukti.png");
    return send("/api/admin/media",form,"POST",201);
  };
  const publicImage=await upload("public"), privateImage=await upload("private");
  assert.equal((await request(`/api/media/${privateImage.id}`,{cookie:""})).status,404);
  const draft={space:"school",type:"article",slug:"fondasi-uji",title:"Fondasi browser uji",body:{blocks:["Teks pengujian lokal."]},
    metadata:{category:"Kategori Contoh",tags:["sintetis"],sources:[{title:"Rujukan",url:"https://example.invalid/rujukan"}],mediaIds:[publicImage.id]}};
  await send("/api/admin/content",{...draft,metadata:{mediaIds:[privateImage.id]}},"POST",400);
  const article=await send("/api/admin/content",draft,"POST",201);
  const articlePath=`/api/admin/content/${article.id}`;
  const html=async (path)=>await (await request(path,{cookie:""})).text();
  assert.doesNotMatch(await html("/ruang/school"),/Fondasi browser uji/);
  assert.equal((await request(`/api/media/${publicImage.id}`,{cookie:""})).status,404);
  for(const action of ["submit","approve","publish"])await send(articlePath,{action,expectedRevision:1});
  const publicPage=await html("/ruang/school?category=Kategori+Contoh&tag=sintetis");
  assert.match(publicPage,/Fondasi browser uji/);
  assert.match(await html("/baca/school/fondasi-uji"),/https:\/\/example.invalid\/rujukan/);
  assert.equal((await request(`/api/media/${publicImage.id}`,{cookie:""})).status,200);
  await send("/api/admin/media",{id:publicImage.id},"DELETE",409);
  assert.equal((await read(`${articlePath}/revisions`)).items[0].revision,1);
  const replica=await send(`${articlePath}/revisions`,{revision:1,slug:"fondasi-salinan"});
  assert.equal(replica.status,"draft");
  await send(articlePath,{title:"Revisi tersimpan",body:{blocks:["Khusus draf."]},metadata:draft.metadata,expectedRevision:1},"PATCH");
  const rollback=await send(`${articlePath}/revisions`,{revision:1,expectedRevision:2});
  assert.equal(rollback.revision,3);
  const before=await html("/ruang/school");
  assert.doesNotMatch(before,/Revisi tersimpan|fondasi-salinan/);
  await db.exec(`INSERT INTO madevi_content(id,space,content_type,slug,workflow_status,author_id,latest_revision,published_revision,updated_at)
    SELECT gen_random_uuid(),'school','article','paginasi-identitas-'||n,'published',id,1,1,now()-interval '1 day'
    FROM "user",generate_series(1,20) n WHERE username='madevi-admin';
    INSERT INTO madevi_content_revisions(content_id,revision,title,created_by)
      SELECT id,1,'Paginasi sintetis '||slug,author_id FROM madevi_content WHERE slug LIKE 'paginasi-identitas-%'`);
  assert.match(await html("/ruang/school"),/Berikutnya/);
  assert.match(await html("/ruang/school?page=2"),/Sebelumnya/);
  assert.doesNotMatch(await html("/ruang/school?page=2"),/Fondasi browser uji/);
  assert.match(await html("/cari?q=Paginasi+atau+Fondasi"),/Tidak ada konten yang cocok/);
  const site=await read("/api/admin/site");
  const info=site.pages.find(page=>page.slug==="tentang");
  const patch={slug:"tentang",title:"Informasi sintetis",body:"Isi yang dikelola admin.",visible:true,expectedVersion:info.version};
  await send("/api/admin/site",patch,"PUT");
  assert.match(await html("/info/tentang"),/Isi yang dikelola admin/);
  await send("/api/admin/site",patch,"PUT",409);
  await send("/api/admin/site",{...patch,visible:false,expectedVersion:info.version+1},"PUT");
  assert.equal((await request("/info/tentang",{cookie:""})).status,404);
  await send("/api/admin/site",{navigation:[{label:"Tautan uji",href:"javascript:example"}],announcement:"",expectedVersion:0},"PUT",400);
  await send("/api/admin/site",{navigation:[{label:"Tautan uji",href:"/info/bantuan"}],announcement:"Pengumuman pengujian",expectedVersion:0},"PUT");
  assert.match(await html("/"),/Pengumuman pengujian/);
  const templateId=randomUUID();
  await send("/api/admin/messages",{action:"template",id:templateId,name:"Contoh",title:"Halo {{nama}}",body:"Pesan dari {{situs}}."});
  await send("/api/admin/messages",{action:"template",id:randomUUID(),name:"Salah",title:"Halo {{variabel}}",body:"Pesan."},"POST",400);
  const id=randomUUID();
  const message={action:"draft",id,title:"Pesan tunggal uji",body:"Dari {{situs}}.",audience:"user",recipientId:userId,mediaId:privateImage.id};
  await send("/api/admin/messages",message);
  await send("/api/admin/messages",message,"POST",409);
  await send("/api/admin/messages",{action:"queue",id});
  await dispatch();
  await dispatch();
  const jobs=await read("/api/admin/messages");
  assert.equal(jobs.jobs.find(row=>row.id===id).deliveries,1);
  const inbox=await read("/api/notifications?category=system",{cookie:userCookie});
  const delivered=inbox.notifications.filter(row=>row.title===message.title);
  assert.equal(delivered.length,1);
  assert.equal(delivered[0].media_id,privateImage.id);
  assert.equal((await request(`/api/media/${privateImage.id}`,{cookie:userCookie})).status,200);
  assert.equal((await request(`/api/media/${privateImage.id}`,outsider)).status,404);
  assert.equal((await request("/api/notifications",{...outsider,method:"POST",data:{id:delivered[0].id}})).status,200);
  assert.equal((await read("/api/admin/messages")).jobs.find(row=>row.id===id).reads,0);
  assert.equal((await request("/api/notifications",{cookie:userCookie,method:"POST",data:{id:delivered[0].id}})).status,200);
  assert.equal((await read("/api/admin/messages")).jobs.find(row=>row.id===id).reads,1);
  const futureId=randomUUID();
  await send("/api/admin/messages",{action:"draft",id:futureId,title:"Jadwal uji",body:"Pengujian.",audience:"all"});
  await send("/api/admin/messages",{action:"queue",id:futureId,runAt:new Date(Date.now()+60*60*1000).toISOString()});
  await dispatch();
  assert.equal((await read("/api/admin/messages")).jobs.find(row=>row.id===futureId).status,"scheduled");
  await send("/api/admin/messages",{action:"cancel",id:futureId});
  await send("/api/admin/support",{keyword:"pandu",response:"Petunjuk sintetis.",startsAt:null,endsAt:null,enabled:true},"PUT");
  const report=await request("/api/report",{cookie:otherCookie,method:"POST",data:{message:"Mohon pandu cara menguji."}});
  assert.equal(report.status,200);
  assert.equal((await report.json()).automaticResponse,"Petunjuk sintetis.");
  const reportData=(await read("/api/admin/reports?status=new")).reports.find(row=>row.body==="Mohon pandu cara menguji.");
  await send("/api/admin/reports",{id:Number(reportData.id),status:"resolved",priority:"high",note:"Bukti diperiksa."},"PATCH");
  assert.equal((await read(`/api/admin/reports?id=${reportData.id}`)).history[0].note,"Bukti diperiksa.");
  const retryId=randomUUID();
  await send("/api/admin/messages",{...message,id:retryId,title:"Coba lagi uji"});
  await send("/api/admin/users",{id:userId,action:"suspend",reason:"Jeda pengujian",until:new Date(Date.now()+60*60*1000).toISOString()});
  assert.equal((await read(`/api/admin/users?id=${userId}`)).account.status,"suspended");
  assert.equal((await request("/api/account/profile",{cookie:userCookie})).status,401);
  const firstAttempt=await send("/api/admin/messages",{action:"send",id:retryId});
  assert.equal(firstAttempt.state,"failed");
  assert.equal((await read("/api/admin/messages")).jobs.find(row=>row.id===retryId).failure_code,"no_recipients");
  await send("/api/admin/users",{id:userId,action:"ban",reason:"Uji pembatasan tanpa batas waktu"});
  assert.equal((await read(`/api/admin/users?id=${userId}`)).account.status,"banned");
  await send("/api/admin/users",{id:userId,action:"revoke",reason:"Uji pencabutan sesi"});
  const account=await read(`/api/admin/users?id=${userId}`);
  assert.equal(account.account.sessions,0);
  assert.equal(account.history[0].outcome,"success");
  await send("/api/admin/users",{id:userId,action:"restore",reason:"Akhiri pembatasan uji"});
  await send("/api/admin/messages",{action:"retry",id:retryId});
  await dispatch();
  const retried=(await read("/api/admin/messages")).jobs.find(row=>row.id===retryId);
  assert.equal(retried.deliveries,1);
  assert.equal(retried.attempts,2);
  console.log("Fondasi admin: publikasi, filter, media, pesan, aturan, audit dan akun terverifikasi pada PostgreSQL.");
}
