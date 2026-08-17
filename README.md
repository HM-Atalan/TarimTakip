# TarımTakip

Tarla, hava, çift katmanlı toprak su dengesi, fenoloji, sulama, üretim olayları ve model tabanlı uzaktan algılama göstergelerini birlikte izleyen web uygulaması.

## Tamamen ücretsiz mimari

- Firebase Spark: Authentication, Cloud Firestore, Remote Config ve Hosting
- Fotoğraflar: kullanıcının Google Drive hesabından resmi Picker ile seçilir; yalnız dosya kimliği ve açıklama metadata'sı Firestore'a yazılır
- AI: Firebase Remote Config içindeki `GMINIK` parametresi ve Gemini ücretsiz kotası
- Hava/toprak kaynakları: Open-Meteo, NASA POWER, Earth Search ve SoilGrids
- Piyasa fiyatları: İzmir Büyükşehir Belediyesi anonim açık hal fiyat servisi ve Ticaret Bakanlığı HKS bağlantısı

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

## Çevrimiçi çalışma ve veri notları

Uygulama yalnız çevrimiçi çalışır; service worker, PWA önbelleği ve yerel mod bulunmaz. Tarla ve olay metadata'sı Firestore ile cihazlar arasında eşitlenir. Fotoğraf dosyaları TarımTakip'e yüklenmez ve cihaz depolamasında tutulmaz. Drive dosyasını görüntülemek için kullanıcı Google hesabıyla izin verir.

AI çıktıları ekranda gösterilmeden önce güvenli biçimde kaçırılır. `GMINIK` Remote Config yaklaşımı ilk sürümle uyumludur fakat istemci tarafında kullanılan bir anahtarı tamamen gizlemez; anahtarın yalnız Gemini API ile sınırlandırılması ve kullanım kotasının izlenmesi önerilir.

Yayınlama adımları için [DEPLOYMENT.md](DEPLOYMENT.md) dosyasına bakın.
