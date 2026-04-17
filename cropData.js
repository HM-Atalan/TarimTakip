// ─── VERİ TABLOLARI (KC ve YIELD EKLENDİ) ──────────────────────────
const CROPS = {
  tahil:['Buğday','Arpa','Mısır','Çavdar','Yulaf','Pirinç','Tritikale','Çeltik'],
  sebze:['Domates','Biber (dolmalık)','Biber (sivri)','Biber (kapya)','Patlıcan','Salatalık',
    'Kabak (yaz)','Kabak (kış)','Soğan (kuru)','Soğan (taze)','Sarımsak','Patates','Havuç',
    'Ispanak','Marul','Brokoli','Karnabahar','Lahana','Kıvırcık','Roka','Maydanoz','Dereotu',
    'Nane','Pırasa','Enginar','Kereviz','Tere','Bamya','Kuşkonmaz','Turp','Pancar','Semizotu',
    'Barbunya (taze)','Fasulye (taze)','Bezelye (taze)'],
  meyve:['Elma','Armut','Şeftali','Kayısı','Kiraz','Vişne','Erik','Üzüm','İncir','Nar','Dut',
    'Ayva','Kivi','Çilek','Ahududu','Böğürtlen','Yaban Mersini'],
  narenciye:['Portakal','Mandalina','Limon','Greyfurt','Pomelo','Bergamot','Turunç'],
  baklagil:['Nohut','Kırmızı Mercimek','Yeşil Mercimek','Fasulye (kuru)','Bezelye (kuru)',
    'Bakla','Soya','Börülce','Barbunya (kuru)'],
  endustri:['Pamuk','Şeker Pancarı','Ayçiçeği','Kolza','Tütün','Keten','Aspir','Susam'],
  yembitki:['Yonca','Korunga','Fiğ','Çayır Otu','Mısır Silajı','Sudan Otu'],
  sera:['Sera Domates','Sera Biber (dolmalık)','Sera Salatalık','Sera Çilek','Sera Marul',
    'Sera Roka','Sera Maydanoz'],
  zeytin:['Zeytin (Sofralık)','Zeytin (Yağlık — Ayvalık)','Zeytin (Yağlık — Gemlik)'],
  bostanlik:['Karpuz','Kavun','Balkabağı','Zucchini','Acur','Hıyar (bostanlık)']
};

