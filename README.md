# TarımTakip

Tarla, hava, çift katmanlı toprak su dengesi, fenoloji, sulama, üretim olayları ve model tabanlı uzaktan algılama göstergelerini birlikte izleyen web uygulaması.

## Tamamen ücretsiz mimari

- Firebase Spark: Authentication, Cloud Firestore, Remote Config ve Hosting
- Fotoğraflar: kullanıcının Google Drive hesabından resmi Picker ile seçilir; yalnız dosya kimliği ve açıklama metadata'sı Firestore'a yazılır
- AI: Firebase Remote Config içindeki `GMINIK` parametresi ve Gemini ücretsiz kotası
- Hava/toprak kaynakları: Open-Meteo, NASA POWER, Earth Search ve SoilGrids
- Piyasa fiyatları: İzmir Büyükşehir Belediyesi anonim açık hal fiyat servisi ve Ticaret Bakanlığı HKS bağlantısı

Cloud Functions, Cloud Storage, Cloud Run ve faturalandırma hesabı gerektiren hiçbir servis kullanılmaz.

