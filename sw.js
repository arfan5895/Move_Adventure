/* =======================================================================
   Move Adventure — penyimpan luring dengan pembaruan otomatis

   Cara kerjanya:
   - Halaman aplikasi selalu diambil dari internet lebih dulu. Begitu guru
     mengunggah berkas baru ke GitHub, perangkat siswa langsung memakainya
     pada bukaan berikutnya tanpa perlu menghapus apa pun.
   - Bila internet mati atau lambat, halaman diambil dari simpanan di
     perangkat, sehingga aplikasi tetap bisa dipakai di rumah tanpa sinyal.
   - Angka VERSI tidak perlu dinaikkan lagi setiap kali memperbarui isi
     aplikasi. Naikkan hanya bila berkas sw.js ini sendiri yang diubah.
   ======================================================================= */
const VERSI = "move-adventure-v3";
const INTI = ["./", "./index.html", "./manifest.webmanifest",
              "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

/* Berapa lama menunggu jaringan sebelum beralih ke simpanan (milidetik).
   Cukup singkat supaya aplikasi tetap terasa cepat pada sinyal buruk. */
const BATAS_TUNGGU = 3500;

self.addEventListener("install", e=>{
  e.waitUntil((async ()=>{
    const c = await caches.open(VERSI);
    // satu berkas yang gagal tidak boleh menggagalkan seluruh pemasangan
    await Promise.all(INTI.map(u=> c.add(u).catch(()=>{})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e=>{
  e.waitUntil((async ()=>{
    const nama = await caches.keys();
    await Promise.all(nama.filter(n=>n !== VERSI).map(n=>caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Memungkinkan halaman meminta pembaruan segera dipakai. */
self.addEventListener("message", e=>{
  if(e.data === "pakai-sekarang") self.skipWaiting();
});

function ambilJaringan(req, batas){
  /* cache:"reload" memaksa permintaan melewati simpanan bawaan browser,
     yang pada GitHub Pages bisa menahan berkas lama sampai sepuluh menit. */
  const permintaan = new Request(req.url, {cache:"reload", credentials:"same-origin"});
  return new Promise((selesai, gagal)=>{
    const jam = setTimeout(()=> gagal(new Error("lambat")), batas);
    fetch(permintaan).then(r=>{ clearTimeout(jam); selesai(r); },
                           e=>{ clearTimeout(jam); gagal(e); });
  });
}

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);

  /* Jangan pernah menyimpan lalu lintas server nilai, materi, gambar, dan
     bukti. Data itu harus selalu diambil segar dari Apps Script. */
  if(url.hostname.endsWith("script.google.com") ||
     url.hostname.endsWith("googleusercontent.com") ||
     url.pathname.endsWith("/exec")) return;

  const halaman = req.mode === "navigate" ||
                  url.pathname.endsWith("/") ||
                  url.pathname.endsWith("index.html");

  /* ---- Halaman aplikasi: jaringan dulu, simpanan sebagai cadangan ---- */
  if(halaman){
    e.respondWith((async ()=>{
      const c = await caches.open(VERSI);
      try{
        const r = await ambilJaringan(req, BATAS_TUNGGU);
        if(r && r.ok) c.put("./index.html", r.clone());
        return r;
      }catch(err){
        const simpan = await c.match("./index.html") || await c.match("./");
        return simpan || new Response(
          "<meta charset=utf-8><p style='font-family:sans-serif;padding:24px'>" +
          "Aplikasi belum tersimpan di perangkat ini. Sambungkan internet sebentar lalu buka kembali.</p>",
          {headers:{"Content-Type":"text/html; charset=utf-8"}});
      }
    })());
    return;
  }

  /* ---- Berkas pendukung: pakai simpanan lebih dulu agar ringan,
          lalu perbarui diam-diam di latar belakang. ---- */
  e.respondWith((async ()=>{
    const c = await caches.open(VERSI);
    const simpan = await c.match(req);
    const jaringan = fetch(req).then(r=>{
      if(r && (r.ok || r.type === "opaque")) c.put(req, r.clone());
      return r;
    }).catch(()=> null);
    return simpan || (await jaringan) || Response.error();
  })());
});
