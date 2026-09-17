/* =======================================================================
   Move Adventure — penyimpan luring
   Menyimpan aplikasi di perangkat agar tetap terbuka tanpa internet.
   Naikkan angka VERSI setiap kali index.html diperbarui.
   ======================================================================= */
const VERSI = "move-adventure-v4";
const INTI = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

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

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);

  /* Jangan pernah menyimpan lalu lintas server nilai, materi, gambar, dan bukti.
     Data itu harus selalu diambil segar dari Apps Script. */
  if(url.hostname.endsWith("script.google.com") ||
     url.hostname.endsWith("googleusercontent.com") ||
     url.pathname.endsWith("/exec")) return;

  /* Halaman aplikasi: pakai simpanan lebih dulu agar terbuka seketika dan
     tetap jalan tanpa sinyal, lalu perbarui diam-diam di latar belakang. */
  if(req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html")){
    e.respondWith((async ()=>{
      const c = await caches.open(VERSI);
      const simpan = await c.match("./index.html") || await c.match("./");
      const jaringan = fetch(req).then(r=>{
        if(r && r.ok) c.put("./index.html", r.clone());
        return r;
      }).catch(()=> null);
      return simpan || (await jaringan) || new Response(
        "<meta charset=utf-8><p style='font-family:sans-serif;padding:24px'>Aplikasi belum tersimpan di perangkat ini. Sambungkan internet sebentar lalu buka kembali.</p>",
        {headers:{"Content-Type":"text/html; charset=utf-8"}});
    })());
    return;
  }

  /* Berkas pendukung seperti ikon dan huruf: ambil dari simpanan bila ada. */
  e.respondWith((async ()=>{
    const c = await caches.open(VERSI);
    const simpan = await c.match(req);
    if(simpan) return simpan;
    try{
      const r = await fetch(req);
      if(r && (r.ok || r.type === "opaque")) c.put(req, r.clone());
      return r;
    }catch(err){
      return simpan || Response.error();
    }
  })());
});
