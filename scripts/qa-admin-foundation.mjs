import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyAdminFoundation({origin,adminCookie,userCookie,otherCookie,userId,image,dispatch,db,refreshUser}) {
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
  const announcement={id:randomUUID(),audience:"general",title:"Pengumuman uji idempoten",body:"Keterangan sintetis."};
  await send("/api/admin/notifications",announcement,"POST",201);
  await send("/api/admin/notifications",announcement);
  await send("/api/admin/notifications",{...announcement,title:"Judul berbeda"},"POST",409);
  const upload=async visibility=>{
    const form=new FormData();
    form.set("name",`Bukti ${visibility}`);form.set("visibility",visibility);
    form.set("file",new Blob([image],{type:"image/png"}),"bukti.png");
    form.set("id",randomUUID());
    const result=await send("/api/admin/media",form,"POST",201);
    assert.deepEqual(await send("/api/admin/media",form),result);
    return result;
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
  const document=new FormData();
  document.set("name","Panduan uji");document.set("visibility","private");
  document.set("file",new File(["baris,angka\nContoh,1\n"],"panduan.csv",{type:"text/csv"}));
  const file=await send("/api/admin/media",document,"POST",201);
  const filePath=`/api/media/${file.id}`;
  assert.equal((await request(filePath,outsider)).status,404);
  const adminFile=await request(filePath);
  assert.equal(adminFile.status,200);
  assert.match(adminFile.headers.get("content-disposition"),/^attachment/);
  assert.equal(await adminFile.text(),"baris,angka\nContoh,1\n");
  const currentUser=(await read("/api/admin/users?q=learner-test")).users[0].id;
  const docJob=randomUUID();
  await send("/api/admin/messages",{action:"draft",id:docJob,title:"Lampiran CSV privat",body:"Unduhan uji",audience:"user",recipientId:currentUser,mediaId:file.id});
  const preview=await read(`/api/admin/messages?preview=${docJob}`);
  assert.equal(preview.recipients,1);
  assert.equal(preview.media_name,"Panduan uji");
  const immediate={action:"send",id:docJob,expectedUpdated:preview.updated_at,requestId:randomUUID()};
  const sendResult=await send("/api/admin/messages",immediate);
  assert.equal((await send("/api/admin/messages",immediate)).state,"sent");
  await send("/api/admin/messages",{...immediate,action:"retry"},"POST",409);
  assert.equal((await read("/api/admin/messages")).jobs.find(row=>row.id===docJob).attempts,1);
  assert.equal(sendResult.state,"sent");
  assert.equal((await request(filePath,outsider)).status,200);
  const renewed=await refreshUser();
  assert.equal((await request(filePath,{cookie:renewed})).status,404);
  await send("/api/admin/messages",{action:"cancel",id:docJob},"POST",409);
  await send("/api/admin/messages",{action:"retry",id:docJob},"POST",409);
  const raceId=randomUUID();
  await send("/api/admin/messages",{action:"draft",id:raceId,title:"Persaingan jadwal",body:"Uji.",audience:"user",recipientId:currentUser});
  const raceVersion=(await read(`/api/admin/messages?preview=${raceId}`)).updated_at;
  const results=await Promise.all([{action:"send"},{action:"queue",runAt:new Date(Date.now()+3600000).toISOString()}].map(data=>request("/api/admin/messages",{
    method:"POST",data:{...data,id:raceId,expectedUpdated:raceVersion}
  })));
  assert.deepEqual(results.map(response=>response.status).sort(),[200,409]);
  await send("/api/admin/media",{id:file.id},"DELETE",409);

  const objects=[
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>",
  ];
  let pdf="%PDF-1.7\n";
  const entries=["0000000000 65535 f "];
  for(const [index,content] of objects.entries()) {
    entries.push(`${String(pdf.length).padStart(10,"0")} 00000 n `);
    pdf+=`${index+1} 0 obj\n${content}\nendobj\n`;
  }
  pdf+=`xref\n0 ${entries.length}\n${entries.join("\n")}\ntrailer\n<< /Size ${entries.length} /Root 1 0 R >>\nstartxref\n${pdf.length}\n%%EOF\n`;
  const pdfForm=new FormData();
  pdfForm.set("name","Dokumen PDF uji");pdfForm.set("visibility","public");
  pdfForm.set("file",new File([pdf],"dokumen.pdf",{type:"application/pdf"}));
  const uploadedPdf=await send("/api/admin/media",pdfForm,"POST",201);
  const pdfPath=`/api/media/${uploadedPdf.id}`;
  assert.equal((await request(pdfPath,{cookie:""})).status,404);
  const pdfContent=await send("/api/admin/content",{...draft,slug:"lampiran-pdf-uji",metadata:{mediaIds:[uploadedPdf.id]}},"POST",201);
  for(const action of ["submit","approve","publish"])await send(`/api/admin/content/${pdfContent.id}`,{action,expectedRevision:1});
  const pdfDownload=await request(pdfPath,{cookie:""});
  assert.equal(pdfDownload.status,200);
  assert.equal(pdfDownload.headers.get("content-type"),"application/pdf");
  assert.match(pdfDownload.headers.get("content-disposition"),/^attachment/);
  assert.equal(await pdfDownload.text(),pdf);
  await send("/api/admin/media",{id:uploadedPdf.id},"DELETE",409);

  const versions=(await read("/api/admin/site?resource=settings")).history;
  assert.deepEqual(versions.map(item=>item.version),[1,0]);
  await send("/api/admin/site",{resource:"settings",expectedVersion:0,version:0},"POST",409);
  await send("/api/admin/site",{resource:"settings",expectedVersion:1,version:0});
  const history=(await read("/api/admin/site?resource=settings")).history;
  assert.equal(history[0].restored_from,0);
  assert.equal(history[0].version,2);
  assert.equal(history[1].snapshot.announcement,"Pengumuman pengujian");
  assert.doesNotMatch(await html("/"),/Pengumuman pengujian/);

  const availability=await read("/api/admin/support/availability");
  await send("/api/admin/support/availability",{version:availability.version,
    settings:{mode:"unavailable",zone:"Asia/Jakarta",windows:[],awayReply:"Kami akan membalas saat tersedia."}},"PUT");
  const thread=randomUUID();
  const start={action:"create",id:thread,title:"Percakapan privat",body:"Pertanyaan tentang pengujian ini."};
  async function userWrite(data) {return request("/api/support",{...outsider,method:"POST",data});}
  assert.equal((await userWrite(start)).status,200);
  assert.equal((await userWrite(start)).status,200);
  const sub=`?id=${thread}`;
  const conversation=await read("/api/support"+sub,outsider);
  assert.deepEqual(conversation.posts.map(post=>post.sender),["user","auto"]);
  assert.ok(conversation.posts.some(post=>post.body==="Kami akan membalas saat tersedia."));
  assert.equal((await userWrite({...start,body:"Isi yang berbeda."})).status,409);
  assert.equal((await request("/api/support"+sub,{cookie:""})).status,401);
  assert.equal((await request("/api/support"+sub,{cookie:renewed})).status,404);
  const moderator="/api/admin/support/conversations";
  assert.equal((await request(moderator+sub,outsider)).status,403);
  await send(moderator,{action:"note",id:thread,postId:randomUUID(),version:1,body:"Catatan admin privat"});
  assert.doesNotMatch(JSON.stringify(await read("/api/support"+sub,outsider)),/Catatan admin privat/);
  await send(moderator,{action:"reply",id:thread,postId:randomUUID(),version:2,body:"Balasan admin pengujian"});
  let response=await read("/api/support"+sub,outsider);
  assert.equal(response.thread.status,"waiting_user");
  assert.match(JSON.stringify(response),/Balasan admin pengujian/);
  const followup={action:"reply",id:thread,postId:randomUUID(),version:response.thread.version,body:"Tindak lanjut"};
  assert.equal((await userWrite(followup)).status,200);
  assert.equal((await userWrite(followup)).status,200);
  assert.equal((await userWrite({...followup,body:"Percobaan isi berbeda"})).status,409);
  assert.equal((await userWrite({...followup,postId:randomUUID()})).status,409);
  response=await read(moderator+sub);
  assert.equal(response.thread.status,"waiting_admin");
  await send(moderator,{action:"resolve",id:thread,postId:randomUUID(),version:response.thread.version});
  response=await read("/api/support"+sub,outsider);
  assert.equal(response.thread.status,"resolved");
  assert.equal(response.posts.filter(post=>post.sender==="auto").length,1);
  assert.equal((await userWrite({action:"reply",id:thread,postId:randomUUID(),version:response.thread.version,body:"Ditolak"})).status,409);
  if(process.env.MADEVI_TEST_DATABASE_URL) {
    await db.exec(`INSERT INTO madevi_support_posts(id,thread_id,sender,body)
      SELECT gen_random_uuid(),'${thread}','admin','Pesan pagination '||n FROM generate_series(1,26) n`);
    const latest=await read("/api/support"+sub,outsider);
    assert.equal(latest.posts.length,25);
    assert.ok(latest.before);
    await db.exec(`INSERT INTO madevi_support_posts(id,thread_id,sender,body)
      VALUES(gen_random_uuid(),'${thread}','admin','Sampel baru setelah cursor')`);
    const earlier=await read("/api/support"+sub+"&before="+latest.before,outsider);
    assert.deepEqual(earlier.posts.slice(0,2).map(row=>row.sender),["user","auto"]);
    assert.ok(earlier.posts.every(row=>!latest.posts.some(current=>current.id===row.id)));
    assert.doesNotMatch(JSON.stringify(earlier),/Catatan admin privat|Sampel baru setelah cursor/);
  }
  const reportAttempt={requestId:randomUUID(),message:"Laporan uji kirim berulang."};
  const firstReport=await request("/api/report",{cookie:otherCookie,method:"POST",data:reportAttempt});
  assert.equal(firstReport.status,200);
  const savedReport=await request("/api/report",{cookie:otherCookie,method:"POST",data:reportAttempt});
  assert.equal(savedReport.status,200);
  assert.deepEqual(await firstReport.json(),await savedReport.json());
  const reportConflict=await request("/api/report",{cookie:otherCookie,method:"POST",data:{...reportAttempt,message:"Laporan dengan teks berbeda."}});
  assert.equal(reportConflict.status,409);
  let monitoring=await read("/api/admin/monitoring");
  for(let i=0;i<10&&!monitoring.requests.length;i++){await new Promise(resolve=>setTimeout(resolve,100));monitoring=await read("/api/admin/monitoring");}
  assert.ok(monitoring.checkedAt&&monitoring.since);
  assert.ok(monitoring.requests.some(row=>row.route==="messages.write"&&row.count>0));
  assert.equal((await request("/api/admin/monitoring",outsider)).status,403);
  console.log("Fondasi admin: publikasi, filter, media, pesan, aturan, audit dan akun terverifikasi pada PostgreSQL.");
}
