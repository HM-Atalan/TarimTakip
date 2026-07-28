// ============================================================
// constants.js – Tüm sabit veriler
// ============================================================

const PEST_DATA = {
  'Buğday':['Sarı pas (Puccinia striiformis)','Kahverengi pas (P. triticina)','Septorya yaprak yanıklığı','Fusarium başak yanıklığı','Süne (Eurygaster integriceps)','Kımıl (Aelia sp.)'],
  'Arpa':['Sarı pas','Ağ leke hastalığı (Pyrenophora teres)','Çizgili mozaik virüsü','Süne','Yaprak biti'],
  'Mısır':['Mısır kurdu (Ostrinia nubilalis)','Yaprak biti','Mısır isi (Ustilago maydis)','Kuzey yaprak yanıklığı (Turcicum)','Bozkurt (Agrotis)'],
  'Domates':['Domates güvesi (Tuta absoluta)','Yaprak piresi (Bemisia tabaci)','Kırmızı örümcek (Tetranychus urticae)','Erken yaprak yanıklığı (Alternaria solani)','Geç yanıklık (Phytophthora infestans)','Gri küf (Botrytis cinerea)','Kök ur nematodu (Meloidogyne)'],
  'Biber (dolmalık)':['Yaprak biti (Myzus persicae)','Thrips (Frankliniella occidentalis)','Kırmızı örümcek','Çökerten (Phytophthora capsici)','Kül hastalığı (Leveillula taurica)','Mozaik virüsleri (CMV, PVY)'],
  'Biber (sivri)':['Yaprak biti','Thrips','Kırmızı örümcek','Çökerten hastalığı','Kül hastalığı'],
  'Biber (kapya)':['Yaprak biti','Thrips','Kırmızı örümcek','Gri küf','Kül hastalığı'],
  'Patlıcan':['Kırmızı örümcek','Yaprak biti','Beyaz sinek','Fusarium solgunluk','Gri küf (Botrytis)'],
  'Salatalık':['Kırmızı örümcek','Beyaz sinek','Thrips','Külleme (Sphaerotheca)','Mildiyö (Pseudoperonospora)','Gri küf'],
  'Patates':['Mildiyö (Phytophthora infestans)','Alternaria yaprak yanıklığı','Colorado böceği (Leptinotarsa)','Kök ur nematodu','Rizoctonia'],
  'Pamuk':['Pembe kurdela (Pectinophora gossypiella)','Beyaz sinek (Bemisia tabaci)','Yaprak biti','Kırmızı örümcek','Fusarium ve Verticillium solgunluk'],
  'Zeytin (Yağlık — Ayvalık)':['Zeytin sineği (Bactrocera oleae)','Zeytin güvesi (Prays oleae)','Antraknoz (Colletotrichum acutatum)','Halkalı leke (Spilocaea oleagina)'],
  'Elma':['Elma içkurdu (Cydia pomonella)','Ateş yanıklığı (Erwinia amylovora)','Karaleke (Venturia inaequalis)','Külleme (Podosphaera leucotricha)','Elma yaprak biti (Aphis pomi)'],
  'Portakal':['Akdeniz meyve sineği (Ceratitis capitata)','Turunçgil yaprak piresi (Aphis citricola)','Unlu bit (Planococcus citri)','Gri küf (Botrytis)','Turunçgil uyuzu'],
  'default':['Yaprak bitleri (Aphididae)','Kırmızı örümcek (Tetranychus urticae)','Beyaz sinek (Trialeurodes/Bemisia)','Kök ve kök boğazı çürüklükleri','Kül hastalığı (Erysiphe spp.)','Gri küf (Botrytis cinerea)']
};

const SOIL_FC = {killiTin:105, tinli:85, killi:120, kumlu:48, humuslu:95, kalkerli:68};
const SOIL_FC_DEEP = {killiTin:118, tinli:95, killi:135, kumlu:52, humuslu:105, kalkerli:75};

const EVI = {ekim:'🌱',dikim:'🪴',sulama:'💧',gübre:'🧪',ilaç:'🔬',çapa:'⛏️',hasat:'🌾',budama:'✂️',toprak:'🚜',analiz:'📊',yakıt:'⛽',işçilik:'👷',diğer:'📝'};
const EVC = {ekim:'#d8f3dc',dikim:'#d8f3dc',sulama:'#d6eaf8',gübre:'#fef3cd',ilaç:'#e8daef',çapa:'#f0ebe0',hasat:'#d8f3dc',budama:'#fde8d8',toprak:'#eee',analiz:'#fadbd8',yakıt:'#fff3cd',işçilik:'#e8f4fd',diğer:'#f0f0f0'};

// FAO‑56 RZWB parametreleri
const RZWB_SOIL = {
  killiTin: { fcs:105, wps:42, fcd:115, wpd:46 },
  tinli:    { fcs: 85, wps:32, fcd: 95, wpd:36 },
  killi:    { fcs:120, wps:52, fcd:130, wpd:57 },
  kumlu:    { fcs: 48, wps:12, fcd: 52, wpd:13 },
  humuslu:  { fcs: 95, wps:38, fcd:105, wpd:42 },
  kalkerli: { fcs: 68, wps:22, fcd: 75, wpd:24 },
};

