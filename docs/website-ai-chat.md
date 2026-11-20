# BLACKMAMERSTUDIO — Floating Website AI Chat

Widget mengambang ada di sisi kanan bawah homepage, mengikuti tema hitam-merah dan berfungsi di desktop serta ponsel. Ini **bukan bot WhatsApp**; checkout/QRIS/approval dan sesi Baileys tidak berubah.

## Mengaktifkan AI gratis lewat GroqCloud

Default widget memakai **FAQ otomatis** tanpa API key. Untuk chatbot AI sungguhan di free tier (tanpa mengaktifkan billing):

1. Buat akun gratis di https://console.groq.com/ dan tetap di **Free Plan**. Jangan upgrade ke paket Developer atau menambahkan metode pembayaran.
2. Buka https://console.groq.com/keys lalu buat API key baru.
3. Buka **Vercel → BLACKMAMERLICENSE → Settings → Environment Variables**.
4. Simpan key sebagai **Secret** dengan nama `GROQ_API_KEY` dan pilih Production. Jangan letakkan key di source atau chat.
5. Redeploy Production. Website akan memanggil model **openai/gpt-oss-20b** melalui Groq chat completions endpoint di backend.
6. Kode lama `GEMINI_API_KEY` tidak digunakan lagi pada website. Hapus dari Vercel bila tidak diperlukan.

Groq Free Plan punya batas kuota yang bisa berubah. Saat batas tercapai atau API tidak tersedia, frontend tetap menerima jawaban FAQ dan pesan diagnostik. Cek batas akun pada https://console.groq.com/settings/limits dan dokumentasi resmi https://console.groq.com/docs/rate-limits. Situs tetap harus mematuhi kebijakan Vercel terkait penggunaan komersial.

## Keamanan dan batasan

- Key hanya di environment serverless, tidak keluar ke browser. Chat tidak disimpan di database website.
- Widget tidak meminta token install, password, OTP, data bank, atau bukti pembayaran. Token/kunci yang terdeteksi ditolak sebelum diproses AI.
- Request origin harus sesuai domain, input maksimal 900 karakter, riwayat maksimal 8 turn, output model dibatasi, dan pembatasan per-IP in-memory best effort (bukan proteksi DDoS atau rate-limit global).
- AI tidak dapat melihat status order atau memverifikasi transfer dan tidak dapat menerbitkan atau mengubah lisensi. Untuk bantuan pribadi arahkan ke chat admin WhatsApp.
- Jika perlu tingkat kontrol abuse untuk trafik besar, pasang rate-limit persisten/provider protection; limit lokal Vercel tidak dibagi lintas instance.

## Jika tetap fallback setelah Redeploy

Jika tidak ada API key, mode akan mengirim NOT_CONFIGURED. Ketika Groq merespons error, fallback memberikan kode aman: 401 (key ditolak), 403 (izin akses), 404 (model tidak tersedia), 429 (kuota Free Plan), 400 (permintaan salah). Log Vercel hanya mencatat kode HTTP dan model, bukan API key atau isi chat. Jangan mengaktifkan billing untuk mengatasi masalah tanpa memeriksa batas paket gratis.
