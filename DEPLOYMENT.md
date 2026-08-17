# Spark planıyla ücretsiz yayınlama

## Firebase Console

1. Authentication bölümünde Google ve/veya E-posta/Şifre girişini etkinleştirin.
2. Cloud Firestore veritabanını oluşturun.
3. Remote Config içinde `GMINIK` adlı parametreyi oluşturup mevcut Gemini API anahtarınızı girin ve değişiklikleri yayınlayın.
4. Google girişini kullanıyorsanız canlı alan adını Authentication → Authorized domains listesine ekleyin.

## Google Drive Picker

1. Google Cloud Console'da aynı proje için Google Picker API ve Google Drive API'yi etkinleştirin.
2. Web application türünde OAuth 2.0 Client ID oluşturun; canlı site adresini Authorized JavaScript origins listesine ekleyin.
3. Bir API key oluşturup HTTP referrer olarak yalnız canlı alan adınızı, API kısıtı olarak Google Picker API'yi seçin.
4. Firebase Remote Config'e şu parametreleri ekleyip yayınlayın:
   - `GDRIVE_CLIENT_ID`: Web OAuth istemci kimliği
   - `GDRIVE_API_KEY`: Kısıtlanmış Picker API anahtarı
   - `GDRIVE_APP_ID`: Google Cloud proje numarası

Uygulama `drive.file` yetkisini kullanır; kullanıcı yalnız kendi seçtiği dosyalara erişim verir. Fotoğraf dosyası Firestore'a veya cihaz depolamasına kopyalanmaz.

`GMINIK` akışı ilk sürümdeki davranışı korur. Remote Config değerleri tarayıcı tarafından alınabildiği için bu yöntem gerçek bir secret kasası değildir. Anahtarı Gemini API ile sınırlandırın, ücretsiz kota değerlerini düşük tutun ve kullanım ekranını düzenli kontrol edin.

## Doğrulama ve yayın

```bash
firebase login
npm run verify
firebase deploy --only firestore:rules,hosting
```

Bu komut yalnız Spark planında kullanılabilen Firestore Rules ve Hosting'i dağıtır. Functions veya Storage dağıtımı yapmaz ve Blaze planı istemez.

## GitHub'a gönderme

Klasör henüz bir Git deposu değilse:

```bash
git init
git add .
git commit -m "Spark plan compatible production release"
git branch -M main
git remote add origin GITHUB_REPO_ADRESI
git push -u origin main
```

## Yayın sonrası kontrol

- Kayıt olma ve giriş
- Tarla ve olayların iki cihaz arasında eşitlenmesi
- Google Drive bağlantısı, fotoğraf seçme ve yeniden yetkilendirme
- Ana sayfada kayıtlı ürüne göre hal fiyatı ve ürün yokken popüler ürün görünümü
- Remote Config `GMINIK` üzerinden AI analizi
- Başka UID ile Firestore erişiminin reddedilmesi