const MAD_TABLE = {
  sera:0.35, sebze:0.40, bostanlik:0.45, baklagil:0.50,
  narenciye:0.50, meyve:0.50, endustri:0.55, yembitki:0.55,
  tahil:0.55, zeytin:0.65,
};

// Ürüne göre kök derinlik dağılımı [yüzey, derin]
const ROOT_SPLIT = {
  'Buğday':[0.30,0.70],'Arpa':[0.30,0.70],'Mısır':[0.25,0.75],
  'Çavdar':[0.30,0.70],'Yulaf':[0.30,0.70],'Pirinç':[0.35,0.65],'Çeltik':[0.35,0.65],
  'Tritikale':[0.30,0.70],
  'Domates':[0.35,0.65],'Biber (dolmalık)':[0.40,0.60],'Biber (sivri)':[0.40,0.60],
  'Biber (kapya)':[0.40,0.60],'Patlıcan':[0.38,0.62],'Salatalık':[0.45,0.55],
  'Patates':[0.35,0.65],'Soğan (kuru)':[0.50,0.50],'Soğan (taze)':[0.60,0.40],
  'Sarımsak':[0.55,0.45],'Havuç':[0.35,0.65],'Pancar':[0.35,0.65],
  'Ispanak':[0.65,0.35],'Marul':[0.70,0.30],'Roka':[0.70,0.30],'Kıvırcık':[0.70,0.30],
  'Maydanoz':[0.65,0.35],'Dereotu':[0.65,0.35],'Nane':[0.55,0.45],'Tere':[0.70,0.30],
  'Brokoli':[0.45,0.55],'Karnabahar':[0.45,0.55],'Lahana':[0.45,0.55],
  'Kabak (yaz)':[0.40,0.60],'Kabak (kış)':[0.38,0.62],'Balkabağı':[0.35,0.65],
  'Zucchini':[0.40,0.60],'Acur':[0.42,0.58],'Hıyar (bostanlık)':[0.42,0.58],
  'Bamya':[0.35,0.65],'Pırasa':[0.50,0.50],'Enginar':[0.30,0.70],'Kereviz':[0.45,0.55],
  'Kuşkonmaz':[0.25,0.75],'Turp':[0.60,0.40],'Semizotu':[0.65,0.35],
  'Barbunya (taze)':[0.40,0.60],'Fasulye (taze)':[0.40,0.60],'Bezelye (taze)':[0.40,0.60],
  'Elma':[0.25,0.75],'Armut':[0.25,0.75],'Şeftali':[0.28,0.72],
  'Kayısı':[0.25,0.75],'Kiraz':[0.25,0.75],'Vişne':[0.25,0.75],
  'Erik':[0.28,0.72],'Üzüm':[0.25,0.75],'İncir':[0.22,0.78],'Dut':[0.25,0.75],
  'Nar':[0.25,0.75],'Kivi':[0.28,0.72],'Çilek':[0.55,0.45],'Ayva':[0.25,0.75],
  'Ahududu':[0.40,0.60],'Böğürtlen':[0.40,0.60],'Yaban Mersini':[0.45,0.55],
  'Portakal':[0.22,0.78],'Mandalina':[0.22,0.78],'Limon':[0.22,0.78],
  'Greyfurt':[0.20,0.80],'Bergamot':[0.20,0.80],'Pomelo':[0.20,0.80],'Turunç':[0.20,0.80],
  'Zeytin (Sofralık)':[0.18,0.82],'Zeytin (Yağlık — Ayvalık)':[0.18,0.82],
  'Zeytin (Yağlık — Gemlik)':[0.18,0.82],
  'Pamuk':[0.28,0.72],'Ayçiçeği':[0.25,0.75],'Şeker Pancarı':[0.25,0.75],
  'Kolza':[0.28,0.72],'Tütün':[0.32,0.68],'Keten':[0.30,0.70],'Aspir':[0.28,0.72],'Susam':[0.30,0.70],
  'Nohut':[0.35,0.65],'Kırmızı Mercimek':[0.40,0.60],'Yeşil Mercimek':[0.40,0.60],
  'Fasulye (kuru)':[0.38,0.62],'Bezelye (kuru)':[0.40,0.60],'Bakla':[0.35,0.65],
  'Soya':[0.30,0.70],'Börülce':[0.35,0.65],'Barbunya (kuru)':[0.38,0.62],
  'Yonca':[0.25,0.75],'Korunga':[0.28,0.72],'Fiğ':[0.32,0.68],
  'Çayır Otu':[0.40,0.60],'Mısır Silajı':[0.25,0.75],'Sudan Otu':[0.30,0.70],
  'Karpuz':[0.30,0.70],'Kavun':[0.32,0.68],
  'Sera Domates':[0.38,0.62],'Sera Biber (dolmalık)':[0.42,0.58],
  'Sera Salatalık':[0.45,0.55],'Sera Çilek':[0.58,0.42],
  'Sera Marul':[0.72,0.28],'Sera Roka':[0.72,0.28],'Sera Maydanoz':[0.68,0.32],
};

// Toprak dokusuna göre perkolasyon hızı
const PERC_COEFF = {
  kumlu:0.85, killiTin:0.55, tinli:0.60, killi:0.30, humuslu:0.50, kalkerli:0.45
};

// window üzerine ekle (diğer dosyalarda kullanılabilmesi için)
window.ROOT_SPLIT = ROOT_SPLIT;
window.PERC_COEFF = PERC_COEFF;