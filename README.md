# WhatsApp Bot - Tag All Members

Bot WhatsApp untuk tag semua member di grup dengan command sederhana. Bot ini bisa dipasang di banyak nomor WhatsApp secara bersamaan.

## 🚀 Fitur

- ✅ Tag all members di grup dengan satu command
- ✅ **Whitelist-based access** - Hanya nomor yang terdaftar di whitelist yang bisa pakai command
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

## ⚙️ Konfigurasi Whitelist

Edit file `config.js` untuk menambahkan nomor yang diizinkan menggunakan bot:

```javascript
const ALLOWED_NUMBERS = [
    '6282232018289',  // Nomor owner
    '628123456789',   // Nomor lain yang diizinkan
    // Tambahkan nomor lain di sini
];
```

**Format nomor:**
- Gunakan format internasional tanpa `+`
- Contoh: `6282232018289` (Indonesia)
- Jangan gunakan spasi atau tanda hubung

## 📱 Cara Menggunakan

### Commands yang tersedia:

> **⚠️ PENTING**: Hanya nomor WhatsApp yang terdaftar di whitelist (`config.js`) yang bisa menggunakan command ini. Member lain di grup akan diabaikan.

| Command | Deskripsi | Contoh |
|---------|-----------|--------|
| `!tagall [pesan]` | Tag semua member | `!tagall Meeting penting!` |
| `!everyone [pesan]` | Alias untuk tagall | `!everyone Jangan lupa bayar iuran` |
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

3. **Cek info bot:**
   ```
   !info
   ```

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
