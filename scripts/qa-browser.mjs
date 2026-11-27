import assert from 'node:assert/strict';
import { hashPassword } from 'better-auth/crypto';

// Uses only the disposable integration database, never a real user's account.
export async function verifyRegressionJourneys({browser,origin,env,db}) {
  const password=` ${env.DEMO_PASSWORD} `;
  await db.exec(`UPDATE account SET password='${await hashPassword(password)}' WHERE "userId"=(SELECT id FROM "user" WHERE username='madevi-user')`);
  const context=await browser.newContext({viewport:{width:768,height:1024}});
  const page=await context.newPage();
  try {
    await page.goto(origin);
    await page.getByRole('button',{name:'Buka menu'}).click();
    await page.getByRole('button',{name:'Profil',exact:true}).click();
    await page.locator('input[name="identity"]').fill('Madevi-User');
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button',{name:'Masuk',exact:true}).last().click();
    await page.getByRole('button',{name:'Keluar',exact:true}).waitFor();

    await page.route('**/api/account/social-profile',route=>route.request().method()==='GET'?route.fulfill({status:503,json:{error:'test outage'}}):route.continue());
    await page.route('**/api/account/profile',route=>route.request().method()==='GET'?route.fulfill({status:503,json:{error:'test outage'}}):route.continue());
    await page.getByRole('button',{name:'Pengaturan',exact:true}).last().click();
    await page.getByText('Profil belum tersedia.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Simpan perubahan',exact:true}).isDisabled(),true);
    await page.getByText('Profil sosial dan privasi',{exact:true}).click();
    await page.getByText('Pengaturan privasi belum dapat dimuat.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Simpan privasi',exact:true}).isDisabled(),true);
    await page.unroute('**/api/account/profile');
    await page.getByRole('button',{name:'Muat ulang profil',exact:true}).click();
    await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Simpan perubahan')?.disabled);
    await page.unroute('**/api/account/social-profile');
    await page.getByRole('button',{name:'Coba lagi',exact:true}).click();
    await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Simpan privasi')?.disabled);
    // Existing API fixture must survive the failed read and retry.
    assert.equal(await page.getByLabel('Deskripsi diri').inputValue(),'Contoh profil');

    for(const label of ['Nama lengkap','Tanggal lahir','Kota asal']) await page.locator('summary').filter({hasText:new RegExp(`^${label}$`)}).click();
    await page.getByLabel('Nama lengkap',{exact:true}).fill('Pengguna Contoh');
    await page.getByLabel('Tanggal lahir',{exact:true}).fill('2000-01-01');
    await page.getByLabel('Kota asal',{exact:true}).fill('Kota Uji');
    await page.route('**/api/account/profile',route=>route.request().method()==='PATCH'?route.abort():route.continue());
    await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();
    await page.getByText('Profil belum tersimpan.',{exact:true}).waitFor();
    await page.unroute('**/api/account/profile');
    await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();
    await page.getByText('Profil tersimpan.',{exact:true}).waitFor();
    await page.screenshot({path:'/tmp/madevi-qa-profile-tablet.png',animations:'disabled'});
    console.log('Lulus: password dengan spasi, kegagalan dan retry profil/privasi, simpan profil offline lalu pulih.');
  } finally {
    await context.close();
    await db.exec(`UPDATE account SET password='${await hashPassword(env.DEMO_PASSWORD)}' WHERE "userId"=(SELECT id FROM "user" WHERE username='madevi-user')`);
  }

  const beforeHydration=await browser.newContext({javaScriptEnabled:false});
  try {
    const page=await beforeHydration.newPage();
    await page.goto(`${origin}/admin`);
    assert.equal(await page.locator("form").getAttribute("method"),"post");
    assert.equal(await page.getByRole("button",{name:"Masuk",exact:true}).isDisabled(),true);
  } finally {await beforeHydration.close();}

  const admin=await browser.newContext();
  try {
    const page=await admin.newPage();
    await page.goto(`${origin}/admin`);
    await page.locator('input[name="identity"]').fill('Madevi-Admin');
    await page.locator('input[name="password"]').fill(env.DEMO_PASSWORD);
    await page.getByRole('button',{name:'Masuk',exact:true}).click();
    await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
    for(const [label,panel,heading] of [['Pengguna','users','Pengguna'],['Ruang Madevi','content','Buat draf'],['Laporan & Dukungan','reports','Laporan Masalah'],['Notifikasi & Pesan','notifications','Notifikasi & Pesan'],['Database & Pemulihan','system','Database & Pemulihan']]) {
      await page.goto(`${origin}/admin/profile`);
      await page.getByRole('heading',{name:'Profil Admin',exact:true}).waitFor();
      await page.getByRole('button',{name:'Menu admin',exact:true}).click();
      await page.getByRole('dialog',{name:'Menu admin'}).getByRole('button',{name:new RegExp(label)}).click();
      await page.waitForURL(`${origin}/admin?panel=${panel}`);
      await page.getByRole('heading',{name:heading,exact:true}).waitFor();
    }
    await page.getByRole("button",{name:"Cari di panel",exact:true}).click();
    const menu=page.getByRole("dialog",{name:"Menu admin",exact:true});
    await menu.getByRole("searchbox",{name:"Cari menu",exact:true}).fill("explore");
    await menu.getByRole("button",{name:"Explore & Learn",exact:true}).click();
    await page.getByRole("heading",{name:"Explore & Learn",exact:true}).waitFor();
    await page.waitForURL(url=>url.searchParams.get("room")==="explore");
    await page.getByRole("button",{name:"Menu admin",exact:true}).click();
    await page.keyboard.press("Escape");
    await menu.waitFor({state:"hidden"});
    const tested=["rules","pages","settings","media","statistics","security"];
    for(const panel of tested) {
      await page.goto(`${origin}/admin?panel=${panel}`);
      await page.getByRole("heading",{level:1}).waitFor();
      await page.getByText("Memuat data…",{exact:true}).first().waitFor({state:"hidden"});
    }
    await page.goto(`${origin}/admin?panel=invalid`);
    await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
    console.log('Lulus: navigasi dari profil admin menuju seluruh panel dan fallback query tidak valid.');
  } finally {await admin.close();}
}

