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
