# BLACKMAMERSTUDIO — Tripo3D License Control V12 (FULL VERCEL)

**Satu project Vercel untuk website admin, API aktivasi/validasi, userscript installer, dan activity dashboard.** Database PostgreSQL memakai **Neon melalui Vercel Marketplace** (dikelola dari dashboard Vercel). Cloudflare Workers/D1 tidak lagi diperlukan.

## 1. Isi dan fitur

| Lokasi | Kegunaan |
|---|---|
| `/` | Halaman landing license server |
| `/admin` | Website admin premium hitam/silver; login username + password |
| `/api/health` | Cek status database |
| `/api/install` | **Download Userscript V12 yang URL API-nya otomatis terisi domain Vercel yang sedang dibuka** |
| `/api/license/activate` | Aktivasi pertama, otomatis bind Device ID pengguna |
| `/api/license/validate` | Validasi online (menolak revoked, expired, perangkat berbeda) |
| `/api/admin/summary` | Statistik lisensi, device, pemakaian 24 jam |
| `/api/admin/licenses` | Daftar semua license (dengan pagination) dan generate key |
| `/api/admin/events` | Log pengguna/Device ID/aktivasi/download/convert/validasi ditolak |
| `/api/admin/license-action` | Bind, reset, revoke, restore, perpanjang, rename |
| `/api/admin/export` | Export daftar lisensi ke CSV tanpa mengekspos plaintext key |

**Informasi "siapa yang menggunakan":** nama/username yang diisi pelanggan saat aktivasi, nama pemilik lisensi yang admin tetapkan, Device ID browser, waktu terakhir terlihat, jumlah validasi, log aktivasi, log saat menekan Download dan Convert, serta percobaan key yang ditolak. **Nama ini adalah isian pengguna, bukan identitas yang telah diverifikasi.** Device ID bukan HWID hardware Windows.

## 2. Deploy ke Vercel — langkah singkat

### A. Upload kode ke GitHub

1. Extract ZIP ini ke satu folder.
2. Buat repository GitHub baru (bisa private).
3. Upload **isi folder project**, dengan `package.json`, `vercel.json`, `api/`, `lib/`, dan `public/` di root repository. Jangan upload `.env` atau credential database.
4. Buka Vercel dashboard → **Add New → Project → Import Git Repository**; pilih repository tersebut.
5. Framework Preset pilih **Other** (static frontend + Vercel Functions Node.js). Root Directory `./`; Build Command dan Output Directory **biarkan default/kosong**; lalu Deploy.

### B. Database dari dashboard Vercel

1. Buka project Vercel → **Storage / Marketplace** → integrasi **Neon Postgres** (Vercel native).
2. Buat database, hubungkan ke project. Untuk project baru pilih mode **Create New Neon Account** jika tersedia.
3. Integrasi memasang `DATABASE_URL` ke Environment Variables project. Periksa nilainya ada di environment **Production**.
4. Skema tabel dibuat **otomatis saat API pertama kali dipanggil** (tidak perlu copy SQL ke Neon SQL Editor).

> Catatan penting: Vercel sudah tidak menyediakan produk Postgres lama sebagai layanan tersendiri. Untuk database Postgres baru, Neon dipasang melalui Vercel Marketplace. Artinya proses pengaturan & billing melalui dashboard Vercel, meski database-nya dijalankan Neon.

### C. Tambahkan Environment Variables (Vercel)

Buka **Project → Settings → Environment Variables**, masukkan:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password_rahasia_panjang_minimum_12_karakter
ADMIN_SESSION_SECRET=secret_random_panjang_minimum_32_karakter
```

`DATABASE_URL` sudah dipasang oleh integrasi Neon. Gunakan password dan session secret yang kuat dan berbeda. Contoh membuat secret dengan Node.js di CMD:

```bat
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Jangan tempel real password/secret ke file repository atau ke userscript.** Setelah menambahkan env, klik **Redeploy** di Vercel agar function yang aktif mendapat env terbaru.

### D. Login admin dan buat key

Buka alamat berikut (ganti dengan alamat hasil deploy):

```text
https://nama-project.vercel.app/admin
```

