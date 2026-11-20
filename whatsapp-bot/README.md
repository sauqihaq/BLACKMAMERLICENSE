# BLACKMAMERSTUDIO WhatsApp Bot — Baileys V2

**Engine sudah diganti ke Baileys 7 (WebSocket).** Tanpa Chromium/Puppeteer, tidak butuh Meta Cloud API berbayar, dan website BLACKMAMERLICENSE tetap berjalan di Vercel + Neon. Penggunaan Baileys tidak resmi dan **dapat menyebabkan pembatasan nomor WhatsApp**.

## Upgrade Wispbyte Free (Node.js 24)

1. Hentikan server di panel Wispbyte.
2. Di File Manager, unggah **index.js, baileys-client.js, baileys-message.js, package.json** terbaru dari folder ini. File core.js dan store.js yang lama tetap dipakai. Jangan unggah seluruh repository.
3. Hapus **node_modules** lama jika Wispbyte belum memperbarui dependency sesuai package.json. Jangan hapus folder order (.bot-data). Folder .wwebjs_auth lama tidak dibutuhkan oleh Baileys, tetapi boleh disimpan sebagai cadangan.
4. Buka file .env lama, biarkan WEBSITE_URL dan ADMIN_WA_NUMBER, lalu tambahkan **BAILEYS_AUTH_DIR=./.baileys_auth**. BOT_SESSION_DIR lama sudah tidak digunakan.
5. Di Konfigurasi → Startup: Docker Node.js 24, JS file index.js; startup bawaan Wispbyte menjalankan npm install dan node index.js. Jika panel memiliki pilihan package list terpisah, kosongkan.
6. Klik Mulai. Perhatikan log [BAILEYS] Connecting dan [WA QR]; scan QR **hanya dari konsol server milikmu** melalui WhatsApp Business → Perangkat Tertaut.
7. Saat berhasil, log menunjukkan **[BLACKMAMERSTUDIO] WhatsApp bot READY**. Uji dengan chat !menu dari nomor lain. Jangan bagikan QR atau isi folder .baileys_auth.

Jika instalasi masih mencoba mengunduh Chrome, berarti package.json di Wispbyte masih versi lama atau node_modules lama belum dibersihkan. Paket V2 tidak memiliki dependency whatsapp-web.js maupun skrip postinstall Puppeteer.

## Alur order

- Chat pelanggan dari tombol WhatsApp website BLACKMAMERLICENSE langsung dikenali. Bisa juga ketik !menu dan !order tripo.
- Bot meminta DURASI 7 / DURASI 30, membaca harga terkini dari endpoint /api/store, lalu menghitung total di sisi bot.
- Bot mengirim gambar QRIS bila PAYMENT_QR_PATH menunjuk file QRIS resmi; kalau tidak, admin diminta mengirim instruksi pembayaran manual.
- Pelanggan kirim bukti JPG/PNG/WebP/PDF maksimal 5 MB; bot meneruskannya ke nomor admin dan menandai pesanan pending_review. Screenshot **bukan bukti dana telah masuk**.
- Admin **wajib mengecek mutasi bank**, membuka Admin Panel → Produk & Akses, menerbitkan link lisensi BMscript sesuai pesanan dan durasi, lalu mengirim !approve ID URL melalui WhatsApp nomor admin ke nomor bisnis. Bot hanya mengirim link yang sudah diterbitkan admin.
- Perintah admin: !orders, !help, !approve ABCD1234 https://blackmamerlicense.vercel.app/install#token=... dan !reject ABCD1234.
- Bot tidak menyimpan bukti gambar secara permanen; ia mengirim ulang bukti ke nomor admin, sementara data order tersimpan di .bot-data/orders.json. Bot tidak mengeluarkan license sendiri.

## Sesi, jaringan dan keterbatasan

- Baileys menggunakan autentikasi multi-file di folder **.baileys_auth**. Kredensial dan kunci pesan bersifat rahasia, jangan dipublikasikan atau dikirim ke chat.
- Wispbyte gratis memiliki **512 MB RAM**, disk 1 GB dan kewajiban login panel berkala; walaupun tanpa Chromium, keberhasilan koneksi tetap belum dijamin.
- Jika status [WA QR] terus berubah, pairing belum selesai. Jika [BAILEYS] reconnect berulang, periksa jaringan server, akses WhatsApp, dan izin provider.
- Nomor admin mungkin muncul sebagai identifier @lid pada WhatsApp terbaru. Bot mencoba menyelesaikan ke nomor telepon melalui metadata resmi Baileys; jika tidak ada mapping yang dipercaya, perintah admin **ditolak** untuk keamanan. Kirim perintah dari chat nomor admin biasa jika terjadi.
- Penggunaan aplikasi WhatsApp Web tidak resmi bisa melanggar ketentuan WhatsApp dan **Wispbyte melarang selfbot**. Konfirmasi izin spesifik Baileys ke support Wispbyte sebelum memakai akun bisnis utama. Jangan lakukan spam/bulk blast.
- Backup folder .baileys_auth dan .bot-data di lokasi privat yang aman; tanpa backup, bila disk server terhapus kamu perlu scan ulang dan bisa kehilangan data order.
- Aplikasi berjalan di Wispbyte, bukan Vercel Functions. Website tetap online ketika bot offline tetapi pemesanan otomatis WhatsApp berhenti.

## PC lokal (opsional untuk pengujian)

Dari folder whatsapp-bot jalankan npm install kemudian npm start di Node.js 22/24. Jika PowerShell menolak npm, gunakan npm.cmd. Tidak perlu memasang Chrome.
