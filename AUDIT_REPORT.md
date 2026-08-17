# TarımTakip FAZ 6–14 Audit ve Düzeltme Raporu

Tarih: 17 Ağustos 2026

## Doğrulama

GitHub'a yüklemeden önce proje kökünde:

```bash
npm run verify
```

Bu komut bütün üretim JavaScript dosyalarının sözdizimini ve kalıcı regresyon paketini çalıştırır.

## Tamamlanan düzeltmeler

- FAZ 6: `Dr_s`, `Dr_d`, `surplus_s`, `surplus_d` state contract normal simülasyon, existing ledger ve repair boyunca korunuyor. Eski ledger surplus alanları yoksa güvenli biçimde sıfır kabul ediliyor.
- FAZ 7: Open-Meteo FAO-56 Penman–Monteith ET0 birincil kaynak. Gerçek sıfır ET0 korunuyor; yalnız eksik veride FAO-56 Eq. 52 Hargreaves fallback kullanılıyor ve kaynak ledger'a yazılıyor.
- FAZ 8: Toprak, kök dağılımı ve bütün ürün parametreleri yapısal invariant testlerinden geçiyor. Üç ve dört noktalı Kc tabloları sürekli biçimde yorumlanıyor.
- FAZ 9: Hava geçmişi 366 güne çıkarıldı. GDD tarih sınırları, duplicate günler, bozuk sıcaklıklar ve üst/alt eşikler için dayanıklı hale getirildi.
- FAZ 10: Open-Meteo toprak nemi ile Sentinel-2 metadata'sı ayrıştırıldı. Bant hesabı yapılmayan sentetik NDVI/EVI/NDWI artık “gerçek uydu” diye sunulmuyor.
- FAZ 11: Sulama önerisi toplam kök bölgesi depletion/RAW/Ks üzerinden hesaplanıyor. Tahminde etkili yağış ve Kc-adjusted ET kullanılıyor. Büyük kullanıcı girdileri uyarılıyor fakat sessizce kırpılmıyor.
- FAZ 12: Yerel HTTP üzerinden gerçek tarayıcı yüklemesi doğrulandı; sayfa, üretim scriptleri ve ana kimlik ekranı açıldı.
- FAZ 13: Kritik kullanıcı girdisi yüzeylerine HTML escaping, CSS renk doğrulaması, güvenli profil URL doğrulaması ve inline kullanıcı-ID handler kaldırması uygulandı. Beklenen Remote Config ağ kesintisi fatal hata olarak raporlanmıyor.
- FAZ 14: State, mass balance, extreme irrigation/rain, mixed event, drought, repair, bootstrap, satellite anchor, invalidation, ET0, parametre, Kc, GDD, sulama ve güvenlik regresyonları kalıcı test paketine alındı.
- Genel sayfasındaki “Nem Modelini Resetle” işlemi, kayıtlı tüm tarlaların yalnız türetilmiş RZWB ledger/cache verisini temizler; tarla ve olay kayıtlarını korur, hava geçmişini hazırlar ve nem modelini sıfırdan yeniden hesaplar.

## Bilimsel varsayımlar ve açık riskler

- Etkili yağış katsayıları ve `PERC_COEFF` değerleri yerel kalibrasyon verisi olmadan mevcut proje varsayımları olarak korunmuştur.
- Hargreaves günlük fallback bir tahmindir; FAO-56, yerel Penman–Monteith istasyon verisiyle kalibrasyon önerir.
- Ürün Kc/GDD tabloları yapısal olarak doğrulanmıştır; çeşit, bölge, ekim tarihi ve yönetim bazında saha kalibrasyonu hâlâ gereklidir.
- Çok yıllık bitkilerde gerçek fenolojik başlangıç (ör. tomurcuk uyanması) tutulmadığı için `plantDate` temelli GDD sınırlıdır.
- Open-Meteo toprak nemi bir hava modeli çıktısıdır; doğrudan tarla sensörü veya uydu bant ölçümü değildir.
- Sulama önerisi net mm verir; sistem/uygulama randımanı için güvenilir tarla parametresi bulunmadığından brütleme yapılmaz.
- Firebase güvenlik kuralları arşive eklenmiştir; canlı projede dağıtıldıkları ayrıca Firebase Console üzerinden doğrulanmalıdır.

## 18 Ağustos 2026 Spark uyumluluk ve güvenlik güncellemesi

- Kullanıcının tercihi doğrultusunda Gemini AI, ilk sürümde olduğu gibi Remote Config `GMINIK` parametresinden anahtar alır. Bu değer istemci tarafından görülebileceğinden gerçek bir sunucu sırrı değildir; anahtar kısıtları ve kota takibi gerektirir.
- AI yanıtları güvenli HTML dönüşümü öncesinde tamamen kaçırılıyor.
- UID izolasyonlu, varsayılan-red Firestore kuralları eklendi.
- Blaze gerektiren Cloud Functions ve Firebase Storage projeden çıkarıldı.
- Fotoğraflar ücretsiz yerel IndexedDB'de tutulur; JSON yedeği fotoğrafları da içerir ve eski gömülü fotoğraflar otomatik taşınır.
- Tarla kayıtlarına revizyon tabanlı iyimser eşzamanlılık, bekleyen kayıt durumu ve olay/fotoğraf korumalı çakışma birleştirme eklendi.
- JSON içe aktarmaya dosya boyutu, şema, koordinat, tarih, kimlik, kayıt sayısı ve metin uzunluğu kontrolleri eklendi.
- PWA manifesti, uygulama kabuğu önbelleği, görünür klavye odağı, hareket azaltma ve temel sekme/diyalog semantiği eklendi.
- Firebase Hosting güvenlik başlıkları ve GitHub Actions doğrulama akışı eklendi.
- Kalıcı doğrulama paketi Spark mimarisini de denetler.

Canlı Firebase projesinde yapılması gereken Remote Config ve Spark dağıtım adımları `DEPLOYMENT.md` içinde belgelenmiştir.

## Bilimsel referanslar

- FAO Irrigation and Drainage Paper 56, Crop Evapotranspiration.
- Open-Meteo `et0_fao_evapotranspiration` dokümantasyonu.