1. Masuk dengan `ADMIN_USERNAME` dan `ADMIN_PASSWORD` dari environment.
2. Klik **Generate License / New License**, isi nama pelanggan, pilih paket Personal/Pro/Studio, masa aktif 7/30/90/365 hari atau Lifetime.
3. Device ID boleh dikosongkan agar key otomatis terikat pada **browser pertama yang aktivasi**. Bisa juga isi Device ID yang diberikan pelanggan untuk pre-bind.
4. Setelah submit, **salin license key sekali itu juga**. Key plaintext hanya dikirim sebagai respons ke admin ketika dibuat; database hanya menyimpan hash SHA-256 dan lima karakter terakhir.
5. Kirim key melalui jalur privat ke pelanggan.

### E. Install Userscript (otomatis terhubung)

Buka URL hasil deploy:

```text
https://nama-project.vercel.app/api/install
```

Download/userscript yang dihasilkan **sudah menggunakan URL Vercel lu**. Install `.user.js` itu ke Tampermonkey. Buka `https://studio.tripo3d.ai/`, isi **Nama pengguna** dan **License Key** lalu Activate.

**Wajib nonaktifkan userscript V10/V11 lama** agar tombol UI tidak dobel dan tidak ada versi yang bisa dipakai tanpa license V12.

Alternatif manual: file `userscript/BlackMamer_Tripo_Licensed_v12.user.js` mengandung `LICENSE_CONFIG.API_BASE_URL = 'https://GANTI-PROJECT.vercel.app'`. Ganti placeholder dengan domain Vercel dan install. Pengunduhan melalui `/api/install` **lebih mudah**.

## 3. Data dan panel pemantauan

- **Overview:** Total license, aktif, devices online 24 jam, jumlah penolakan 24 jam, Recent Users, Live Activity.
- **License Manager:** Cari berdasarkan nama pelanggan, username, key tersamarkan, atau Device ID; filter status; Generate, Revoke/Restore, Reset/Bind Device, perpanjang masa berlaku, Rename pemilik, Export CSV.
- **Activity Logs:** Nama pengguna yang dimasukkan saat aktivasi, pelanggan, Device ID, tanggal/waktu, event dan alasan penolakan. Event meliputi `activated`, `checked`, `download`, `convert`, `rejected`, `issued`, `admin_update`. Log Download/Convert menandakan **fitur dimulai/ditekan**, bukan jaminan file berhasil disimpan.
- **Auto-refresh** setiap 45 detik saat dashboard terbuka.

Admin memakai cookie HTTP-only, SameSite=Strict, verifikasi CSRF, HMAC sesi 8 jam, dan limiter login 8 percobaan / 15 menit per IP. Database tidak menyimpan seluruh license key atau password pengguna.

## 4. Cara kerja Device ID / license

- Device ID `bmdev_...` dibuat acak dan disimpan di storage Tampermonkey per browser. Ini **bukan** fingerprint perangkat keras atau HWID Windows.
- Ketika pengguna pertama kali aktifkan key, backend mengikat Device ID secara **atomik** di database PostgreSQL. Key yang sama dari browser lain otomatis ditolak.
- Download dan konversi lokal membutuhkan validasi server; bila jaringan/API mati, fitur diblokir (fail-closed).
- Admin bisa Revoke, Restore, Bind Device, Reset Device, Set Expiry, dan memantau log penggunaan.
- **Batas keamanan:** orang yang bisa mengubah/menjalankan JavaScript sendiri tetap dapat melewati pembatasan UI pada userscript lokal. Untuk proteksi lebih tinggi, proses yang benar-benar rahasia harus diletakkan di server. Pengguna juga dapat menyalin Device ID atau memberikan nama palsu.

## 5. Biaya dan catatan migrasi

- Vercel Functions + static frontend bisa dimulai pada paket Vercel Hobby, tunduk pada batas/persyaratan paket.
- Neon tersedia dengan paket gratis melalui Vercel Marketplace, tunduk pada kuota dan perubahan kebijakan penyedia; **tidak ada jaminan gratis selamanya atau untuk semua skala**.
- Versi ini menggunakan database Neon baru. **Key lama pada Cloudflare D1 V11 tidak otomatis terbawa.** Jika sudah ada pelanggan yang memakai key lama, diperlukan migrasi data hash key dan status ikatan (atau buat key baru). Tidak ada migrasi D1 otomatis pada paket ini.
- Pastikan penggunaan alat unduh model mematuhi lisensi asset dan aturan platform asal.

## 6. Cek sebelum dipakai

