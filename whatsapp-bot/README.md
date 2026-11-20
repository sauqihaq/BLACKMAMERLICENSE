# BLACKMAMERSTUDIO WhatsApp Business Bot (whatsapp-web.js)

Bot gratis dari library `whatsapp-web.js`. **Tidak berjalan di Vercel Functions.** Jalankan di PC Windows yang tetap menyala atau server Node.js dengan Chromium dan disk persisten. Website Vercel dan Neon tetap berjalan seperti biasa.

## Perbaikan Chromium di Wispbyte (Free)

Jika server gagal karena `Could not find Chrome`, perbarui file `package.json` pada server Wispbyte dengan versi terbaru dari folder ini. Wispbyte menjalankan `npm install` pada startup. Script `postinstall` kini melakukan `npx puppeteer browsers install chrome` agar Chrome yang cocok tersedia dalam cache Puppeteer, lalu server melanjutkan ke `node index.js`. Jangan menjalankan unduhan Chrome dari chat/tautan tidak resmi.

**Batasan:** server Free Wispbyte hanya 512 MB RAM dan 1 GB storage; proses ini bisa gagal karena storage, izin download, atau library Chromium Linux belum tersedia. Jika itu terjadi, pertimbangkan PC lokal atau server dengan resource lebih besar. Jangan scan QR nomor bisnis utama sebelum Chromium lolos pengujian. Browser dan sesi harus disimpan di disk persisten.

## Setup di PC Windows

1. Pasang Node.js 22+ dan Chrome; buka terminal di folder `whatsapp-bot`.
2. Jalankan `npm install` (Chromium Puppeteer dapat diunduh otomatis).
3. Salin `.env.example` menjadi `.env`, lalu atur `ADMIN_WA_NUMBER` memakai **nomor admin kedua**, bukan nomor WhatsApp Business yang akan dipasangkan.
4. Opsional: sediakan gambar QRIS toko secara privat lalu isi `PAYMENT_QR_PATH=C:\\...\\qris.png`. Bot tidak akan mengarang QR jika belum disediakan.
5. Jalankan `npm start`.
6. WhatsApp Business di HP > **Perangkat tertaut** > **Tautkan perangkat**, scan QR di terminal.
7. Sesi tersimpan di `.wwebjs_auth/`. Data order tersimpan di `.bot-data/orders.json` dan tidak di-push ke GitHub.

## Alur pelanggan

- Pelanggan klik **WhatsApp** dari halaman produk `blackmamerlicense.vercel.app`. Pesan order bawaan website dikenali bot.
- Atau pelanggan mengirim `!menu` lalu `!order tripo`.
- Bot meminta `DURASI 7` atau `DURASI 30`, mengambil **harga terkini** dari `/api/store`, lalu menghitung total di bot (harga tidak dipercayai dari teks pelanggan).
- Bot mengirim QRIS jika `PAYMENT_QR_PATH` tersedia. Jika belum, bot mengingatkan admin mengirim metode pembayaran manual.
- Pelanggan kirim bukti JPG/PNG/WebP/PDF (maks. 5 MB). Bot meneruskan bukti ke nomor admin dan menandai status **pending_review**, *tidak langsung menyetujui pembayaran*.

## Alur admin

Dari **nomor ADMIN_WA_NUMBER** yang telah diatur, chat ke nomor WhatsApp Business yang dipasangkan:
- `!orders`: 10 pesanan terbaru.
- `!help`: petunjuk.
- **Periksa mutasi rekening**, jangan mempercayai screenshot sebagai bukti dana masuk.
- Buka website **Admin → Produk & Akses**, pilih produk/durasi/nama yang sesuai, **Terbitkan akses + link install**.
- Salin URL hasilnya lalu kirim pesan `!approve ABCD1234 https://blackmamerlicense.vercel.app/install#token=<64-digit-hex>` (ganti ID dan URL resmi).
- Bot baru kemudian mengirim link tersebut ke pembeli dan menyimpan status selesai.
- Jika bukti tidak sesuai: `!reject ABCD1234`.

**Bot ini tidak memiliki kunci admin Vercel, tidak bisa menerbitkan license sendiri, dan tidak akan menyetujui pembayaran otomatis.** Penerbitan license tetap manual dari website. Order tersimpan lokal, tidak muncul di dashboard Neon pada versi pertama ini.

## Catatan keamanan & batasan

- Library WhatsApp Web ini **tidak resmi**; ada risiko nomor dibatasi WhatsApp. Untuk nomor bisnis utama, uji dengan nomor alternatif terlebih dulu.
- Karena Puppeteer memakai Chromium, penyedia hosting Node.js gratis belum tentu punya RAM, Chromium, atau disk sesi yang diperlukan.
- LocalAuth memerlukan disk **persisten**; jangan taruh auth/screenshot pada GitHub, folder public website, atau storage sementara.
- Pada Linux, contoh bot menjalankan Chromium dengan flag `--no-sandbox`. Gunakan pengguna dan VM terisolasi; lebih baik aktifkan sandbox jika konfigurasi Linux memungkinkan.
- **Mematikan PC berarti bot offline**; website Vercel tidak mati.
- Nomor admin harus berbeda dari nomor bot supaya perintah admin bisa diterima sebagai pesan masuk.
- Manual payment QRIS tidak otomatis memverifikasi mutasi. Pelanggan tidak perlu menyerahkan akses akun bank atau data kartu.


## Diagnosa QR yang gagal terhubung / network timeout

1. Uji login WhatsApp Business ke `web.whatsapp.com` di PC menggunakan jaringan HP yang berbeda. Kalau bisa di PC namun gagal di Wispbyte, kemungkinan masalah di Chromium/network/resource hosting.
2. Jika Wispbyte menampilkan `[WA AUTHENTICATED]` tetapi **tidak** `WhatsApp bot READY`, proses sinkronisasi belum selesai. `[WA STATE]` dan `[WA LOADING]` membantu menunjukkan tahap gagal.
3. Jika QR berulang tanpa `[WA AUTHENTICATED]`, pairing belum berhasil. Jangan paksa scan terus; pastikan QR terbaru dan periksa Linked Devices di HP.
4. Server Wispbyte Free memiliki RAM 512 MB. `[WA WAITING]` hanya menampilkan penggunaan Node.js, **belum termasuk Chromium**; cek penggunaan RAM total di panel. Jika server restart/OOM, timeout lebih panjang tidak akan menyelesaikan batas memori.
5. `authTimeoutMs=120000` dan Puppeteer `protocolTimeout=120000` memperpanjang waktu tunggu agar tersedia kesempatan pada server lambat, tetapi tidak menjamin QR sukses. Jangan hapus `.wwebjs_auth` saat masih ada sesi yang aktif.
6. Karena bot menggunakan API WhatsApp Web tidak resmi, ada risiko pembatasan akun. Uji dengan nomor non-utama dan pastikan kebijakan hosting mengizinkan bot WhatsApp.
