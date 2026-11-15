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

  const admin=await browser.newContext();
  try {
    const page=await admin.newPage();
    await page.goto(`${origin}/admin`);
    await page.locator('input[name="identity"]').fill('Madevi-Admin');
    await page.locator('input[name="password"]').fill(env.DEMO_PASSWORD);
    await page.getByRole('button',{name:'Masuk',exact:true}).click();
    await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
    for(const [label,panel,heading] of [['Pengguna','users','Pengguna'],['Konten','content','Buat draf'],['Laporan Masalah','reports','Laporan Masalah'],['Notifikasi','notifications','Notifikasi dan pesan'],['Sistem','system','Sistem dan pemulihan']]) {
      await page.goto(`${origin}/admin/profile`);
      await page.getByRole('heading',{name:'Profil Admin',exact:true}).waitFor();
      await page.getByRole('button',{name:'Menu admin',exact:true}).click();
      await page.getByRole('dialog',{name:'Menu admin'}).getByRole('button',{name:new RegExp(label)}).click();
      await page.waitForURL(`${origin}/admin?panel=${panel}`);
      await page.getByRole('heading',{name:heading,exact:true}).waitFor();
    }
    await page.goto(`${origin}/admin?panel=invalid`);
    await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
    console.log('Lulus: navigasi dari profil admin menuju seluruh panel dan fallback query tidak valid.');
  } finally {await admin.close();}
}
