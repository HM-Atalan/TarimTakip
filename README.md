# TarımTakip

Tarla, hava, toprak su dengesi, fenoloji, sulama ve uydu/model verilerini birlikte izleyen tarayıcı tabanlı uygulama.

## Çalıştırma

Proje statik dosyalardan oluşur. Bir yerel HTTP sunucusuyla proje kökünü açın; doğrudan `file://` kullanmayın.

Örnek:

```bash
python -m http.server 8765
```

Ardından `http://127.0.0.1:8765/` adresini açın.

## Doğrulama

Node.js 18 veya üzeriyle:

```bash
npm run verify
```

Komut üretim JavaScript dosyalarının sözdizimini ve FAZ 6–14 regresyon paketini doğrular. Harici npm paketi kurulması gerekmez.

## Audit

Bilimsel varsayımlar, yapılan düzeltmeler ve açık riskler için [AUDIT_REPORT.md](AUDIT_REPORT.md) dosyasına bakın.