export async function verifyRegistrationPhoto({ browser, origin, env, mail, image }) {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page = await context.newPage();
  const username = "qa-photo-signup";
  const key = "madevi-pending-profile-photo";
  try {
    await page.goto(origin);
    await page.getByRole("button", { name: "Buka menu" }).click();
    await page.getByRole("button", { name: "Profil", exact: true }).click();
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    await page.getByLabel("Username", { exact: true }).fill(username);
    await page.getByLabel("Email", { exact: true }).fill(`${username}@example.invalid`);
    await page.getByLabel("Kata sandi", { exact: true }).fill(env.DEMO_PASSWORD);
    await page.getByLabel("Konfirmasi kata sandi", { exact: true }).fill(env.DEMO_PASSWORD);
    await page.getByRole("button", { name: "Lanjut", exact: true }).click();
    await page.getByLabel("Nama lengkap", { exact: true }).fill("Pengguna Foto Uji");
    await page.getByLabel("Tanggal lahir", { exact: true }).fill("2000-01-01");
    await page.getByLabel("Kota asal", { exact: true }).fill("Kota Uji");
    await page.locator('input[type="file"]').setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: image });
    const before = mail.length;
    await page.getByRole("button", { name: "Buat akun", exact: true }).click();
    await page.getByText(/Foto akan dikirim setelah masuk di tab ini/).waitFor();
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key) !== null, key), true);
    assert.ok(mail.length > before);
    const message = mail.at(-1).replace(/=\r\n/g, "").replace(/=3D/g, "=");
    const link = message.match(/http:\/\/127\.0\.0\.1:3000\/api\/auth\/verify-email[^\s]*/)?.[0];
    assert.ok(link);
    await page.goto(link);
    await page.getByRole("button", { name: "Buka menu" }).click();
    await page.getByRole("button", { name: "Profil", exact: true }).click();
    await page.locator('input[name="identity"]').fill(username);
    await page.locator('input[name="password"]').fill(env.DEMO_PASSWORD);
    const upload = page.waitForResponse(response =>
      response.url().endsWith("/api/account/avatar") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Masuk", exact: true }).last().click();
    assert.equal((await upload).status(), 200, "registration photo uploads under CSP");
    const avatar = await page.request.get(`${origin}/api/account/avatar`);
    assert.equal(avatar.status(), 200);
    assert.equal(avatar.headers()["content-type"], "image/webp");
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), key), null);
    await page.evaluate(({ key, username }) => sessionStorage.setItem(key, JSON.stringify({
      email: `${username}@example.invalid`, type: "image/png", data: "invalid-stored-photo", created: Date.now(),
    })), { key, username });
    await page.reload();
    await page.getByRole("button", { name: "Buka menu" }).click();
    await page.getByRole("button", { name: "Profil", exact: true }).click();
    await page.getByText(/Foto pendaftaran belum tersimpan/).waitFor();
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), key), null, "corrupt temporary data is discarded");
    console.log("Lulus: foto pendaftaran dengan CSP aktif; data sementara sukses maupun rusak dibersihkan.");
  } finally { await context.close(); }
}