```bat
npm.cmd install
npm.cmd test
npm.cmd run check
```

Pengujian lokal tanpa `DATABASE_URL` hanya memeriksa logika, instalasi userscript, wiring frontend, dan struktur project. Pengujian database dan website hidup membutuhkan deployment Neon/Vercel. Cek `/api/health` mengembalikan `database: "connected"` sesudah konfigurasi.


## Storefront V13 (multi-tool, manual payment)
- `/`: katalog empat produk bergambar, warna navy/cyan mengikuti referensi frontend obfuscator.
- `/admin` → **Store Settings**: atur link Discord, WhatsApp format 62..., catatan pembayaran, harga IDR.
- `/admin` → **License Manager** → New License: pilih tool; admin hanya menerbitkan key setelah pembayaran dibuktikan.
- Tripo V12 client tetap bekerja: permintaan tanpa `tool` otomatis dianggap `tripo`.
- Key baru terikat ke tool tertentu dan pertama kali aktivasi mengikat browser-device ID; ini bukan HWID hardware.
- Integrasi Neon menjalankan `ALTER TABLE ... ADD COLUMN IF NOT EXISTS tool_slug` dan membuat tabel konfigurasi storefront otomatis. Bila awalnya Neon belum terhubung, storefront tampil dengan fallback tanpa kontak sampai disetel di Admin.
- **Tidak ada payment gateway/konfirmasi otomatis**: WhatsApp/Discord hanya sarana order manual. Harga kosong = Tanya Admin. Kontak harus diatur admin sebelum tombol bisa diklik.
- Toolkit Meshy/Sketchfab harus digunakan hanya untuk file sendiri atau aset yang memiliki hak unduh. Sistem ini tidak mencabut paywall atau izin aset pihak ketiga.


### Install licensed client scripts
- /api/install — original Tripo3D V12 client (supports `tool=tripo` implicitly).
- /api/install-tool?tool=meshy — licensed asset workflow for Meshy pages.
- /api/install-tool?tool=sketchfab-textures — local GLB embedded-texture exporter on Sketchfab pages.
- /api/install-tool?tool=sketchfab-model — licensed source-file workflow for Sketchfab pages.
- These V13 kits require online license activation per product; client-side checks are tamperable and do **not** unlock paid platform assets.
- For non-Tripo kits, users can paste a **permitted** HTTPS download link or select a local GLB file to export embedded PNG textures. They are not clones of the earlier viewer-ripping / paywall-bypass scripts.


## V14 — Private delivery & BlackMamer extension

- Admin → Script & Install Links: upload a .user.js file (max 1 MB), choose a paid license, and set an exact link expiry date/time. Links are single-browser claims. Retries with the same installation proof are idempotent.
- Newly uploaded source is AES-256-GCM encrypted in Neon, not saved to public files or this repository. Source snapshots are immutable; existing links keep their selected version. Never commit private customer scripts.
- Link tokens are random 256-bit bearer tokens. Only SHA-256 hashes are stored. Links use URL fragments, no-referrer, and POST requests. Full URLs are shown once to admin. Reissue a new link if lost; revoke old links explicitly.
- Redeeming atomically binds the license and link to one extension browser identity. A redeemed session follows the license expiry, not the original link expiry. Revoking the link or license invalidates that session. Reset Device invalidates the old session until re-bound; revoke old claimed links before transferring to a different owner.
- `/install` checks extension availability and opens an extension confirmation page. The website receives status only; the extension fetches and installs code after user confirmation.
- Purchased scripts do not have editor/source/export controls. Personal scripts retain editing/import/export. Client code still exists on the buyer's machine; this does not provide impossible-to-extract code or hardware-backed DRM. Previously public scripts and Git history cannot be made secret retroactively.
- The legacy public installers remain for existing key-based customers. New private uploads never use those routes. `Use existing template` copies the existing already-public kit into private delivery, with automatic license session setup in the extension.

### Deployment settings

Existing DATABASE_URL and admin environment variables remain required. New tables are created additively. Prefer a separate long random `SCRIPT_ENCRYPTION_KEY` (32+ characters). If absent, ADMIN_SESSION_SECRET is used; changing the active encryption/signing secret invalidates sessions and makes old encrypted script snapshots unreadable. Preserve the key securely.

