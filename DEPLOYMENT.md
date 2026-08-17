# Spark planıyla ücretsiz yayınlama

## Firebase Console

1. Authentication bölümünde Google ve/veya E-posta/Şifre girişini etkinleştirin.
2. Cloud Firestore veritabanını oluşturun.
3. Remote Config içinde `GMINIK` adlı parametreyi oluşturup mevcut Gemini API anahtarınızı girin ve değişiklikleri yayınlayın.
4. Google girişini kullanıyorsanız canlı alan adını Authentication → Authorized domains listesine ekleyin.

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

## Fotoğraflar

Firebase Storage Spark planında kullanılamadığı için fotoğraflar tarayıcı IndexedDB'sinde saklanır. Başka bir cihaza geçmeden veya tarayıcı verilerini temizlemeden önce Ayarlar → JSON Dışa Aktar ile yedek alın. Dışa aktarılan JSON fotoğrafları da içerir.

## Yayın sonrası kontrol

- Kayıt olma ve giriş
- Tarla ve olayların iki cihaz arasında eşitlenmesi
- Fotoğraf ekleme, sayfayı yenileme ve fotoğrafın aynı cihazda görünmesi
- Fotoğraflı JSON dışa/içe aktarma
- Remote Config `GMINIK` üzerinden AI analizi
- Başka UID ile Firestore erişiminin reddedilmesi