export async function verifyAdminWorkflowUI({browser,origin,adminCookie,userCookie}) {
  const owner=await browser.newContext({viewport:{width:390,height:844}});
  const member=await browser.newContext({viewport:{width:1440,height:900}});
  function cookies(value) {
    return value.split("; ").filter(part=>part.includes("=")).map(token=>{
      const [name,...rest]=token.split("=");return {name,value:rest.join("="),url:origin};
    });
  }
  await owner.addCookies(cookies(adminCookie));await member.addCookies(cookies(userCookie));
  const page=await owner.newPage(),user=await member.newPage();
  async function panel(value) {await page.goto(`${origin}/admin?panel=${value}`);}
  try {
    await panel("media");
    await page.getByLabel("Nama",{exact:true}).fill("Panduan browser");
    await page.locator('input[type="file"]').setInputFiles({name:"catatan.txt",mimeType:"text/plain",buffer:Buffer.from("Dokumen UTF-8 dari browser.")});
    const uploaded=page.waitForResponse(res=>res.url().endsWith("/api/admin/media")&&res.request().method()==="POST");
    await page.getByRole("button",{name:"Unggah berkas",exact:true}).click();
    const result=await uploaded;
    assert.equal(result.status(),201);
    const file=(await result.json()).id;
    await page.getByRole("link",{name:"Panduan browser",exact:true}).waitFor();

    await panel("notifications");
    async function draft(title) {
      await page.getByLabel("Tujuan pesan",{exact:true}).selectOption("all");
      await page.getByLabel("Judul pesan",{exact:true}).fill(title);
      await page.getByLabel("Isi pesan",{exact:true}).fill("Pesan pengujian browser.");
      await page.getByLabel("ID lampiran dari pustaka, opsional").fill(file);
      await page.getByRole("button",{name:"Simpan draf pesan"}).click();
      const row=page.locator("article").filter({has:page.getByRole("heading",{name:title,exact:true})});
      await row.getByRole("button",{name:"Kirim sekarang",exact:true}).waitFor();
      return row;
    }
    const direct=await draft("Kirim browser sekarang");
    await direct.getByRole("button",{name:"Kirim sekarang",exact:true}).click();
    await direct.getByText(/\d+ penerima saat ini/).waitFor();
    await direct.getByRole("link",{name:"Panduan browser",exact:true}).waitFor();
    await direct.getByRole("checkbox",{name:"Konfirmasi penerima, isi dan waktu"}).check();
    await direct.getByRole("button",{name:"Konfirmasi kirim sekarang"}).click();
    await direct.getByText(/^Terkirim ·/).waitFor();
    const later=await draft("Jadwal browser");
    await later.getByRole("button",{name:"Jadwalkan",exact:true}).click();
    const localTime=await page.evaluate(()=>{
      const future=new Date(Date.now()+3600000);
      return new Date(future.getTime()-future.getTimezoneOffset()*60000).toISOString().slice(0,16);
    });
    await later.getByLabel("Waktu pengiriman setempat").fill(localTime);
    await later.getByRole("checkbox",{name:"Konfirmasi penerima, isi dan waktu"}).check();
    await later.getByRole("button",{name:"Konfirmasi jadwal"}).click();
    await later.getByText(/^Menunggu eksekusi ·/).waitFor();
    page.once("dialog",dialog=>dialog.accept());
    await later.getByRole("button",{name:"Batalkan pesan"}).click();
    await later.getByText(/^Dibatalkan ·/).waitFor();

    await panel("settings");
    const before=(await (await page.request.get(origin+"/api/admin/site")).json()).settings;
    await page.getByLabel(/Teks pengumuman/).fill("Pengumuman browser");
    await page.getByRole("button",{name:"Simpan pengaturan"}).click();
    await page.getByText("Perubahan tersimpan.").waitFor();
    await page.getByText("Riwayat versi dan pemulihan",{exact:true}).click();
    await page.getByRole("button",{name:`Bandingkan versi ${before.version}`,exact:true}).click();
    await page.getByRole("region",{name:"Perbandingan versi"}).getByText("Pengumuman browser",{exact:true}).waitFor();
    await page.getByRole("checkbox",{name:"Simpan snapshot lama sebagai versi baru"}).check();
    await page.getByRole("button",{name:"Pulihkan pengaturan"}).click();
    await page.getByText("Snapshot disimpan sebagai versi baru.").waitFor();

    await panel("rules");
    await page.getByLabel("Mode ketersediaan",{exact:true}).selectOption("unavailable");
    await page.getByLabel("Jawaban saat admin tidak tersedia").fill("Admin sedang di luar jadwal pengujian.");
    await page.getByRole("button",{name:"Simpan ketersediaan"}).click();
    await page.getByText("Ketersediaan tersimpan.").waitFor();
    await user.goto(origin+"/dukungan");
    await user.getByLabel("Topik",{exact:true}).fill("Percakapan browser");
    await user.getByLabel("Pertanyaan",{exact:true}).fill("Mohon penjelasan untuk pengujian.");
    await user.getByRole("button",{name:"Buat percakapan"}).click();
    await user.getByText("Admin sedang di luar jadwal pengujian.").waitFor();
    await page.getByRole("button",{name:"Muat ulang percakapan"}).click();
    await page.getByRole("button",{name:"Percakapan browser",exact:true}).click();
    await page.getByLabel("Catatan internal",{exact:true}).fill("Catatan browser yang rahasia.");
    await page.getByRole("button",{name:"Simpan catatan internal"}).click();
    await page.getByText("Catatan browser yang rahasia.",{exact:true}).waitFor();
    await page.getByLabel("Balasan",{exact:true}).fill("Balasan browser kepada pengguna.");
    await page.getByRole("button",{name:"Kirim balasan"}).click();
    await page.getByText("Balasan browser kepada pengguna.",{exact:true}).waitFor();
    await user.getByRole("button",{name:"Muat ulang percakapan"}).click();
    await user.getByText("Balasan browser kepada pengguna.",{exact:true}).waitFor();
    assert.equal(await user.getByText("Catatan browser yang rahasia.",{exact:true}).count(),0);
    await user.getByLabel("Balasan",{exact:true}).fill("Tindak lanjut melalui browser.");
    await user.getByRole("button",{name:"Kirim balasan"}).click();
    await user.getByText("Tindak lanjut melalui browser.",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Muat ulang percakapan"}).click();
    await page.getByText("Tindak lanjut melalui browser.",{exact:true}).waitFor();
    page.once("dialog",dialog=>dialog.accept());
    await page.getByRole("button",{name:"Selesaikan percakapan"}).click();
    await page.getByRole("button",{name:"Buka kembali",exact:true}).waitFor();

    await page.route("**/api/admin/monitoring",route=>route.fulfill({status:503,json:{error:{message:"Monitoring gagal pada pengujian."}}}));
    await panel("statistics");
    await page.getByText("Monitoring gagal pada pengujian.").waitFor();
    await page.unroute("**/api/admin/monitoring");
    await page.getByRole("button",{name:"Muat ulang pengukuran"}).click();
    await page.getByText("Sumbernya respons akhir handler Madevi",{exact:false}).waitFor();
    console.log("UI Chromium lulus: lampiran, kirim langsung, jadwal/batal, riwayat pengaturan, dukungan dua arah dan pemulihan monitoring.");
  } finally{await owner.close();await member.close();}
}
