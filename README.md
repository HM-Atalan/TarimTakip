# TarımTakip

Tarla, hava, çift katmanlı toprak su dengesi, fenoloji, sulama, üretim olayları ve model tabanlı uzaktan algılama göstergelerini birlikte izleyen web uygulaması.

## Tamamen ücretsiz mimari

- Firebase Spark: Authentication, Cloud Firestore, Remote Config ve Hosting
- Fotoğraflar: cihazdaki IndexedDB; Firebase Storage kullanılmaz
- AI: Firebase Remote Config içindeki `GMINIK` parametresi ve Gemini ücretsiz kotası
- Hava/toprak kaynakları: Open-Meteo, NASA POWER, Earth Search ve SoilGrids

Cloud Functions, Cloud Storage, Cloud Run ve faturalandırma hesabı gerektiren hiçbir servis kullanılmaz.

## Yerel çalıştırma

Node.js 20 veya üzeriyle:

```bash
npm start
```

Ardından `http://127.0.0.1:8765/` adresini açın.

## Doğrulama

```bash
npm run verify
```

## Veri notları

Tarla ve olay metadata'sı Firestore ile cihazlar arasında eşitlenir. Fotoğraflar ücretsiz kalmak için yalnızca eklendikleri cihazda tutulur. Ayarlar → JSON Dışa Aktar işlemi fotoğrafları da yedeğe ekler; diğer cihazda JSON İçe Aktar ile geri yüklenebilir.

AI çıktıları ekranda gösterilmeden önce güvenli biçimde kaçırılır. `GMINIK` Remote Config yaklaşımı ilk sürümle uyumludur fakat istemci tarafında kullanılan bir anahtarı tamamen gizlemez; anahtarın yalnız Gemini API ile sınırlandırılması ve kullanım kotasının izlenmesi önerilir.

Yayınlama adımları için [DEPLOYMENT.md](DEPLOYMENT.md) dosyasına bakın.