const CROP_AGR = {
  'Buğday':     {et:3.2,tb:0,  to:22,tm:35, mn:-3, td:210,
    st:['Çimlenme','Kardeşlenme','Sapa Kalkma','Başaklanma','Süt Olum','Olgunluk'],
    gd:[100,400,700,900,1050,1200],fc:105,
    fert:'Ekimde DAP 15 kg/da + KCl 5 kg/da; kardeşlenmede Üre 10 kg/da; sapa kalkışta CAN 15 kg/da',
    kc:[0.4,0.7,1.05,0.85], yieldMax:550, optRain:400},
  'Arpa':       {et:3.0,tb:0,  to:20,tm:32, mn:-4, td:185,
    st:['Çimlenme','Kardeşlenme','Sapa Kalkma','Başaklanma','Olgunluk'],
    gd:[90,350,650,850,1050],fc:85,
    fert:'Ekimde DAP 12 kg/da; kardeşlenmede Üre 8 kg/da; sapa kalkışta CAN 10 kg/da',
    kc:[0.4,0.7,1.0,0.8], yieldMax:500, optRain:350},
  'Mısır':      {et:5.0,tb:10, to:30,tm:40, mn:10, td:130,
    st:['Çimlenme','V6 (6 Yaprak)','VT (Tepe Püskülü)','R1 (İpek)','R3 (Süt)','R6 (Olgunluk)'],
    gd:[100,350,650,800,1000,1400],fc:90,
    fert:'Ekimde DAP+KCl; V3-V5 Üre 15 kg/da; VT CAN 20 kg/da; Zn takip edin',
    kc:[0.3,0.7,1.15,0.85], yieldMax:1200, optRain:500},
  'Domates':    {et:4.5,tb:10, to:25,tm:35, mn:10, td:120,
    st:['Fide','Vejetatif','Çiçeklenme','Meyve Tutumu','Meyve Büyüme','Olgunlaşma'],
    gd:[200,450,650,800,1000,1200],fc:85,
    fert:'Dikimde DAP 10 kg/da; çiçekte K ağırlıklı NPK; meyve döneminde Ca+B yapraktan',
    kc:[0.4,0.8,1.15,0.9], yieldMax:8000, optRain:400},
  'Biber (dolmalık)':{et:4.0,tb:10,to:26,tm:36,mn:10,td:130,
    st:['Fide','Vejetatif','Çiçeklenme','Meyve Tutumu','Hasat'],
    gd:[200,500,700,900,1100],fc:85,
    fert:'Dikimde NPK 8-16-16; büyümede CAN; çiçekte K₂SO₄; meyve döneminde Ca+B',
    kc:[0.4,0.75,1.1,0.9], yieldMax:5000, optRain:400},
  'Biber (sivri)':{et:3.8,tb:10,to:26,tm:36,mn:10,td:120,
    st:['Fide','Vejetatif','Çiçek','Meyve','Hasat'],
    gd:[180,450,650,850,1050],fc:85,
    fert:'Dikimde NPK dengeli; büyümede CAN; çiçekte K+Ca takviyesi',
    kc:[0.4,0.75,1.1,0.9], yieldMax:4000, optRain:380},
  'Biber (kapya)':{et:3.8,tb:10,to:26,tm:36,mn:10,td:130,
    st:['Fide','Vejetatif','Çiçek','Meyve','Olgunlaşma'],
    gd:[200,500,700,900,1150],fc:85,
    fert:'Dikimde NPK 8-16-16; meyve döneminde K artır; Ca+B yapraktan',
    kc:[0.4,0.75,1.1,0.9], yieldMax:4500, optRain:400},
  'Patlıcan':   {et:4.0,tb:10, to:28,tm:38, mn:12, td:120,
    st:['Fide','Vejetatif','Çiçek','Meyve','Hasat'],
    gd:[200,500,700,900,1100],fc:85,
    fert:'Dikimde NPK 15-15-15; büyümede üre; çiçekte K₂O ağırlıklı',
    kc:[0.4,0.75,1.1,0.9], yieldMax:6000, optRain:420},
  'Salatalık':  {et:4.2,tb:12, to:27,tm:37, mn:12, td:90,
    st:['Çimlenme','Fide','Vejetatif','Çiçek','Hasat'],
    gd:[150,300,550,750,950],fc:85,
    fert:'Dikimde NPK 15-15-15; büyümede CAN; çiçekte K+Ca+B',
    kc:[0.4,0.8,1.15,0.9], yieldMax:10000, optRain:450},
  'Patates':    {et:4.5,tb:7,  to:20,tm:30, mn:5,  td:110,
    st:['Çıkış','Vejetatif','Yumru Başlangıç','Yumru Büyüme','Olgunluk'],
    gd:[150,400,650,900,1050],fc:80,
    fert:'Ekimde K ağırlıklı NPK; yumru büyümesinde K₂SO₄ artır; Mg ve B mikro',
    kc:[0.4,0.7,1.1,0.85], yieldMax:4000, optRain:350},
  'Soğan (kuru)':{et:3.5,tb:7,  to:20,tm:30, mn:0,  td:150,
    st:['Çıkış','Vejetatif','Soğan Bağlama','Olgunluk'],
    gd:[100,600,900,1200],fc:80,
    fert:'Ekimde DAP+KCl; büyümede bölünmüş üre; soğan bağlamada K artır',
    kc:[0.4,0.7,1.0,0.8], yieldMax:6000, optRain:400},
  'Sarımsak':   {et:3.0,tb:0,  to:18,tm:28, mn:-5, td:180,
    st:['Çıkış','Vejetatif','Diş Bağlama','Olgunluk'],
    gd:[80,400,700,1000],fc:80,
    fert:'Ekimde DAP 10 kg/da; büyümede Üre 8 kg/da; diş bağlamada K',
    kc:[0.4,0.7,1.0,0.8], yieldMax:5000, optRain:350},
  'Pamuk':      {et:6.0,tb:15, to:30,tm:40, mn:15, td:180,
    st:['Çimlenme','Vejetatif','Tomurcuklama','Çiçeklenme','Koza Tutumu','Koza Açılımı'],
    gd:[60,400,700,1000,1300,1600],fc:90,
    fert:'Ekimde DAP; çiçekte N+K dengeli; kozada B ve Zn mikro besin',
    kc:[0.4,0.75,1.1,0.85], yieldMax:500, optRain:500},
  'Ayçiçeği':  {et:4.0,tb:6,  to:25,tm:35, mn:5,  td:120,
    st:['Çimlenme','Rozet','Çiçeklenme','Tohum Doldurma','Olgunluk'],
    gd:[80,400,700,950,1100],fc:80,
    fert:'Ekimde DAP; rozetde CAN 10 kg/da; çiçeklenmede B mikro element',
    kc:[0.4,0.7,1.1,0.85], yieldMax:350, optRain:400},
  'Şeker Pancarı':{et:4.5,tb:3,to:20,tm:30,mn:-2,td:180,
    st:['Çıkış','Vejetatif','Kök Büyüme','Olgunluk'],
    gd:[120,500,900,1300],fc:95,
    fert:'Ekimde NPK dengeli; büyümede bölünmüş N; olgunlukta K artır',
    kc:[0.4,0.75,1.1,0.85], yieldMax:7000, optRain:450},
  'Zeytin (Yağlık — Ayvalık)':{et:2.5,tb:10,to:25,tm:38,mn:-7,td:270,
    st:['Sürgün Uyanışı','Çiçeklenme','Meyve Tutumu','Meyve Büyüme','Yağ Biriktirme','Hasat'],
    gd:[200,400,700,1200,1600,2000],fc:70,
    fert:'Sonbaharda K₂SO₄ 8 kg/ağaç; ilkbaharda Üre 0.5-1 kg/ağaç; yapraktan Zn+B',
    kc:[0.5,0.65,0.7,0.65], yieldMax:30, optRain:600},
  'Zeytin (Yağlık — Gemlik)':{et:2.5,tb:10,to:25,tm:38,mn:-8,td:275,
    st:['Sürgün','Çiçek','Meyve Tutumu','Büyüme','Yağ Biriktirme','Hasat'],
    gd:[200,420,720,1220,1620,2050],fc:70,
    fert:'Sonbaharda K₂SO₄; ilkbaharda Üre+DAP; yapraktan Zn+B+Mn',
    kc:[0.5,0.65,0.7,0.65], yieldMax:30, optRain:600},
  'Elma':       {et:3.0,tb:4,  to:22,tm:32, mn:-25,td:180,
    st:['Tomurcuk Kabarması','Çiçeklenme','Meyve Tutumu','Meyve Büyüme','Olgunluk'],
    gd:[100,250,450,900,1400],fc:80,
    fert:'İlkbaharda dengeli NPK; meyve büyümesinde K artır; yapraktan Ca+B',
    kc:[0.5,0.8,1.0,0.8], yieldMax:3000, optRain:500},
  'Portakal':   {et:3.5,tb:13, to:27,tm:38, mn:-3, td:300,
    st:['Sürgün','Çiçeklenme','Meyve Tutumu','Büyüme','Renk Değişimi','Olgunluk'],
    gd:[300,600,1000,1600,2000,2400],fc:80,
    fert:'3 dönemde bölünmüş gübre; Mg ve Fe eksikliğine dikkat; yapraktan Mn+Zn',
    kc:[0.5,0.7,0.85,0.7], yieldMax:4000, optRain:800},
  'Mandalina':  {et:3.2,tb:13, to:26,tm:37, mn:-4, td:290,
    st:['Sürgün','Çiçek','Meyve Tutumu','Büyüme','Olgunluk'],
    gd:[280,560,950,1550,2200],fc:80,
    fert:'İlkbaharda N ağırlıklı; meyve döneminde K+Mg; yapraktan Zn+Mn',
    kc:[0.5,0.7,0.85,0.7], yieldMax:3500, optRain:750},
  'Karpuz':     {et:5.0,tb:15, to:32,tm:42, mn:15, td:90,
    st:['Çimlenme','Fide','Çiçeklenme','Meyve Tutumu','Olgunluk'],
    gd:[100,300,600,900,1200],fc:85,
    fert:'Ekimde DAP; çiçekte K ağırlıklı; meyve döneminde Ca+B yapraktan',
    kc:[0.4,0.7,1.0,0.85], yieldMax:6000, optRain:250},
  'Kavun':      {et:4.5,tb:15, to:30,tm:40, mn:15, td:85,
    st:['Çimlenme','Vejetatif','Çiçek','Olgunlaşma'],
    gd:[90,350,650,1100],fc:80,
    fert:'Ekimde NPK 15-15-15; büyümede K; olgunlaşmada B takviyesi',
    kc:[0.4,0.7,1.0,0.85], yieldMax:4000, optRain:250},
  'Çilek':      {et:3.5,tb:5,  to:20,tm:30, mn:-10,td:90,
    st:['Vejetasyon','Çiçeklenme','Meyve Tutumu','Olgunlaşma','Hasat'],
    gd:[150,350,500,650,800],fc:80,
    fert:'Dikimde DAP; dengeli NPK; Ca+B önemli; Fe eksikliğine dikkat',
    kc:[0.4,0.7,1.0,0.85], yieldMax:2500, optRain:400},
  'Çavdar': {et: 3.0, tb: 2, to: 18, tm: 30, mn: -10, td: 180,
  st: ['Çimlenme', 'Kardeşlenme', 'Sapa Kalkma', 'Başaklanma', 'Olgunluk'],
  gd: [100, 350, 650, 900, 1100], fc: 85,
  fert: 'Ekimde DAP 12 kg/da; kardeşlenmede Üre 8 kg/da; sapa kalkışta CAN 10 kg/da',
  kc: [0.4, 0.7, 1.0, 0.8], yieldMax: 400, optRain: 350},
  'Yulaf': {et: 3.1, tb: 2, to: 19, tm: 32, mn: -8, td: 170,
  st: ['Çimlenme', 'Kardeşlenme', 'Sapa Kalkma', 'Başaklanma', 'Olgunluk'],
  gd: [90, 340, 640, 880, 1080], fc: 85,
  fert: 'Ekimde DAP 12 kg/da; kardeşlenmede Üre 8 kg/da; sapa kalkışta CAN 10 kg/da',
  kc: [0.4, 0.7, 1.0, 0.8], yieldMax: 450, optRain: 380},
  'Pirinç': {et: 5.5, tb: 12, to: 28, tm: 38, mn: 12, td: 140,
  st: ['Çimlenme', 'Fide', 'Kardeşlenme', 'Sapa Kalkma', 'Başaklanma', 'Olgunluk'],
  gd: [150, 400, 700, 1000, 1200, 1350], fc: 120,
  fert: 'Fide şaşırtmada DAP 8 kg/da; kardeşlenmede Üre 12 kg/da; başaklanmada K₂SO₄ 5 kg/da',
  kc: [0.5, 0.8, 1.2, 0.9], yieldMax: 800, optRain: 700},
  'Çeltik': {et: 5.5, tb: 12, to: 28, tm: 38, mn: 12, td: 140,
  st: ['Çimlenme', 'Fide', 'Kardeşlenme', 'Sapa Kalkma', 'Başaklanma', 'Olgunluk'],
  gd: [150, 400, 700, 1000, 1200, 1350], fc: 120,
  fert: 'Fide şaşırtmada DAP 8 kg/da; kardeşlenmede Üre 12 kg/da; başaklanmada K₂SO₄ 5 kg/da',
  kc: [0.5, 0.8, 1.2, 0.9], yieldMax: 800, optRain: 700},
  'Tritikale': {et: 3.2, tb: 2, to: 20, tm: 33, mn: -8, td: 185,
  st: ['Çimlenme', 'Kardeşlenme', 'Sapa Kalkma', 'Başaklanma', 'Olgunluk'],
  gd: [100, 380, 680, 920, 1120], fc: 85,
  fert: 'Ekimde DAP 14 kg/da; kardeşlenmede Üre 9 kg/da; sapa kalkışta CAN 12 kg/da',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 500, optRain: 400},
'Kabak (yaz)': {et: 4.0, tb: 12, to: 24, tm: 34, mn: 10, td: 70,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Meyve Tutumu', 'Hasat'],
  gd: [150, 400, 650, 850, 1000], fc: 80,
  fert: 'Dikimde NPK 15-15-15 10 kg/da; çiçekte K ağırlıklı gübre; meyve döneminde Ca+B yapraktan',
  kc: [0.4, 0.8, 1.1, 0.9], yieldMax: 6000, optRain: 300},
'Kabak (kış)': {et: 4.2, tb: 12, to: 25, tm: 35, mn: 8, td: 110,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Meyve Tutumu', 'Olgunlaşma'],
  gd: [200, 500, 800, 1100, 1400], fc: 80,
  fert: 'Dikimde NPK 15-15-15 12 kg/da; meyve döneminde K artır; yapraktan Zn',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 5000, optRain: 350},
  'Soğan (taze)': {et: 3.5, tb: 7, to: 20, tm: 30, mn: 0, td: 90,
  st: ['Çıkış', 'Vejetatif', 'Hasat'],
  gd: [100, 500, 800], fc: 80,
  fert: 'Ekimde DAP 8 kg/da; büyümede üre 6 kg/da; K takviyesi',
  kc: [0.4, 0.8, 0.9], yieldMax: 4000, optRain: 350},
  'Havuç': {
  et: 3.8, tb: 5, to: 20, tm: 28, mn: 2, td: 100,
  st: ['Çimlenme', 'Vejetatif', 'Kök Büyüme', 'Olgunluk'],
  gd: [80, 400, 700, 950], fc: 80,
  fert: 'Ekimde NPK 10-20-20; büyümede K ağırlıklı; B ve Ca yapraktan',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 6000, optRain: 400
},
'Ispanak': {
  et: 3.5, tb: 4, to: 18, tm: 26, mn: -2, td: 60,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [80, 400, 650], fc: 75,
  fert: 'Ekimde DAP 6 kg/da; büyümede Üre 5 kg/da; N ağırlıklı',
  kc: [0.4, 0.9, 0.9], yieldMax: 2500, optRain: 300
},
'Marul': {
  et: 3.5, tb: 5, to: 20, tm: 28, mn: 2, td: 50,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [60, 350, 550], fc: 75,
  fert: 'Ekimde NPK 15-15-15 8 kg/da; büyümede N ağırlıklı',
  kc: [0.4, 0.8, 0.9], yieldMax: 3000, optRain: 280
},
'Brokoli': {
  et: 4.0, tb: 8, to: 20, tm: 28, mn: 2, td: 80,
  st: ['Fide', 'Vejetatif', 'Baş Oluşumu', 'Hasat'],
  gd: [150, 400, 700, 900], fc: 80,
  fert: 'Dikimde NPK 15-15-15; büyümede N ağırlıklı; B ve Ca yapraktan',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 2500, optRain: 350
},
'Karnabahar': {
  et: 4.0, tb: 8, to: 20, tm: 28, mn: 2, td: 80,
  st: ['Fide', 'Vejetatif', 'Baş Oluşumu', 'Hasat'],
  gd: [150, 400, 700, 900], fc: 80,
  fert: 'Dikimde NPK 15-15-15; büyümede N; B ve Mo yapraktan',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 2800, optRain: 350
},
'Lahana': {
  et: 3.8, tb: 6, to: 18, tm: 28, mn: 0, td: 90,
  st: ['Fide', 'Vejetatif', 'Bağlama', 'Hasat'],
  gd: [120, 400, 700, 950], fc: 80,
  fert: 'Dikimde NPK 15-15-15; büyümede N; K bağlamada',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 6000, optRain: 400
},
'Kıvırcık': {
  et: 3.5, tb: 5, to: 18, tm: 26, mn: 0, td: 55,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [70, 350, 600], fc: 75,
  fert: 'Ekimde NPK 15-15-15 6 kg/da; büyümede N',
  kc: [0.4, 0.8, 0.9], yieldMax: 2500, optRain: 300
},
'Roka': {
  et: 3.5, tb: 8, to: 20, tm: 28, mn: 5, td: 40,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [50, 300, 500], fc: 70,
  fert: 'Ekimde NPK 15-15-15 5 kg/da; büyümede N',
  kc: [0.4, 0.8, 0.9], yieldMax: 1200, optRain: 250
},
'Maydanoz': {
  et: 3.5, tb: 8, to: 20, tm: 28, mn: 4, td: 70,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [80, 400, 700], fc: 75,
  fert: 'Ekimde NPK 15-15-15 8 kg/da; büyümede N',
  kc: [0.4, 0.8, 0.9], yieldMax: 3000, optRain: 300
},
'Dereotu': {
  et: 3.5, tb: 8, to: 20, tm: 28, mn: 5, td: 50,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [60, 350, 550], fc: 75,
  fert: 'Ekimde NPK 15-15-15 5 kg/da; büyümede N',
  kc: [0.4, 0.8, 0.9], yieldMax: 1500, optRain: 280
},
'Nane': {
  et: 4.0, tb: 10, to: 25, tm: 32, mn: 5, td: 120,
  st: ['Fide', 'Vejetatif', 'Çiçeklenme', 'Hasat'],
  gd: [150, 500, 800, 1000], fc: 80,
  fert: 'Dikimde NPK 15-15-15; her hasattan sonra N takviyesi',
  kc: [0.5, 0.8, 1.0, 0.9], yieldMax: 4000, optRain: 400
},
'Pırasa': {
  et: 3.5, tb: 5, to: 20, tm: 28, mn: 0, td: 120,
  st: ['Fide', 'Vejetatif', 'Kalınlaşma', 'Hasat'],
  gd: [100, 500, 800, 1000], fc: 80,
  fert: 'Dikimde NPK 15-15-15; büyümede N; K takviyesi',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 4000, optRain: 380
},
'Enginar': {
  et: 4.0, tb: 8, to: 22, tm: 30, mn: 2, td: 150,
  st: ['Fide', 'Vejetatif', 'Baş Oluşumu', 'Hasat'],
  gd: [200, 600, 1000, 1300], fc: 85,
  fert: 'Dikimde NPK 15-15-15; baş oluşumunda K ve Ca',
  kc: [0.5, 0.8, 1.0, 0.85], yieldMax: 2500, optRain: 450
},
'Kereviz': {
  et: 3.8, tb: 8, to: 20, tm: 28, mn: 2, td: 120,
  st: ['Fide', 'Vejetatif', 'Yumru Büyüme', 'Olgunluk'],
  gd: [150, 500, 900, 1100], fc: 85,
  fert: 'Dikimde NPK 15-15-15; büyümede N ve K',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 6000, optRain: 450
},
'Tere': {
  et: 3.5, tb: 8, to: 20, tm: 28, mn: 5, td: 30,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [40, 250, 400], fc: 70,
  fert: 'Ekimde NPK 15-15-15 4 kg/da; büyümede N',
  kc: [0.4, 0.8, 0.9], yieldMax: 800, optRain: 250
},
'Bamya': {
  et: 4.5, tb: 15, to: 28, tm: 38, mn: 12, td: 90,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Meyve Tutumu', 'Hasat'],
  gd: [200, 500, 800, 1000, 1200], fc: 85,
  fert: 'Ekimde DAP 8 kg/da; çiçekte K ağırlıklı; meyve döneminde Ca+B',
  kc: [0.4, 0.8, 1.1, 0.9], yieldMax: 2000, optRain: 400
},
'Kuşkonmaz': {
  et: 4.0, tb: 10, to: 25, tm: 32, mn: 5, td: 150,
  st: ['Fide', 'Vejetatif', 'Sürgün Verme', 'Hasat'],
  gd: [300, 800, 1200, 1500], fc: 80,
  fert: 'Dikimde organik gübre; her yıl ilkbaharda NPK 10-10-10',
  kc: [0.5, 0.8, 1.0, 0.85], yieldMax: 1500, optRain: 450
},
'Turp': {
  et: 3.5, tb: 5, to: 18, tm: 28, mn: 2, td: 50,
  st: ['Çimlenme', 'Vejetatif', 'Yumru Büyüme', 'Olgunluk'],
  gd: [80, 350, 600, 750], fc: 75,
  fert: 'Ekimde NPK 10-20-20; büyümede K',
  kc: [0.4, 0.7, 0.9, 0.8], yieldMax: 3000, optRain: 300
},
'Pancar': {
  et: 4.0, tb: 6, to: 20, tm: 28, mn: 2, td: 80,
  st: ['Çimlenme', 'Vejetatif', 'Kök Büyüme', 'Olgunluk'],
  gd: [100, 450, 750, 950], fc: 80,
  fert: 'Ekimde NPK 10-20-20; büyümede K ve B',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 5000, optRain: 350
},
'Semizotu': {
  et: 4.0, tb: 10, to: 25, tm: 35, mn: 8, td: 60,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [100, 400, 700], fc: 75,
  fert: 'Ekimde NPK 15-15-15 6 kg/da; büyümede N',
  kc: [0.4, 0.9, 0.9], yieldMax: 2000, optRain: 300
},
'Barbunya (taze)': {
  et: 4.0, tb: 10, to: 24, tm: 32, mn: 8, td: 80,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Hasat'],
  gd: [150, 400, 700, 900, 1100], fc: 85,
  fert: 'Ekimde DAP 8 kg/da; çiçekte K ve Ca yapraktan',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 2500, optRain: 350
},
'Fasulye (taze)': {
  et: 4.0, tb: 10, to: 24, tm: 32, mn: 8, td: 80,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Hasat'],
  gd: [150, 400, 700, 900, 1100], fc: 85,
  fert: 'Ekimde DAP 8 kg/da; çiçekte K ve Ca yapraktan',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 2500, optRain: 350
},
'Bezelye (taze)': {
  et: 3.8, tb: 5, to: 20, tm: 28, mn: 2, td: 70,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Hasat'],
  gd: [120, 350, 600, 800, 950], fc: 80,
  fert: 'Ekimde DAP 6 kg/da; çiçekte K',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 2000, optRain: 300
},
  'Armut': {
  et: 3.0, tb: 4, to: 22, tm: 32, mn: -20, td: 175,
  st: ['Tomurcuk Kabarması', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [100, 260, 480, 950, 1450], fc: 80,
  fert: 'İlkbaharda NPK; meyve döneminde K; Ca yapraktan',
  kc: [0.5, 0.8, 1.0, 0.8], yieldMax: 2800, optRain: 500
},
'Şeftali': {
  et: 3.5, tb: 6, to: 24, tm: 34, mn: -15, td: 160,
  st: ['Tomurcuk Kabarması', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [120, 300, 500, 1000, 1400], fc: 80,
  fert: 'İlkbaharda NPK; meyve döneminde K artır; yapraktan Ca+B',
  kc: [0.5, 0.8, 1.05, 0.85], yieldMax: 2500, optRain: 550
},
'Kayısı': {
  et: 3.5, tb: 6, to: 24, tm: 34, mn: -20, td: 150,
  st: ['Tomurcuk Kabarması', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [110, 280, 480, 950, 1350], fc: 80,
  fert: 'İlkbaharda NPK; meyve döneminde K; yapraktan Zn+B',
  kc: [0.5, 0.8, 1.05, 0.85], yieldMax: 2000, optRain: 500
},
'Kiraz': {
  et: 3.5, tb: 6, to: 22, tm: 32, mn: -20, td: 140,
  st: ['Tomurcuk Kabarması', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [100, 250, 450, 850, 1200], fc: 80,
  fert: 'İlkbaharda NPK; meyve döneminde K; Ca yapraktan',
  kc: [0.5, 0.8, 1.0, 0.8], yieldMax: 1500, optRain: 500
},
'Vişne': {
  et: 3.5, tb: 6, to: 22, tm: 32, mn: -20, td: 140,
  st: ['Tomurcuk Kabarması', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [100, 250, 450, 850, 1200], fc: 80,
  fert: 'İlkbaharda NPK; meyve döneminde K; Ca yapraktan',
  kc: [0.5, 0.8, 1.0, 0.8], yieldMax: 1500, optRain: 500
},
'Erik': {
  et: 3.5, tb: 6, to: 24, tm: 34, mn: -20, td: 150,
  st: ['Tomurcuk Kabarması', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [110, 280, 480, 950, 1350], fc: 80,
  fert: 'İlkbaharda NPK; meyve döneminde K; B yapraktan',
  kc: [0.5, 0.8, 1.05, 0.85], yieldMax: 2000, optRain: 500
},
'Üzüm': {
  et: 4.0, tb: 10, to: 28, tm: 38, mn: -10, td: 150,
  st: ['Sürgün', 'Çiçeklenme', 'Meyve Tutumu', 'Tane Büyüme', 'Olgunluk'],
  gd: [200, 400, 700, 1100, 1500], fc: 80,
  fert: 'İlkbaharda NPK; tane büyümesinde K; yapraktan Zn+B',
  kc: [0.5, 0.7, 0.9, 0.8], yieldMax: 2000, optRain: 450
},
'İncir': {
  et: 3.5, tb: 10, to: 28, tm: 38, mn: -8, td: 180,
  st: ['Sürgün', 'Meyve Oluşumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [200, 600, 1200, 1800], fc: 75,
  fert: 'İlkbaharda NPK; meyve döneminde K; yapraktan Ca+B',
  kc: [0.5, 0.8, 0.9, 0.7], yieldMax: 1500, optRain: 500
},
'Nar': {
  et: 3.5, tb: 12, to: 28, tm: 38, mn: -5, td: 180,
  st: ['Sürgün', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [200, 500, 800, 1300, 1800], fc: 75,
  fert: 'İlkbaharda NPK; meyve döneminde K; yapraktan Zn+B',
  kc: [0.5, 0.7, 0.9, 0.7], yieldMax: 1200, optRain: 550
},
'Dut': {
  et: 3.5, tb: 10, to: 26, tm: 36, mn: -10, td: 160,
  st: ['Sürgün', 'Meyve Oluşumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [180, 500, 900, 1400], fc: 75,
  fert: 'İlkbaharda NPK; meyve döneminde K',
  kc: [0.5, 0.8, 0.9, 0.7], yieldMax: 1000, optRain: 500
},
'Ayva': {
  et: 3.0, tb: 6, to: 22, tm: 32, mn: -15, td: 170,
  st: ['Tomurcuk Kabarması', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [100, 260, 480, 950, 1400], fc: 80,
  fert: 'İlkbaharda NPK; meyve döneminde K; Ca yapraktan',
  kc: [0.5, 0.8, 1.0, 0.8], yieldMax: 2000, optRain: 500
},
'Kivi': {
  et: 4.0, tb: 8, to: 24, tm: 34, mn: -10, td: 200,
  st: ['Sürgün', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [200, 500, 800, 1400, 2000], fc: 85,
  fert: 'İlkbaharda NPK; yazın K; yapraktan Zn+B',
  kc: [0.5, 0.8, 1.1, 0.85], yieldMax: 3000, optRain: 600
},
  'Ahududu': {
  et: 3.8, tb: 8, to: 22, tm: 30, mn: -10, td: 120,
  st: ['Sürgün', 'Çiçeklenme', 'Meyve Oluşumu', 'Hasat'],
  gd: [200, 500, 800, 1100], fc: 80,
  fert: 'İlkbaharda NPK; meyve döneminde K; organik madde',
  kc: [0.5, 0.8, 1.0, 0.85], yieldMax: 1500, optRain: 500
},
'Böğürtlen': {
  et: 3.8, tb: 8, to: 24, tm: 32, mn: -10, td: 120,
  st: ['Sürgün', 'Çiçeklenme', 'Meyve Oluşumu', 'Hasat'],
  gd: [200, 500, 800, 1100], fc: 80,
  fert: 'İlkbaharda NPK; meyve döneminde K',
  kc: [0.5, 0.8, 1.0, 0.85], yieldMax: 1500, optRain: 500
},
'Yaban Mersini': {
  et: 3.5, tb: 8, to: 22, tm: 30, mn: -15, td: 140,
  st: ['Tomurcuk', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunluk'],
  gd: [150, 400, 600, 900, 1200], fc: 85,
  fert: 'Asidik toprak; amonyumlu gübre; yapraktan Fe ve Mg',
  kc: [0.5, 0.8, 1.0, 0.85], yieldMax: 1000, optRain: 550
},
  'Limon': {
  et: 3.5, tb: 13, to: 27, tm: 38, mn: -2, td: 280,
  st: ['Sürgün', 'Çiçeklenme', 'Meyve Tutumu', 'Büyüme', 'Olgunluk'],
  gd: [300, 600, 1000, 1600, 2200], fc: 80,
  fert: 'NPK dengeli; meyve döneminde K; yapraktan Zn+Fe',
  kc: [0.5, 0.7, 0.85, 0.7], yieldMax: 3500, optRain: 750
},
'Greyfurt': {
  et: 3.5, tb: 13, to: 27, tm: 38, mn: -3, td: 300,
  st: ['Sürgün', 'Çiçeklenme', 'Meyve Tutumu', 'Büyüme', 'Olgunluk'],
  gd: [300, 600, 1000, 1600, 2400], fc: 80,
  fert: 'NPK; meyve döneminde K; Mg ve B',
  kc: [0.5, 0.7, 0.85, 0.7], yieldMax: 4000, optRain: 800
},
'Pomelo': {
  et: 3.5, tb: 13, to: 27, tm: 38, mn: -3, td: 310,
  st: ['Sürgün', 'Çiçeklenme', 'Meyve Tutumu', 'Büyüme', 'Olgunluk'],
  gd: [320, 650, 1100, 1700, 2500], fc: 80,
  fert: 'NPK; meyve döneminde K; yapraktan Zn+Mn',
  kc: [0.5, 0.7, 0.85, 0.7], yieldMax: 4500, optRain: 850
},
'Bergamot': {
  et: 3.5, tb: 13, to: 26, tm: 37, mn: -3, td: 280,
  st: ['Sürgün', 'Çiçeklenme', 'Meyve Tutumu', 'Büyüme', 'Olgunluk'],
  gd: [300, 600, 1000, 1600, 2200], fc: 80,
  fert: 'NPK dengeli; meyve döneminde K; Mg ve B',
  kc: [0.5, 0.7, 0.85, 0.7], yieldMax: 3000, optRain: 750
},
'Turunç': {
  et: 3.5, tb: 13, to: 26, tm: 37, mn: -4, td: 280,
  st: ['Sürgün', 'Çiçeklenme', 'Meyve Tutumu', 'Büyüme', 'Olgunluk'],
  gd: [300, 600, 1000, 1600, 2200], fc: 80,
  fert: 'NPK; meyve döneminde K; yapraktan Zn+Fe',
  kc: [0.5, 0.7, 0.85, 0.7], yieldMax: 3000, optRain: 750
},
'Nohut': {
  et: 3.5, tb: 5, to: 24, tm: 32, mn: -2, td: 100,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Olgunluk'],
  gd: [100, 350, 600, 800, 950], fc: 80,
  fert: 'Ekimde DAP 6 kg/da; çiçekte K; Rhizobium aşılaması',
  kc: [0.4, 0.7, 1.0, 0.8], yieldMax: 200, optRain: 350
},
'Kırmızı Mercimek': {
  et: 3.5, tb: 5, to: 22, tm: 32, mn: -2, td: 90,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Olgunluk'],
  gd: [80, 300, 550, 750, 900], fc: 80,
  fert: 'Ekimde DAP 5 kg/da; Rhizobium aşılaması',
  kc: [0.4, 0.7, 1.0, 0.8], yieldMax: 150, optRain: 320
},
'Yeşil Mercimek': {
  et: 3.5, tb: 5, to: 22, tm: 32, mn: -2, td: 90,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Olgunluk'],
  gd: [80, 300, 550, 750, 900], fc: 80,
  fert: 'Ekimde DAP 5 kg/da; Rhizobium aşılaması',
  kc: [0.4, 0.7, 1.0, 0.8], yieldMax: 150, optRain: 320
},
'Fasulye (kuru)': {
  et: 4.0, tb: 10, to: 24, tm: 34, mn: 8, td: 90,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Olgunluk'],
  gd: [150, 400, 700, 1000, 1200], fc: 85,
  fert: 'Ekimde DAP 8 kg/da; çiçekte K; Rhizobium',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 250, optRain: 400
},
'Bezelye (kuru)': {
  et: 3.8, tb: 5, to: 20, tm: 28, mn: 2, td: 80,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Olgunluk'],
  gd: [120, 350, 600, 800, 1000], fc: 80,
  fert: 'Ekimde DAP 6 kg/da; Rhizobium aşılaması',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 200, optRain: 350
},
'Bakla': {
  et: 4.0, tb: 5, to: 20, tm: 28, mn: -2, td: 100,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Olgunluk'],
  gd: [100, 350, 650, 900, 1100], fc: 85,
  fert: 'Ekimde DAP 8 kg/da; çiçekte K; Rhizobium',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 300, optRain: 400
},
'Soya': {
  et: 4.5, tb: 10, to: 28, tm: 38, mn: 8, td: 110,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Tohum Dolum', 'Olgunluk'],
  gd: [150, 450, 750, 1000, 1300, 1500], fc: 85,
  fert: 'Ekimde DAP 8 kg/da; çiçekte K; Bradyrhizobium',
  kc: [0.4, 0.8, 1.1, 0.85], yieldMax: 400, optRain: 500
},
'Börülce': {
  et: 4.0, tb: 10, to: 28, tm: 38, mn: 10, td: 80,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Olgunluk'],
  gd: [150, 400, 700, 950, 1150], fc: 85,
  fert: 'Ekimde DAP 7 kg/da; Rhizobium',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 200, optRain: 400
},
'Barbunya (kuru)': {
  et: 4.0, tb: 10, to: 24, tm: 32, mn: 8, td: 90,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu', 'Olgunluk'],
  gd: [150, 400, 700, 1000, 1200], fc: 85,
  fert: 'Ekimde DAP 8 kg/da; çiçekte K; Rhizobium',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 250, optRain: 400
},
  'Kolza': {
  et: 4.0, tb: 4, to: 22, tm: 32, mn: -5, td: 140,
  st: ['Çimlenme', 'Rozet', 'Sapa Kalkma', 'Çiçeklenme', 'Tohum Dolum', 'Olgunluk'],
  gd: [100, 350, 650, 900, 1100, 1300], fc: 85,
  fert: 'Ekimde DAP; kardeşlenmede N; çiçekte B ve K',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 400, optRain: 450
},
'Tütün': {
  et: 4.5, tb: 12, to: 25, tm: 35, mn: 8, td: 120,
  st: ['Fide', 'Vejetatif', 'Olgunlaşma', 'Hasat'],
  gd: [200, 600, 1000, 1300], fc: 85,
  fert: 'Dikimde NPK; büyümede N; K kalite için önemli; klorürsüz gübre',
  kc: [0.4, 0.8, 1.0, 0.85], yieldMax: 250, optRain: 500
},
'Keten': {
  et: 3.5, tb: 4, to: 20, tm: 28, mn: -2, td: 100,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Olgunluk'],
  gd: [80, 300, 600, 900], fc: 80,
  fert: 'Ekimde NPK; büyümede N; K lif kalitesi',
  kc: [0.4, 0.7, 1.0, 0.8], yieldMax: 150, optRain: 350
},
'Aspir': {
  et: 3.8, tb: 8, to: 25, tm: 35, mn: -5, td: 130,
  st: ['Çimlenme', 'Rozet', 'Sapa Kalkma', 'Çiçeklenme', 'Tohum Dolum', 'Olgunluk'],
  gd: [100, 400, 700, 1000, 1200, 1400], fc: 85,
  fert: 'Ekimde DAP; çiçekte K; B takviyesi',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 200, optRain: 400
},
'Susam': {
  et: 4.5, tb: 15, to: 30, tm: 40, mn: 12, td: 100,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Kapsül Oluşumu', 'Olgunluk'],
  gd: [150, 450, 750, 1000, 1200], fc: 80,
  fert: 'Ekimde NPK; çiçekte K; B ve Zn',
  kc: [0.4, 0.7, 1.0, 0.8], yieldMax: 120, optRain: 400
},
'Yonca': {
  et: 5.0, tb: 5, to: 25, tm: 35, mn: -5, td: 200,
  st: ['Çıkış', 'Vejetatif', 'Tomurcuklanma', 'Çiçeklenme', 'Tohum Bağlama'],
  gd: [150, 400, 700, 1000, 1300], fc: 90,
  fert: 'Ekimde DAP; her biçimden sonra K ve P; Rhizobium',
  kc: [0.4, 0.8, 1.1, 0.9], yieldMax: 1200, optRain: 500
},
'Korunga': {
  et: 4.5, tb: 5, to: 22, tm: 32, mn: -8, td: 180,
  st: ['Çıkış', 'Vejetatif', 'Çiçeklenme', 'Tohum Bağlama'],
  gd: [120, 350, 650, 950], fc: 85,
  fert: 'Ekimde DAP; Rhizobium; kireçli topraklara uygun',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 800, optRain: 450
},
'Fiğ': {
  et: 4.0, tb: 5, to: 22, tm: 30, mn: -5, td: 120,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Bakla Oluşumu'],
  gd: [100, 350, 650, 850], fc: 85,
  fert: 'Ekimde DAP; Rhizobium aşılaması',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 600, optRain: 400
},
'Çayır Otu': {
  et: 4.0, tb: 5, to: 22, tm: 32, mn: -5, td: 150,
  st: ['Vejetatif', 'Başaklanma', 'Çiçeklenme', 'Tohum Oluşumu'],
  gd: [100, 400, 700, 1000], fc: 85,
  fert: 'İlkbaharda N ağırlıklı; biçimlerden sonra N takviyesi',
  kc: [0.4, 0.8, 1.0, 0.85], yieldMax: 1000, optRain: 450
},
'Mısır Silajı': {
  et: 5.0, tb: 10, to: 30, tm: 40, mn: 10, td: 110,
  st: ['Çimlenme', 'V6', 'VT', 'R1', 'R3', 'R5 (Olgunluk)'],
  gd: [100, 350, 650, 800, 1000, 1200], fc: 90,
  fert: 'Ekimde DAP+KCl; V3-V5 Üre 15 kg/da; VT CAN 20 kg/da; Zn takip edin',
  kc: [0.3, 0.7, 1.15, 0.85], yieldMax: 6000, optRain: 500
},
'Sudan Otu': {
  et: 5.0, tb: 12, to: 30, tm: 40, mn: 10, td: 90,
  st: ['Çimlenme', 'Vejetatif', 'Sapa Kalkma', 'Çiçeklenme'],
  gd: [100, 400, 700, 950], fc: 85,
  fert: 'Ekimde DAP; her biçimden sonra N takviyesi',
  kc: [0.4, 0.8, 1.1, 0.9], yieldMax: 5000, optRain: 450
},
'Sera Domates': {
  et: 4.5, tb: 10, to: 25, tm: 35, mn: 10, td: 150,
  st: ['Fide', 'Vejetatif', 'Çiçeklenme', 'Meyve Tutumu', 'Meyve Büyüme', 'Olgunlaşma'],
  gd: [200, 450, 650, 800, 1000, 1200], fc: 85,
  fert: 'Dikimde DAP 10 kg/da; çiçekte K ağırlıklı NPK; meyve döneminde Ca+B yapraktan',
  kc: [0.4, 0.8, 1.15, 0.9], yieldMax: 20000, optRain: 400
},
'Sera Biber (dolmalık)': {
  et: 4.0, tb: 10, to: 26, tm: 36, mn: 10, td: 160,
  st: ['Fide', 'Vejetatif', 'Çiçeklenme', 'Meyve Tutumu', 'Hasat'],
  gd: [200, 500, 700, 900, 1100], fc: 85,
  fert: 'Dikimde NPK 8-16-16; büyümede CAN; çiçekte K₂SO₄; meyve döneminde Ca+B',
  kc: [0.4, 0.75, 1.1, 0.9], yieldMax: 15000, optRain: 400
},
'Sera Salatalık': {
  et: 4.2, tb: 12, to: 27, tm: 37, mn: 12, td: 120,
  st: ['Çimlenme', 'Fide', 'Vejetatif', 'Çiçek', 'Hasat'],
  gd: [150, 300, 550, 750, 950], fc: 85,
  fert: 'Dikimde NPK 15-15-15; büyümede CAN; çiçekte K+Ca+B',
  kc: [0.4, 0.8, 1.15, 0.9], yieldMax: 25000, optRain: 450
},
'Sera Çilek': {
  et: 3.5, tb: 5, to: 20, tm: 30, mn: -10, td: 120,
  st: ['Vejetasyon', 'Çiçeklenme', 'Meyve Tutumu', 'Olgunlaşma', 'Hasat'],
  gd: [150, 350, 500, 650, 800], fc: 80,
  fert: 'Dikimde DAP; dengeli NPK; Ca+B önemli; Fe eksikliğine dikkat',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 5000, optRain: 400
},
'Sera Marul': {
  et: 3.5, tb: 5, to: 20, tm: 28, mn: 2, td: 60,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [60, 350, 550], fc: 75,
  fert: 'Dikimde NPK 15-15-15 8 kg/da; büyümede N ağırlıklı',
  kc: [0.4, 0.8, 0.9], yieldMax: 6000, optRain: 280
},
'Sera Roka': {
  et: 3.5, tb: 8, to: 20, tm: 28, mn: 5, td: 40,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [50, 300, 500], fc: 70,
  fert: 'Dikimde NPK 15-15-15 5 kg/da; büyümede N',
  kc: [0.4, 0.8, 0.9], yieldMax: 3000, optRain: 250
},
'Sera Maydanoz': {
  et: 3.5, tb: 8, to: 20, tm: 28, mn: 4, td: 70,
  st: ['Çimlenme', 'Vejetatif', 'Hasat'],
  gd: [80, 400, 700], fc: 75,
  fert: 'Dikimde NPK 15-15-15 8 kg/da; büyümede N',
  kc: [0.4, 0.8, 0.9], yieldMax: 5000, optRain: 300
},
  'Balkabağı': {
  et: 4.2, tb: 12, to: 25, tm: 35, mn: 8, td: 110,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Meyve Tutumu', 'Olgunlaşma'],
  gd: [200, 500, 800, 1100, 1400], fc: 80,
  fert: 'Ekimde NPK 15-15-15; meyve döneminde K; Ca yapraktan',
  kc: [0.4, 0.7, 1.05, 0.85], yieldMax: 5000, optRain: 350
},
'Zucchini': {
  et: 4.0, tb: 12, to: 24, tm: 34, mn: 10, td: 70,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Meyve Tutumu', 'Hasat'],
  gd: [150, 400, 650, 850, 1000], fc: 80,
  fert: 'Dikimde NPK 15-15-15; çiçekte K; meyve döneminde Ca+B',
  kc: [0.4, 0.8, 1.1, 0.9], yieldMax: 8000, optRain: 300
},
'Acur': {
  et: 4.5, tb: 15, to: 28, tm: 38, mn: 12, td: 70,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Meyve Tutumu', 'Hasat'],
  gd: [150, 400, 650, 850, 1000], fc: 80,
  fert: 'Ekimde DAP; çiçekte K; Ca yapraktan',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 5000, optRain: 300
},
'Hıyar (bostanlık)': {
  et: 4.5, tb: 15, to: 28, tm: 38, mn: 12, td: 70,
  st: ['Çimlenme', 'Vejetatif', 'Çiçeklenme', 'Meyve Tutumu', 'Hasat'],
  gd: [150, 400, 650, 850, 1000], fc: 80,
  fert: 'Ekimde DAP; çiçekte K; Ca+B yapraktan',
  kc: [0.4, 0.7, 1.0, 0.85], yieldMax: 6000, optRain: 300
},
  'default':    {et:3.5,tb:5,  to:22,tm:35, mn:0,  td:120,
    st:['Erken Büyüme','Orta Dönem','Olgunluk Öncesi','Hasat'],
    gd:[300,700,950,1100],fc:80,
    fert:'Ekimde temel NPK 15-15-15; büyüme döneminde dengeli azot takviyesi',
    kc:[0.4,0.7,1.0,0.85], yieldMax:300, optRain:350}
};

window.CROPS = CROPS;
window.CROP_AGR = CROP_AGR;