The Chrome desktop installation page at /extension serves the release ZIP from public/downloads/BlackMamer-v4.zip and explains how to load the extracted folder. PUBLIC_BASE_URL configures the origin used by legacy script templates.

Payment confirmation remains manual, as in the current store. After payment, issue the license and an install link from admin; sending script files is no longer necessary. Full payment automation would require a chosen payment gateway and verified payment webhooks.

### Verification

Run `npm ci` and `npm test` using Node 22.3 or later (module-mocking support). The suite includes an in-memory PostgreSQL engine for encrypted uploads, snapshot versions, claim retries, expiry, license/device revocation and admin authentication. Its single database connection cannot reproduce all multi-connection production races; first-use device binding remains a conditional SQL update under a row lock.

Local Chrome integration was also checked with a separate test extension copy and test database: authenticated admin upload, user-selected expiry, link generation, website detection, explicit installation confirmation, licensed/personal script execution, editor/export separation and denial after revocation. This is local validation, not evidence of a production deployment or Web Store approval.

## V16: WhatsApp checkout / per token prices
- Checkout opens a native `https://wa.me/<phone>?text=<message>` link from the button. Configure the number in Admin → Store Settings.
- Admin accepts `https://wa.me/628...`, `628...`, `+628...` and Indonesian `08...` and saves digits-only international format.
- A numeric product price is displayed as `Rp XX.XXX / token` in the catalog, modal and order message. This is only a display unit, not an automated token balance.


## V20: satu alur produk → upload → akses otomatis
- Buka **Produk & Akses** di admin. Pilih satu produk dari katalog website atau **Tambah produk baru**, isi nama/slug/deskripsi/pilihan gambar, lalu upload source `.user.js` secara manual.
- **Tidak ada lagi tombol template default** untuk membuat link pelanggan baru. Script arsip lama tetap disimpan tetapi tidak dipakai otomatis. Upload ulang script milik sendiri agar ditandai `uploaded`.
- Setelah pembayaran manual dikonfirmasi, pilih produk yang sama, nama pelanggan, paket, durasi (7/30/90/365 hari atau Lifetime), dan batas waktu link; klik **Terbitkan akses + link install**.
- Satu operasi database menghasilkan satu lisensi dan satu link install untuk produk yang sama. Pelanggan cukup mengunjungi `/install#token=...`, memasang BlackMamer Extension, dan mengonfirmasi instalasi. Pelanggan tidak perlu mengetik key hasil generate.
- **License Manager** kini untuk monitoring, reset device, perpanjangan, ekspor, dan revoke akses yang telah dibuat.
- Source Tripo lama dengan pola gate `bm_tripo_license_key_v1` yang dikenali diadaptasi pada saat delivery agar memakai session otomatis yang diterbitkan server. Script custom yang memiliki mekanisme login tambahan di dalam source perlu dibersihkan secara manual sebelum upload; sistem tidak otomatis membongkar atau menonaktifkan proteksi eksternal yang tidak dikenal.
- Katalog produk dan harga harian disimpan di Neon PostgreSQL. Kartu website menampilkan **Rp / day**, bukan **Rp / token**. Produk lama tetap ada, produk baru bisa ditambahkan dan dijual sesuai izin penggunaan aset.


## V21 — promo diskon produk (harga harian)
- Dari **Admin → Store Settings**, untuk setiap produk kamu dapat menetapkan harga asli Rp/day, diskon 0–90%, dan tanggal akhir promo (opsional).
- Diskon 0 menonaktifkan promo. Persentase aktif menghitung harga promo dari harga asli di server. Contoh: harga normal Rp50.000/day dan diskon 20% → Rp40.000/day.
- Kartu katalog menampilkan badge PROMO -20%, harga normal tercoret, serta harga promo. Popup pembelian dan pesan WhatsApp memakai harga promo aktif yang sama.
- Jika tanggal promo berakhir, penghitungan API langsung mengembalikan harga asli dan menyembunyikan label promo; tidak ada hitungan mundur palsu.
- Pengaturan tersimpan di Neon pada kolom `bm_products.discount_percent` dan `discount_until`; perubahan bersifat aman terhadap data license yang sudah ada dan tidak memerlukan update extension.
- Harga promo merupakan penawaran manual: pembeli tetap perlu menghubungi admin via WhatsApp/Discord dan admin harus memverifikasi pembayaran sebelum menerbitkan akses.
