# BLACKMAMERSTUDIO — Floating Website AI Chat

Widget mengambang ada di sisi kanan bawah homepage, mengikuti tema hitam-merah dan berfungsi di desktop serta ponsel. Ini **bukan bot WhatsApp**; checkout/QRIS/approval dan sesi Baileys tidak berubah.

## Mengaktifkan AI gratis (Gemini)

Default widget tetap bekerja sebagai **asisten panduan/FAQ** saat belum ada API key. Untuk membuat jawaban bebas dari AI:

1. Buka https://aistudio.google.com/apikey dan buat Gemini API key di **free tier** yang memenuhi syarat. Pastikan project/model memang punya kuota gratis; tanpa billing untuk menghindari pengeluaran.
2. Buka Vercel Dashboard → BLACKMAMERLICENSE → Settings → Environment Variables.
3. Tambahkan nama **GEMINI_API_KEY**, isi API key secara privat. Pilih Production (dan Preview jika dibutuhkan).
4. Klik Redeploy di Vercel. Jangan pernah memasukkan key ke frontend, GitHub, file publik, atau membagikannya di chat.
5. Widget akan memakai Gemini 2.5 Flash-Lite via endpoint server-side /api/ai-chat dengan batas input/output. Jika key belum disetel, kuota habis, atau provider gagal, asisten FAQ otomatis tetap menjawab, dengan label mode yang jelas.

Model dan batas gratis dapat berubah; lihat dokumentasi harga resmi https://ai.google.dev/gemini-api/docs/pricing dan kuota dashboard proyek kamu. Tidak ada jaminan layanan tanpa biaya tanpa memeriksa tier/billing project. Penggunaan komersial website juga harus mengikuti syarat hosting Vercel yang dipakai.

## Keamanan dan batasan

- Key hanya di environment serverless, tidak keluar ke browser. Chat tidak disimpan di database website.
- Widget tidak meminta token install, password, OTP, data bank, atau bukti pembayaran. Token/kunci yang terdeteksi ditolak sebelum diproses AI.
- Request origin harus sesuai domain, input maksimal 900 karakter, riwayat maksimal 8 turn, output model dibatasi, dan pembatasan per-IP in-memory best effort (bukan proteksi DDoS atau rate-limit global).
- AI tidak dapat melihat status order atau memverifikasi transfer dan tidak dapat menerbitkan atau mengubah lisensi. Untuk bantuan pribadi arahkan ke chat admin WhatsApp.
- Jika perlu tingkat kontrol abuse untuk trafik besar, pasang rate-limit persisten/provider protection; limit lokal Vercel tidak dibagi lintas instance.
