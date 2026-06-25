# WhatsApp Bot - Tag All Members

Bot WhatsApp untuk tag semua member di grup dengan command sederhana. Bot ini bisa dipasang di banyak nomor WhatsApp secara bersamaan.

## 🚀 Fitur

- ✅ Tag all members di grup dengan satu command
- ✅ Tag beberapa member tertentu dengan nomor telepon
- ✅ **Semua member grup bisa menggunakan bot**
- ✅ Multi-device support (bisa dipasang di banyak nomor)
- ✅ Auto-reconnect jika terputus
- ✅ QR Code authentication
- ✅ Lightweight dan mudah di-deploy

## 📋 Prerequisites

- Node.js v16 atau lebih baru
- NPM atau Yarn
- Nomor WhatsApp yang akan digunakan untuk bot

## 🔧 Instalasi

1. **Install dependencies:**
```bash
npm install
```

2. **Jalankan bot:**
```bash
npm start
```

3. **Scan QR Code:**
   - QR code akan muncul di terminal
   - Buka WhatsApp di HP → Settings → Linked Devices → Link a Device
   - Scan QR code yang muncul

4. **Bot siap digunakan!**

## 📱 Cara Menggunakan

### Commands yang tersedia:

| Command | Deskripsi | Contoh |
|---------|-----------|--------|
| `!tagall [pesan]` | Tag semua member | `!tagall Meeting penting!` |
| `!everyone [pesan]` | Alias untuk tagall | `!everyone Jangan lupa bayar iuran` |
| `!tag` | Tag member tertentu (tulis nomor per baris) | Lihat contoh di bawah |
| `!autoleave` | Cek jadwal bot keluar otomatis dari grup | `!autoleave` |
| `!info` | Info tentang bot | `!info` |

### Contoh Penggunaan:

1. **Tag all dengan pesan custom:**
   ```
   !tagall Halo semua, meeting jam 3 sore!
   ```

2. **Tag all tanpa pesan:**
   ```
   !tagall
   ```

3. **Tag member tertentu (inline dengan pesan):**
   ```
   !tag 082232018289 085161885170 jangan lupa meeting jam 3
   ```

4. **Tag member tertentu (multi-line):**
   ```
   !tag
   087800073210
   085161885170
   082232018289
   ```
   
   Bot akan mencari nomor-nomor tersebut di grup dan tag mereka.

5. **Cek info bot:**
   ```
   !info
   ```

## 📊 Google Sheet Tracking

Bot bisa append grup yang baru pertama kali tercatat ke Google Sheet melalui Apps Script Web App.

1. Buka spreadsheet target, lalu Apps Script.
2. Copy isi `google-apps-script-all-track.js` ke Apps Script.
3. Ganti `WEBHOOK_SECRET`.
4. Deploy sebagai Web App dengan akses yang sesuai.
5. Set environment variable sebelum menjalankan bot:

```bash
export GOOGLE_SHEET_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"
export GOOGLE_SHEET_WEBHOOK_SECRET="secret-yang-sama"
npm start
```

Data akan masuk ke sheet bernama `All Track`.

## 🔄 Multi-Nomor Setup

### Opsi 1: Manual (Multiple Terminal)

```bash
# Terminal 1 - Bot untuk nomor pertama
npm start nomor1

# Terminal 2 - Bot untuk nomor kedua
npm start nomor2

# Terminal 3 - Bot untuk nomor ketiga
npm start nomor3
```

### Opsi 2: PM2 (Recommended)

1. **Install PM2:**
```bash
npm install -g pm2
```

2. **Edit `ecosystem.config.js`** sesuai kebutuhan

3. **Jalankan semua bot:**
```bash
# Start all bots
pm2 start ecosystem.config.js

# View logs
pm2 logs

# View status
pm2 status

# Stop all
pm2 stop all

# Restart all
pm2 restart all
```

## 📁 Struktur Project

```
whatsapp-bot-tagall/
├── src/
│   ├── bot.js           # Main bot logic
│   ├── commands.js      # Command handlers
│   └── utils.js         # Helper functions
├── sessions/            # Session data (auto-generated)
├── index.js             # Entry point
├── package.json
├── ecosystem.config.js  # PM2 config
└── .gitignore
```

## 🛠️ Troubleshooting

### QR Code tidak muncul
- Pastikan terminal mendukung QR code
- Coba terminal lain (iTerm2, Windows Terminal, dll)

### Bot terputus terus-menerus
- Periksa koneksi internet
- Pastikan nomor tidak digunakan di device lain
- Cek log error untuk detail

### Tag all tidak bekerja
- Pastikan bot adalah admin grup (untuk beberapa kasus)
- Cek apakah bot punya permission di grup
- Verifikasi command ditulis dengan benar

### Session expired
Hapus folder session dan scan QR lagi:
```bash
rm -rf sessions/nomor1
npm start nomor1
```

## 📚 Dokumentasi Lengkap

Untuk dokumentasi lengkap dengan flow diagram dan deployment guide, lihat file dokumentasi di folder `brain/`.

## 🔒 Security

- ⚠️ Jangan commit folder `sessions/` ke Git
- ⚠️ Backup session data secara berkala
- ⚠️ Gunakan `.gitignore` untuk exclude sensitive data

## 📝 License

ISC

## 🤝 Contributing

Pull requests are welcome!

---

**Dibuat dengan ❤️ untuk memudahkan management grup WhatsApp**
