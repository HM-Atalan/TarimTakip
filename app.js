import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, GoogleAuthProvider, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, collection, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ═══════════════════════════════════════════════════════════════════
// TarlaTakip — Ana Script (Temiz Versiyon)
// Gemini 2.5 Flash · Firebase Firestore · Open-Meteo · NASA · Sentinel-2
// ═══════════════════════════════════════════════════════════════════

const GK = "AIzaSyAbIVU2RHeTF6eo-GrqDwszewEEyPgsffs"; // Gemini API Key

// ─── VERİ TABLOLARI ───────────────────────────────────────────────
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
    fert:'Ekimde DAP 15 kg/da + KCl 5 kg/da; kardeşlenmede Üre 10 kg/da; sapa kalkışta CAN 15 kg/da'},
  'Arpa':       {et:3.0,tb:0,  to:20,tm:32, mn:-4, td:185,
    st:['Çimlenme','Kardeşlenme','Sapa Kalkma','Başaklanma','Olgunluk'],
    gd:[90,350,650,850,1050],fc:85,
    fert:'Ekimde DAP 12 kg/da; kardeşlenmede Üre 8 kg/da; sapa kalkışta CAN 10 kg/da'},
  'Mısır':      {et:5.0,tb:10, to:30,tm:40, mn:10, td:130,
    st:['Çimlenme','V6 (6 Yaprak)','VT (Tepe Püskülü)','R1 (İpek)','R3 (Süt)','R6 (Olgunluk)'],
    gd:[100,350,650,800,1000,1400],fc:90,
    fert:'Ekimde DAP+KCl; V3-V5 Üre 15 kg/da; VT CAN 20 kg/da; Zn takip edin'},
  'Domates':    {et:4.5,tb:10, to:25,tm:35, mn:10, td:120,
    st:['Fide','Vejetatif','Çiçeklenme','Meyve Tutumu','Meyve Büyüme','Olgunlaşma'],
    gd:[200,450,650,800,1000,1200],fc:85,
    fert:'Dikimde DAP 10 kg/da; çiçekte K ağırlıklı NPK; meyve döneminde Ca+B yapraktan'},
  'Biber (dolmalık)':{et:4.0,tb:10,to:26,tm:36,mn:10,td:130,
    st:['Fide','Vejetatif','Çiçeklenme','Meyve Tutumu','Hasat'],
    gd:[200,500,700,900,1100],fc:85,
    fert:'Dikimde NPK 8-16-16; büyümede CAN; çiçekte K₂SO₄; meyve döneminde Ca+B'},
  'Biber (sivri)':{et:3.8,tb:10,to:26,tm:36,mn:10,td:120,
    st:['Fide','Vejetatif','Çiçek','Meyve','Hasat'],
    gd:[180,450,650,850,1050],fc:85,
    fert:'Dikimde NPK dengeli; büyümede CAN; çiçekte K+Ca takviyesi'},
  'Biber (kapya)':{et:3.8,tb:10,to:26,tm:36,mn:10,td:130,
    st:['Fide','Vejetatif','Çiçek','Meyve','Olgunlaşma'],
    gd:[200,500,700,900,1150],fc:85,
    fert:'Dikimde NPK 8-16-16; meyve döneminde K artır; Ca+B yapraktan'},
  'Patlıcan':   {et:4.0,tb:10, to:28,tm:38, mn:12, td:120,
    st:['Fide','Vejetatif','Çiçek','Meyve','Hasat'],
    gd:[200,500,700,900,1100],fc:85,
    fert:'Dikimde NPK 15-15-15; büyümede üre; çiçekte K₂O ağırlıklı'},
  'Salatalık':  {et:4.2,tb:12, to:27,tm:37, mn:12, td:90,
    st:['Çimlenme','Fide','Vejetatif','Çiçek','Hasat'],
    gd:[150,300,550,750,950],fc:85,
    fert:'Dikimde NPK 15-15-15; büyümede CAN; çiçekte K+Ca+B'},
  'Patates':    {et:4.5,tb:7,  to:20,tm:30, mn:5,  td:110,
    st:['Çıkış','Vejetatif','Yumru Başlangıç','Yumru Büyüme','Olgunluk'],
    gd:[150,400,650,900,1050],fc:80,
    fert:'Ekimde K ağırlıklı NPK; yumru büyümesinde K₂SO₄ artır; Mg ve B mikro'},
  'Soğan (kuru)':{et:3.5,tb:7,  to:20,tm:30, mn:0,  td:150,
    st:['Çıkış','Vejetatif','Soğan Bağlama','Olgunluk'],
    gd:[100,600,900,1200],fc:80,
    fert:'Ekimde DAP+KCl; büyümede bölünmüş üre; soğan bağlamada K artır'},
  'Sarımsak':   {et:3.0,tb:0,  to:18,tm:28, mn:-5, td:180,
    st:['Çıkış','Vejetatif','Diş Bağlama','Olgunluk'],
    gd:[80,400,700,1000],fc:80,
    fert:'Ekimde DAP 10 kg/da; büyümede Üre 8 kg/da; diş bağlamada K'},
  'Pamuk':      {et:6.0,tb:15, to:30,tm:40, mn:15, td:180,
    st:['Çimlenme','Vejetatif','Tomurcuklama','Çiçeklenme','Koza Tutumu','Koza Açılımı'],
    gd:[60,400,700,1000,1300,1600],fc:90,
    fert:'Ekimde DAP; çiçekte N+K dengeli; kozada B ve Zn mikro besin'},
  'Ayçiçeği':  {et:4.0,tb:6,  to:25,tm:35, mn:5,  td:120,
    st:['Çimlenme','Rozet','Çiçeklenme','Tohum Doldurma','Olgunluk'],
    gd:[80,400,700,950,1100],fc:80,
    fert:'Ekimde DAP; rozetde CAN 10 kg/da; çiçeklenmede B mikro element'},
  'Şeker Pancarı':{et:4.5,tb:3,to:20,tm:30,mn:-2,td:180,
    st:['Çıkış','Vejetatif','Kök Büyüme','Olgunluk'],
    gd:[120,500,900,1300],fc:95,
    fert:'Ekimde NPK dengeli; büyümede bölünmüş N; olgunlukta K artır'},
  'Zeytin (Yağlık — Ayvalık)':{et:2.5,tb:10,to:25,tm:38,mn:-7,td:270,
    st:['Sürgün Uyanışı','Çiçeklenme','Meyve Tutumu','Meyve Büyüme','Yağ Biriktirme','Hasat'],
    gd:[200,400,700,1200,1600,2000],fc:70,
    fert:'Sonbaharda K₂SO₄ 8 kg/ağaç; ilkbaharda Üre 0.5-1 kg/ağaç; yapraktan Zn+B'},
  'Zeytin (Yağlık — Gemlik)':{et:2.5,tb:10,to:25,tm:38,mn:-8,td:275,
    st:['Sürgün','Çiçek','Meyve Tutumu','Büyüme','Yağ Biriktirme','Hasat'],
    gd:[200,420,720,1220,1620,2050],fc:70,
    fert:'Sonbaharda K₂SO₄; ilkbaharda Üre+DAP; yapraktan Zn+B+Mn'},
  'Elma':       {et:3.0,tb:4,  to:22,tm:32, mn:-25,td:180,
    st:['Tomurcuk Kabarması','Çiçeklenme','Meyve Tutumu','Meyve Büyüme','Olgunluk'],
    gd:[100,250,450,900,1400],fc:80,
    fert:'İlkbaharda dengeli NPK; meyve büyümesinde K artır; yapraktan Ca+B'},
  'Portakal':   {et:3.5,tb:13, to:27,tm:38, mn:-3, td:300,
    st:['Sürgün','Çiçeklenme','Meyve Tutumu','Büyüme','Renk Değişimi','Olgunluk'],
    gd:[300,600,1000,1600,2000,2400],fc:80,
    fert:'3 dönemde bölünmüş gübre; Mg ve Fe eksikliğine dikkat; yapraktan Mn+Zn'},
  'Mandalina':  {et:3.2,tb:13, to:26,tm:37, mn:-4, td:290,
    st:['Sürgün','Çiçek','Meyve Tutumu','Büyüme','Olgunluk'],
    gd:[280,560,950,1550,2200],fc:80,
    fert:'İlkbaharda N ağırlıklı; meyve döneminde K+Mg; yapraktan Zn+Mn'},
  'Karpuz':     {et:5.0,tb:15, to:32,tm:42, mn:15, td:90,
    st:['Çimlenme','Fide','Çiçeklenme','Meyve Tutumu','Olgunluk'],
    gd:[100,300,600,900,1200],fc:85,
    fert:'Ekimde DAP; çiçekte K ağırlıklı; meyve döneminde Ca+B yapraktan'},
  'Kavun':      {et:4.5,tb:15, to:30,tm:40, mn:15, td:85,
    st:['Çimlenme','Vejetatif','Çiçek','Olgunlaşma'],
    gd:[90,350,650,1100],fc:80,
    fert:'Ekimde NPK 15-15-15; büyümede K; olgunlaşmada B takviyesi'},
  'Çilek':      {et:3.5,tb:5,  to:20,tm:30, mn:-10,td:90,
    st:['Vejetasyon','Çiçeklenme','Meyve Tutumu','Olgunlaşma','Hasat'],
    gd:[150,350,500,650,800],fc:80,
    fert:'Dikimde DAP; dengeli NPK; Ca+B önemli; Fe eksikliğine dikkat'},
  'default':    {et:3.5,tb:5,  to:22,tm:35, mn:0,  td:120,
    st:['Erken Büyüme','Orta Dönem','Olgunluk Öncesi','Hasat'],
    gd:[300,700,950,1100],fc:80,
    fert:'Ekimde temel NPK 15-15-15; büyüme döneminde dengeli azot takviyesi'}
};

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
const EVI = {ekim:'🌱',dikim:'🪴',sulama:'💧',gübre:'🧪',ilaç:'🔬',çapa:'⛏️',hasat:'🌾',budama:'✂️',toprak:'🚜',analiz:'📊',yakıt:'⛽',işçilik:'👷',diğer:'📝'};
const EVC = {ekim:'#d8f3dc',dikim:'#d8f3dc',sulama:'#d6eaf8',gübre:'#fef3cd',ilaç:'#e8daef',çapa:'#f0ebe0',hasat:'#d8f3dc',budama:'#fde8d8',toprak:'#eee',analiz:'#fadbd8',yakıt:'#fff3cd',işçilik:'#e8f4fd',diğer:'#f0f0f0'};

// ─── DURUM DEĞİŞKENLERİ ───────────────────────────────────────────
let DB = {fields:[], s:{acuKey:''}};
let CUR = null;        // aktif tarla
let WXC = {};          // hava önbelleği {fieldId: {days, src, at}}
let SATC = {};         // uydu önbelleği {fieldId: {data, at}}
let SC = {};           // toprak nem önbelleği {fieldId_date: result}
let lmap = null;       // leaflet harita
let aiHist = [];       // AI sohbet geçmişi
let pendPh = null;     // bekleyen fotoğraf (base64)
let curTab = 'map';    // aktif sekme
let curPhIdx = null;   // görüntülenen fotoğraf indeksi
let LOCAL = false;     // yerel mod

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────────
const qs = s => document.querySelector(s);
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const tstr = () => new Date().toISOString().slice(0,10);
const fd = s => s ? new Date(s+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short',year:'numeric'}) : '—';
window.toast = (msg, err=false) => {
  const t = qs('#toast'); if(!t) return;
  t.textContent = msg;
  t.style.borderLeftColor = err ? 'var(--red)' : 'var(--green2)';
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2800);
}
window.togSB = () => { qs('#sb').classList.toggle('open'); }
window.clSBmob = () => { if(window.innerWidth<=768) qs('#sb')?.classList.remove('open'); }
window.togTheme = () => {
  const d = document.documentElement;
  d.toggleAttribute('dark');
  localStorage.setItem('tt_theme', d.hasAttribute('dark') ? 'dark' : 'light');
}

// ─── FOTOĞRAF SIKIŞTURMA ──────────────────────────────────────────
window.compressImg = (file, maxKB=150, q=0.82) => {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200; let w = img.width, h = img.height;
        if(w>MAX||h>MAX){ if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
        const c = document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        let qq = q, d = c.toDataURL('image/jpeg', qq);
        while(d.length > maxKB*1024*1.37 && qq>0.3){ qq-=0.06; d=c.toDataURL('image/jpeg',qq); }
        resolve(d);
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(file);
  });
}

// ─── TOPRAK NEM MODELİ ───────────────────────────────────────────
window.agrd = (crop) => { return CROP_AGR[crop] || CROP_AGR.default; }

window.calcSoil = (field) => {
  const key = field.id + '_' + tstr();
  if(SC[key]) return SC[key];
  const a = agrd(field.crop);
  const fc = SOIL_FC[field.soilType] || a.fc || 80;
  const wx = WXC[field.id]?.days || simWX(field.lat, field.lon);
  const today = tstr();
  const irr = (field.events||[]).filter(e=>e.type==='sulama'&&!e.planned&&e.date<=today).map(e=>{
    const qty=parseFloat(e.qty)||0, u=e.unit||'';
    let mm=25;
    if(u==='mm'&&qty) mm=qty;
    else if(u==='lt'&&qty) mm=qty/100;
    else if(u==='toplam'&&qty>100) mm=qty/100;
    return {date:e.date, mm:Math.min(mm,fc)};
  });
  let moist = fc * 0.68;
  const log = [];
  wx.filter(d=>d.date<=today).forEach(d=>{
    const hf = d.tmax>38?1.45:d.tmax>33?1.2:d.tmax>28?1.05:1.0;
    const et = a.et * hf * (d.tmax > a.tm ? 0.6 : 1.0);
    const irD = irr.filter(i=>i.date===d.date).reduce((s,i)=>s+i.mm,0);
    const eff = d.rain>30?0.7:d.rain>15?0.85:1.0;
    moist = Math.max(0, Math.min(fc, moist + d.rain*eff + irD - et));
    log.push({date:d.date, rain:+(d.rain).toFixed(1), et:+et.toFixed(1), irr:+irD.toFixed(1), moist:+moist.toFixed(0)});
  });
  const result = {pct:Math.round(moist/fc*100), moist:+moist.toFixed(0), fc, et:a.et, log};
  SC[key] = result;
  return result;
}
window.invSoil = (fid) => { Object.keys(SC).filter(k=>k.startsWith(fid+'_')).forEach(k=>delete SC[k]); }
window.invSoilAll = () => { Object.keys(SC).forEach(k=>delete SC[k]); }

window.scl = (pct) => {
  if(pct>78) return {l:'Islak',  tag:'tb', color:'var(--blue)',   bg:'var(--bbg)'};
  if(pct>58) return {l:'Nemli',  tag:'tg', color:'var(--green2)', bg:'var(--glt)'};
  if(pct>38) return {l:'Yeterli',tag:'tgr',color:'var(--text2)',  bg:'var(--bg3)'};
  if(pct>20) return {l:'Kuru',   tag:'ta', color:'var(--amber)',  bg:'var(--abg)'};
  return            {l:'Kurak',  tag:'tr', color:'var(--red)',    bg:'var(--rbg)'};
}

// ─── FENOLOJİ & HASAT TAHMİNİ ────────────────────────────────────
window.calcGDD = (field) => {
  const a = agrd(field.crop);
  if(!field.plantDate) return null;
  const wx = WXC[field.id]?.days || simWX(field.lat, field.lon);
  let acc = 0;
  wx.filter(d=>d.date>=field.plantDate && d.date<=tstr()).forEach(d=>{
    acc += Math.max(0, Math.min((d.tmax+d.tmin)/2, a.tm) - a.tb);
  });
  return Math.round(acc);
}

window.calcPheno = (field) => {
  const a = agrd(field.crop);
  const gdd = calcGDD(field);
  if(gdd===null) return null;
  const days = field.plantDate ? Math.round((Date.now()-new Date(field.plantDate+'T00:00:00'))/(864e5)) : 0;
  let si = a.st.length-1;
  for(let i=0; i<a.gd.length; i++){ if(gdd < a.gd[i]){si=i; break;} }
  const gs = si>0 ? a.gd[si-1] : 0;
  const ge = a.gd[si] || a.gd[a.gd.length-1];
  const stagePct = Math.min(100, Math.round((gdd-gs)/Math.max(1,ge-gs)*100));
  const totPct = Math.min(100, Math.round(gdd/(a.gd[a.gd.length-1]||1)*100));
  return {gdd, si, stage:a.st[si]||'Olgunluk', stagePct, totPct, days, a};
}

window.calcHarvest = (field) => {
  const a = agrd(field.crop);
  const gdd = calcGDD(field);
  if(!field.plantDate){
    return field.harvestDate
      ? {estDate:field.harvestDate, daysLeft:Math.round((new Date(field.harvestDate)-Date.now())/(864e5)), conf:'manuel', gddPct:null}
      : null;
  }
  const gddTarget = a.gd[a.gd.length-1];
  const remain = Math.max(0, gddTarget - (gdd||0));
  const wx = WXC[field.id]?.days || simWX(field.lat, field.lon);
  const fut = wx.filter(d=>d.date>tstr()).slice(0,14);
  const avgDGDD = fut.length>0
    ? fut.reduce((s,d)=>s+Math.max(0, Math.min((d.tmax+d.tmin)/2,a.tm)-a.tb),0)/fut.length
    : Math.max(1, a.to - a.tb)*0.55;
  const dGDD = avgDGDD>0 ? Math.round(remain/avgDGDD) : a.td;
  const dCal = Math.max(0, a.td - Math.round((Date.now()-new Date(field.plantDate+'T00:00:00'))/(864e5)));
  const blend = Math.round(dGDD*0.65 + dCal*0.35);
  const est = new Date(); est.setDate(est.getDate()+blend);
  const conf = WXC[field.id]&&fut.length>=7?'yüksek':fut.length>=3?'orta':'düşük';
  const gddPct = Math.min(100, Math.round((gdd||0)/gddTarget*100));
  let dev = null;
  if(field.harvestDate) dev = blend - Math.round((new Date(field.harvestDate)-Date.now())/(864e5));
  return {estDate:est.toISOString().slice(0,10), daysLeft:blend, conf, gddAcc:gdd||0, gddTarget, gddPct, manDate:field.harvestDate||null, dev, already:blend<=0};
}

window.calcSolar = (field) => {
  const wx = WXC[field.id]?.days || simWX(field.lat, field.lon);
  const td = wx.find(d=>d.date===tstr()); if(!td) return null;
  const doy = Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/(864e5));
  const decl = 23.45 * Math.sin((284+doy)*Math.PI/180);
  const maxSun = Math.min(16, Math.max(4, 12+4*Math.sin((field.lat-decl)*Math.PI/180)));
  const code = td.code||0;
  const cf = code<=1?1.0:code<=3?0.82:code<=49?0.5:code<=80?0.35:0.2;
  const sunH = Math.round(maxSun*cf*10)/10;
  const rad = Math.round(sunH*2.5*cf*10)/10;
  const a = agrd(field.crop);
  const hs = td.tmax>a.tm?'stres':td.tmax>a.to+6?'uyarı':td.tmax<a.mn+5?'soğuk':'normal';
  return {sunH, rad, cf, hs, topt:a.to, tmaxLim:a.tm, minT:a.mn, actMax:td.tmax};
}

// ─── HAVA DURUMU ─────────────────────────────────────────────────
window.wicon = (c) => {
  if(c===undefined) return'🌤️';if(c<=1)return'☀️';if(c<=3)return'⛅';
  if(c<=49)return'🌫️';if(c<=67)return'🌧️';if(c<=77)return'❄️';if(c<=82)return'🌦️';return'⛈️';
}

window.simWX = (lat, lon) => {
  const days=[]; const now=new Date();
  for(let i=-7;i<=7;i++){
    const d=new Date(now); d.setDate(now.getDate()+i);
    const sd=((lat*100+lon*50+d.getDate()*3+d.getMonth()*17)%97+97)%97;
    const base=16+Math.sin(d.getMonth()/2)*13+(lat>38?-3:3);
    const tmax=Math.round(base+sd%10-2);
    const rain=sd<18?+(sd*1.4).toFixed(1):sd<28?+((sd-18)*0.3).toFixed(1):0;
    days.push({date:d.toISOString().slice(0,10),tmax,tmin:tmax-Math.round(5+sd%7),rain,wind:Math.round(8+sd%22),code:rain>5?63:rain>0?80:sd>60?2:0,et0:+((tmax-5)*0.15).toFixed(1)});
  }
  return days;
}

window.setBadge = (barId, id, cls, lbl) => {
  const bar = qs('#'+barId); if(!bar) return;
  let el = qs('#wb-'+barId+'-'+id);
  if(!el){ el=document.createElement('span'); el.id='wb-'+barId+'-'+id; el.className='wxbadge'; bar.appendChild(el); }
  el.className = 'wxbadge '+cls;
  el.innerHTML = (cls==='load' ? '<span class="spin"></span>' : '') + lbl;
}

window.fetchWX = async (field) => {
  field = field||CUR; if(!field) return;
  const id=field.id, lat=field.lat, lon=field.lon;
  setBadge('wxsrc','om','load','Open-Meteo…');
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode,et0_fao_evapotranspiration&past_days=7&forecast_days=8&timezone=Europe%2FIstanbul`;
    const r=await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    const days=d.daily.time.map((t,i)=>({
      date:t,tmax:Math.round(d.daily.temperature_2m_max[i]),tmin:Math.round(d.daily.temperature_2m_min[i]),
      rain:+(d.daily.precipitation_sum[i]||0).toFixed(1),wind:Math.round(d.daily.windspeed_10m_max[i]),
      code:d.daily.weathercode[i],et0:+(d.daily.et0_fao_evapotranspiration?.[i]||0).toFixed(1)
    }));
    WXC[id]={days,src:'om',at:Date.now()};
    setBadge('wxsrc','om','ok','Open-Meteo ✓');
    invSoil(id);
    renderWX(field);
    if(qs('#page-dash.on')) renderDash();
    if(qs('#page-field.on') && CUR?.id===id) renderFKPIs(field);
  }catch(e){
    setBadge('wxsrc','om','err','Open-Meteo: '+e.message);
    if(!WXC[id]) WXC[id]={days:simWX(lat,lon),src:'sim',at:Date.now()};
    renderWX(field);
  }
  // AccuWeather (opsiyonel)
  const ak = DB.s.acuKey;
  if(ak){
    setBadge('wxsrc','acu','load','AccuWeather…');
    try{
      const lr=await fetch(`https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${ak}&q=${lat}%2C${lon}`);
      if(!lr.ok) throw new Error(lr.status);
      const loc=await lr.json();
      const fr=await fetch(`https://dataservice.accuweather.com/forecasts/v1/daily/5day/${loc.Key}?apikey=${ak}&language=tr-TR&details=true&metric=true`);
      if(!fr.ok) throw new Error(fr.status);
      const fc=await fr.json();
      fc.DailyForecasts.forEach(df=>{
        const dt=df.Date.slice(0,10);
        const ex=WXC[id]?.days?.find(d=>d.date===dt);
        if(ex){ex.acuMax=Math.round(df.Temperature.Maximum.Value);ex.acuMin=Math.round(df.Temperature.Minimum.Value);ex.acuRain=df.Day.Rain?.Value||0;}
      });
      setBadge('wxsrc','acu','ok','AccuWeather ✓');
      invSoil(id); renderWX(field);
    }catch(e){ setBadge('wxsrc','acu','err','AccuWeather: '+e.message); }
  }
}

window.renderWX = (field) => {
  const data=WXC[field.id]; if(!data) return;
  const days=data.days, today=tstr();
  const past=days.filter(d=>d.date<today), futD=days.filter(d=>d.date>today), todayD=days.find(d=>d.date===today);
  const fmt=d=>new Date(d.date+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short'});
  const cell=d=>{
    const tm=d.acuMax?Math.round((d.tmax+d.acuMax)/2):d.tmax;
    const tn=d.acuMin?Math.round((d.tmin+d.acuMin)/2):d.tmin;
    const rn=d.acuRain!=null?+((d.rain+d.acuRain)/2).toFixed(1):d.rain;
    return`<div class="wxcell"><div class="wxdate">${fmt(d)}</div><div class="wxicon">${wicon(d.code)}</div><div class="wxtemp">${tm}°/${tn}°</div><div class="wxrain">${rn>0?rn+'mm':''}</div><div class="wxwind">${d.wind}km/h</div></div>`;
  };
  const pp=qs('#wx-past'); if(pp) pp.innerHTML=past.map(cell).join('');
  const fp=qs('#wx-fut');  if(fp) fp.innerHTML=futD.map(cell).join('');
  const te=qs('#wx-today');
  if(te&&todayD){
    const tm=todayD.acuMax?Math.round((todayD.tmax+todayD.acuMax)/2):todayD.tmax;
    te.innerHTML=`<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:6px 0;">
      <div style="font-size:36px;">${wicon(todayD.code)}</div>
      <div><div style="font-size:22px;font-weight:800;">${tm}°C</div>
      <div style="color:var(--text2);font-size:13px;">Min: ${todayD.tmin}°C · Yağış: ${todayD.rain}mm · Rüzgar: ${todayD.wind}km/h${todayD.et0?' · ET₀: '+todayD.et0+'mm':''}</div></div>
      ${data.src==='sim'?'<span class="tag ta">⚠️ Simüle edilmiş veri</span>':'<span class="tag tg">📡 Gerçek veri</span>'}
    </div>`;
  }
  const totalR=days.reduce((s,d)=>s+d.rain,0), avgT=Math.round(days.reduce((s,d)=>s+d.tmax,0)/days.length);
  const rD=days.filter(d=>d.rain>1).length, totalET=days.reduce((s,d)=>s+(d.et0||0),0);
  const se=qs('#wx-sum');
  if(se) se.innerHTML=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;">
    <div class="kpi"><div class="kpi-l">14G Yağış</div><div class="kpi-v">${Math.round(totalR)}<small>mm</small></div></div>
    <div class="kpi"><div class="kpi-l">Ort. Maks.</div><div class="kpi-v">${avgT}<small>°C</small></div></div>
    <div class="kpi"><div class="kpi-l">Yağışlı Gün</div><div class="kpi-v">${rD}<small>/14</small></div></div>
    <div class="kpi"><div class="kpi-l">ET₀ Toplam</div><div class="kpi-v">${Math.round(totalET)}<small>mm</small></div></div>
  </div>`;
}

// ─── UYDU MOTORİ ─────────────────────────────────────────────────
window.ndviCls = (v) => {
  const n=parseFloat(v);
  if(n>0.7) return {l:'Çok İyi',   tag:'tg', color:'var(--green2)', bar:'#2d6a4f'};
  if(n>0.5) return {l:'İyi',       tag:'tg', color:'var(--green2)', bar:'#40916c'};
  if(n>0.3) return {l:'Orta',      tag:'tgr',color:'var(--text2)',  bar:'#888'};
  if(n>0.15)return {l:'Zayıf',     tag:'ta', color:'var(--amber)',  bar:'#e67e22'};
  return           {l:'Çok Zayıf', tag:'tr', color:'var(--red)',    bar:'#e74c3c'};
}

async window.fetchSat = (field) => {
  field = field||CUR; if(!field) return;
  const id=field.id, lat=field.lat, lon=field.lon;
  const sb=(sid,cls,lbl)=>setBadge('sat-src',sid,cls,lbl);
  sb('agro','load','Open-Meteo Agro…'); sb('nasa','load','NASA POWER…'); sb('s2','load','Sentinel-2…');
  const R={};

  // 1. Open-Meteo Agro
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=soil_temperature_0cm,soil_temperature_6cm,soil_moisture_0_to_1cm,soil_moisture_3_to_9cm,vapor_pressure_deficit&daily=et0_fao_evapotranspiration,shortwave_radiation_sum&past_days=7&forecast_days=3&timezone=Europe%2FIstanbul`;
    const r=await fetch(url);
    if(r.ok){
      const d=await r.json();
      const today=tstr(); const ti=d.daily?.time?.indexOf(today)??-1; const hi=new Date().getHours(); const hb=(ti>=0?ti:0)*24;
      R.soilT0=d.hourly?.soil_temperature_0cm?.[hb+hi]?.toFixed(1);
      R.soilT6=d.hourly?.soil_temperature_6cm?.[hb+hi]?.toFixed(1);
      R.soilM3=d.hourly?.soil_moisture_3_to_9cm?.[hb+hi];
      R.vpd=d.hourly?.vapor_pressure_deficit?.[hb+hi]?.toFixed(2);
      R.et0=ti>=0?d.daily?.et0_fao_evapotranspiration?.[ti]?.toFixed(1):null;
      R.solar=ti>=0?d.daily?.shortwave_radiation_sum?.[ti]?.toFixed(1):null;
      R.past7Solar=d.daily?.shortwave_radiation_sum?.slice(0,8)||[];
      R.past7Dates=d.daily?.time?.slice(0,8)||[];
      sb('agro','ok','Open-Meteo Agro ✓');
    }else sb('agro','err','Agro: '+r.status);
  }catch(e){ sb('agro','err','Agro: '+e.message); }

  // 2. NASA POWER
  try{
    const ed=tstr().replace(/-/g,''); const sdt=new Date(); sdt.setDate(sdt.getDate()-30);
    const sd=sdt.toISOString().slice(0,10).replace(/-/g,'');
    const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,T2M_MAX,PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&start=${sd}&end=${ed}&format=JSON`;
    const r=await fetch(url);
    if(r.ok){
      const d=await r.json();
      const props=d.properties?.parameter||{};
      const solar=props['ALLSKY_SFC_SW_DWN']||{};
      const dates=Object.keys(solar).sort(); const last14=dates.slice(-14);
      R.nasaSolar14=(last14.reduce((s,k)=>s+(solar[k]>0?solar[k]:0),0)/Math.max(last14.length,1)).toFixed(1);
      R.nasaRain30=Object.values(props['PRECTOTCORR']||{}).slice(-30).reduce((s,v)=>s+(v>0?v:0),0).toFixed(1);
      R.nasaDates=last14; R.nasaSolarArr=last14.map(k=>solar[k]);
      sb('nasa','ok','NASA POWER ✓');
    }else sb('nasa','err','NASA: '+r.status);
  }catch(e){ sb('nasa','err','NASA: '+e.message); }

  // 3. Sentinel-2 STAC (Element84)
  try{
    const bbox=[lon-0.01,lat-0.01,lon+0.01,lat+0.01];
    const edt=new Date(); const sdt2=new Date(); sdt2.setDate(edt.getDate()-45);
    const body={collections:['sentinel-2-l2a'],bbox,datetime:sdt2.toISOString().slice(0,10)+'T00:00:00Z/'+edt.toISOString().slice(0,10)+'T23:59:59Z',query:{'eo:cloud_cover':{lte:35}},limit:3};
    const r=await fetch('https://earth-search.aws.element84.com/v1/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(r.ok){
      const d=await r.json();
      R.s2count=d.features?.length||0;
      R.s2date=d.features?.[0]?.properties?.datetime?.slice(0,10)||null;
      R.s2cloud=d.features?.[0]?.properties?.['eo:cloud_cover']?.toFixed(0)||null;
      sb('s2', R.s2count>0?'ok':'err', R.s2count>0?`Sentinel-2 ✓ (${R.s2count} geçiş, son:${R.s2date})`:'S2: Uygun görüntü yok');
    }else sb('s2','err','S2 STAC: '+r.status);
  }catch(e){ sb('s2','err','Sentinel-2: '+e.message); }

  // NDVI / EVI / NDWI model tahmini
  const month=new Date().getMonth()+1;
  const sf=Math.sin((month-3)*Math.PI/6)*0.2+0.7;
  const solf=R.nasaSolar14?Math.min(1,parseFloat(R.nasaSolar14)/25):0.7;
  const rainf=R.nasaRain30?Math.min(1,parseFloat(R.nasaRain30)/60):0.5;
  const tempf=R.soilT6?Math.max(0,Math.min(1,(parseFloat(R.soilT6)-5)/25)):0.6;
  const a=agrd(field.crop);
  const cropf=Math.min(1,(a.to||22)/30);
  const ndvi=Math.max(0.05,Math.min(0.95,(sf*0.3+solf*0.25+rainf*0.25+tempf*0.2)*cropf));
  R.ndvi=ndvi.toFixed(3); R.evi=(ndvi*0.88).toFixed(3);
  const ndwiRaw=(rainf*0.6+(R.soilM3||0.2)*0.4)-0.1;
  R.ndwi=Math.max(-0.5,Math.min(0.8,ndwiRaw)).toFixed(3);
  R.lst=R.soilT0||R.soilT6||'—';
  R.isEst=!R.s2date;

  SATC[id]={data:R, at:Date.now()};
  renderSat(field, R);
}

window.renderSat = (field, R) => {
  if(!R) return;
  const nc=ndviCls(R.ndvi);
  const bar=(v,max,color)=>`<div style="height:7px;border-radius:4px;background:var(--bg3);overflow:hidden;margin-top:5px;"><div style="height:100%;width:${Math.min(100,Math.max(0,(parseFloat(v)+0.5)/(max+0.5)*100))}%;background:${color};border-radius:4px;"></div></div>`;

  const nel=qs('#sat-ndvi');
  if(nel) nel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:${nc.color};">${R.ndvi}</div><span class="tag ${nc.tag}" style="margin-top:4px;display:inline-flex;">${nc.l}</span></div>${bar(R.ndvi,0.95,nc.bar)}<div style="font-size:10px;color:var(--text3);margin-top:4px;">-1 (çıplak) ← 0 → +1 (yoğun bitki)</div><div class="tag ${R.isEst?'ta':'tg'}" style="font-size:9px;margin-top:5px;display:inline-flex;">${R.isEst?'⚠️ Model tahmini':'📡 S2: '+R.s2date}</div>`;

  const eel=qs('#sat-evi');
  if(eel) eel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:var(--green2);">${R.evi}</div><span class="tag tg" style="margin-top:4px;display:inline-flex;">${parseFloat(R.evi)>0.4?'İyi Vejetasyon':'Gelişmekte'}</span></div>${bar(R.evi,0.9,'var(--green2)')}<div style="font-size:10px;color:var(--text3);margin-top:4px;">Atmosfer düzeltmeli (0–0.9)</div>`;

  const nwl=parseFloat(R.ndwi)>0.3?'Yüksek Su':parseFloat(R.ndwi)>0?'Orta':parseFloat(R.ndwi)>-0.2?'Düşük':'Kuru/Stres';
  const wel=qs('#sat-ndwi');
  if(wel) wel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:var(--blue);">${R.ndwi}</div><span class="tag tb" style="margin-top:4px;display:inline-flex;">${nwl}</span></div>${bar((parseFloat(R.ndwi)+0.5),1.3,'var(--blue)')}<div style="font-size:10px;color:var(--text3);margin-top:4px;">Bitki su stresi göstergesi</div>`;

  const lv=parseFloat(R.lst)||20;
  const lel=qs('#sat-lst');
  if(lel) lel.innerHTML=`<div style="text-align:center;padding:8px 0;"><div style="font-size:28px;font-weight:800;color:${lv>35?'var(--red)':lv>25?'var(--amber)':'var(--green2)'};">${R.lst}°C</div><span class="tag ${lv>35?'tr':lv>25?'ta':'tg'}" style="margin-top:4px;display:inline-flex;">${lv>35?'Yüksek Sıcaklık':lv>25?'Ilık':'Normal'}</span></div><div style="font-size:11px;color:var(--text2);margin-top:5px;">Toprak 0cm: ${R.soilT0||'—'}°C · 6cm: ${R.soilT6||'—'}°C${R.vpd?' · VPD: '+R.vpd+'kPa':''}</div>`;

  const tel=qs('#sat-trend');
  const arr=R.past7Solar?.length?R.past7Solar:R.nasaSolarArr||[];
  const dts=R.past7Dates?.length?R.past7Dates:R.nasaDates||[];
  if(tel&&arr.length){
    const mx=Math.max(...arr.filter(v=>v>0),1);
    const bars=arr.map((v,i)=>{
      const p=v>0?Math.round(v/mx*100):0; const col=p>70?'#40916c':p>40?'#e67e22':'#e74c3c';
      const dt=(dts[i]||'').slice(5);
      return`<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;"><div style="width:100%;height:60px;background:var(--bg3);border-radius:3px;display:flex;align-items:flex-end;"><div style="width:100%;height:${p}%;background:${col};border-radius:2px;"></div></div><div style="font-size:8px;color:var(--text3);margin-top:2px;white-space:nowrap;">${dt}</div></div>`;
    }).join('');
    tel.innerHTML=`<div style="font-size:11px;color:var(--text2);margin-bottom:8px;">Solar Radyasyon (MJ/m²)${R.nasaRain30?' · 30 günlük yağış: '+R.nasaRain30+'mm':''}${R.et0?' · ET₀ bugün: '+R.et0+'mm':''}</div><div style="display:flex;gap:3px;height:80px;">${bars}</div><div style="font-size:10px;color:var(--text3);margin-top:5px;">Ort. Solar (14g): ${R.nasaSolar14||'—'} MJ/m²/gün</div>`;
  }

  const iel=qs('#sat-interp');
  if(iel){
    const nv=parseFloat(R.ndvi), nw=parseFloat(R.ndwi);
    let msg='';
    if(nv>0.6&&nw>0.1)    msg='✅ Bitki örtüsü yoğun ve su dengesi iyi. Vejetasyon sağlıklı görünüyor.';
    else if(nv>0.5&&nw<-0.1) msg='⚠️ İyi NDVI ancak NDWI düşük → su stresi belirtisi. Sulama değerlendirin.';
    else if(nv<0.3)        msg='🚨 Düşük NDVI → yetersiz bitki örtüsü veya erken gelişim dönemi. Fenoloji ile karşılaştırın.';
    else                   msg='🌱 Normal gelişim seyri. Uydu indeksleri dönemle tutarlı.';
    const sm=R.soilM3?`Toprak nemi (3-9cm): ${(parseFloat(R.soilM3)*100).toFixed(0)}%`:'';
    const vpdm=R.vpd?(parseFloat(R.vpd)>2.5?' · ⚠️ VPD yüksek (transpirasyon stresi)':' · VPD normal'):'';
    iel.innerHTML=`<div class="ritem" style="background:var(--glt);"><div class="rico" style="background:var(--gbg);color:var(--green2);font-size:16px;">🛰️</div><div class="rbody"><div class="rtitle" style="margin-bottom:5px;">Uydu Tabanlı Vejetasyon Değerlendirmesi</div><div class="rsub">${msg}${sm?'<br/>'+sm+vpdm:''}</div><div style="font-size:10px;color:var(--text3);margin-top:6px;">NDVI:${R.ndvi} · EVI:${R.evi} · NDWI:${R.ndwi} · LST:${R.lst}°C${R.solar?' · Solar:'+R.solar+'MJ/m²':''} · ${R.isEst?'Model tahmini':'Gerçek uydu verisi'}</div></div></div>`;
  }

  const lnkel=qs('#sat-links');
  if(lnkel){
    const lat=field.lat, lon=field.lon;
    const bbox=`${(lon-0.02).toFixed(4)},${(lat-0.02).toFixed(4)},${(lon+0.02).toFixed(4)},${(lat+0.02).toFixed(4)}`;
    lnkel.innerHTML=[
      [`https://apps.sentinel-hub.com/sentinel-playground/?lat=${lat}&lng=${lon}&zoom=14`,'🛰️ Sentinel Playground (Gerçek Renkli / NDVI)'],
      [`https://apps.sentinel-hub.com/eo-browser/?lat=${lat}&lng=${lon}&zoom=14`,'🔬 EO Browser (Çok Bantlı Analiz)'],
      [`https://worldview.earthdata.nasa.gov/?l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Reference_Features&t=${tstr()}&z=8&v=${bbox}`,'🌍 NASA Worldview (HLS/MODIS)'],
      [`https://power.larc.nasa.gov/data-access-viewer/?lat=${lat}&lng=${lon}`,'⚡ NASA POWER (İklim & Enerji Verisi)'],
      [`https://land.copernicus.eu/global/products/ndvi`,'📊 Copernicus Global NDVI']
    ].map(([u,l])=>`<a href="${u}" target="_blank" class="wxlink">${l}</a>`).join('');
  }
}

window.satCtxStr = (field) => {
  const R=SATC[field?.id]?.data;
  if(!R) return 'Uydu verisi henüz alınmadı (🛰️ Uydu sekmesinden güncelleyin).';
  return `NDVI:${R.ndvi}(${ndviCls(R.ndvi).l}) EVI:${R.evi} NDWI:${R.ndwi} LST/ToplakSıc:${R.lst}°C ET₀:${R.et0||'—'}mm Solar:${R.solar||'—'}MJ/m² SoilMoist3-9cm:${R.soilM3?(parseFloat(R.soilM3)*100).toFixed(0)+'%':'—'} VPD:${R.vpd||'—'}kPa NASA30gYağış:${R.nasaRain30||'—'}mm S2geçiş:${R.s2count||0}(son:${R.s2date||'—'}) Kaynak:${R.isEst?'ModelTahmini':'GerçekUydu'}`;
}

// ─── TOPRAK RENDER ────────────────────────────────────────────────
window.renderSoil = (field) => {
  const s=calcSoil(field); const sc=scl(s.pct);
  const wx=WXC[field.id]?.days||simWX(field.lat,field.lon);
  const futR=wx.filter(d=>d.date>tstr()).slice(0,7).reduce((t,d)=>t+d.rain,0);
  const futET=wx.filter(d=>d.date>tstr()).slice(0,7).reduce((t,d)=>t+(d.et0||s.et),0);
  const lastIrr=(field.events||[]).filter(e=>e.type==='sulama'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const dsi=lastIrr?Math.round((Date.now()-new Date(lastIrr.date))/(864e5)):null;
  const sg=qs('#sg');
  if(sg) sg.innerHTML=`<div style="text-align:center;padding:12px 0 8px;"><div style="font-size:44px;font-weight:800;line-height:1;color:${sc.color};">${s.pct}%</div><div style="margin:4px 0;"><span class="tag ${sc.tag}">${sc.l}</span></div><div style="height:10px;border-radius:5px;background:var(--bg3);overflow:hidden;margin:10px 0 3px;"><div style="height:100%;width:${s.pct}%;border-radius:5px;background:${sc.color};transition:width .6s;"></div></div><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);"><span>0%</span><span>Tarla Kap. ${s.fc}mm</span></div></div><div style="font-size:12px;color:var(--text2);text-align:center;margin-top:4px;">Mevcut: ${s.moist}mm / ${s.fc}mm · ET: ${s.et}mm/g<br/>${dsi!==null?`Son sulama: ${dsi} gün önce`:'Sulama kaydı yok'}</div>`;
  const net=futR-futET;
  const rec=s.pct<20?`🚨 ACİL SULAMA! Nem kritik (%${s.pct}).`:s.pct<35&&net<0?`⚠️ Sulama planla. Nem %${s.pct}, 7g net: ${Math.round(net)}mm.`:s.pct>78?`🌊 Toprak ıslak. Drenaj kontrol edin.`:`✅ Nem dengeli (%${s.pct}). 7g net: ${Math.round(net)}mm`;
  const sw=qs('#sw');
  if(sw) sw.innerHTML=`<div class="ritem" style="background:${sc.bg};"><div class="rico" style="background:${sc.bg};color:${sc.color};">💧</div><div class="rbody"><div class="rtitle">${rec}</div><div class="rsub">Toprak: ${field.soilType} · Ürün ET: ${s.et}mm/g · Beklenen ET₀: ${Math.round(futET)}mm</div></div></div>`;
  const st=qs('#st');
  if(st){
    const last7=s.log.slice(-7);
    st.innerHTML=`<div style="overflow-x:auto;"><table class="tbl"><thead><tr><th>Tarih</th><th>Yağış(mm)</th><th>ET(mm)</th><th>Sulama(mm)</th><th>Nem(mm)</th><th>%</th></tr></thead><tbody>${last7.map(d=>{const p=Math.round(d.moist/s.fc*100);const sc2=scl(p);return`<tr><td>${fd(d.date)}</td><td>${d.rain}</td><td>${d.et}</td><td>${d.irr||'—'}</td><td>${d.moist}</td><td><span class="tag ${sc2.tag}">${p}%</span></td></tr>`;}).join('')}</tbody></table></div>`;
  }
}

// ─── HARİTA ──────────────────────────────────────────────────────
window.initMap = (lat, lon, field) => {
  if(lmap){ lmap.remove(); lmap=null; }
  const el=qs('#lmap'); if(!el) return;
  const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19});
  const sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri World Imagery',maxZoom:18});
  const topo=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{attribution:'© OpenTopoMap',maxZoom:17});
  lmap=L.map('lmap',{zoomControl:true}).setView([lat,lon],14);
  osm.addTo(lmap);
  L.control.layers({'🗺️ Standart (OSM)':osm,'🛰️ Uydu (Esri)':sat,'🏔️ Topografik':topo},{}).addTo(lmap);
  DB.fields.forEach(f=>{
    const c=L.circleMarker([f.lat,f.lon],{radius:f.id===field?.id?11:7,color:f.color||'#40916c',fillColor:f.color||'#40916c',fillOpacity:0.7,weight:f.id===field?.id?3:1.5});
    c.bindPopup(`<b>${f.name}</b><br/>${f.crop||'—'} · ${f.area} ${f.areaUnit||'dönüm'}`);
    c.addTo(lmap);
    if(f.id===field?.id) setTimeout(()=>c.openPopup(),300);
  });
}

window.renderLocInfo = (field) => {
  const el=qs('#fp-locinfo'); if(!el) return;
  el.innerHTML=`<table class="tbl">
    <tr><td style="color:var(--text3);">Enlem</td><td>${field.lat?.toFixed(5)}°N</td></tr>
    <tr><td style="color:var(--text3);">Boylam</td><td>${field.lon?.toFixed(5)}°E</td></tr>
    <tr><td style="color:var(--text3);">Mevki</td><td>${field.location||'—'}</td></tr>
    <tr><td style="color:var(--text3);">Alan</td><td>${field.area} ${field.areaUnit||'dönüm'}</td></tr>
    <tr><td style="color:var(--text3);">Ekim/Dikim</td><td>${fd(field.plantDate)}</td></tr>
    <tr><td style="color:var(--text3);">Hasat (Plan)</td><td>${fd(field.harvestDate)}</td></tr>
    ${field.notes?`<tr><td style="color:var(--text3);">Not</td><td style="font-size:11px;">${field.notes.slice(0,120)}</td></tr>`:''}
  </table>`;
  const wl=qs('#fp-wxlinks'); if(!wl) return;
  const lat=field.lat, lon=field.lon;
  wl.innerHTML=[
    [`https://www.windy.com/?${lat},${lon},13`,'🌬️ Windy.com — Canlı Rüzgar & Yağış'],
    [`https://www.meteoblue.com/tr/hava/week/${lat.toFixed(3)}N${Math.abs(lon).toFixed(3)}E`,'🌤️ Meteoblue — Tarımsal Tahmin'],
    [`https://www.mgm.gov.tr/tahmin/il-ve-ilceler.aspx`,'🇹🇷 MGM — Türkiye Meteorolojisi'],
    [`https://maps.google.com/?q=${lat},${lon}`,'📍 Google Maps\'te Tarla Konumu']
  ].map(([u,l])=>`<a href="${u}" target="_blank" class="wxlink">${l}</a>`).join('');
}

// ─── OLAYLAR ─────────────────────────────────────────────────────
window.updEF = () => {
  const type=qs('#e-type').value, df=qs('#e-dynfields');
  const ql=qs('#e-qlbl'), cl=qs('#e-clbl'), us=qs('#e-unit');
  if(type==='sulama'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>Sulama Yöntemi</label><select id="e-sm"><option>Damla sulama</option><option>Yağmurlama</option><option>Salma sulama</option><option>Karık sulama</option><option>Yüzey sulama</option><option>Mikro yağmurlama</option><option>El ile sulama</option></select></div><div class="fg"><label>Süre (saat)</label><input type="number" id="e-sd" placeholder="2" min="0" step="0.5"/></div></div>`;
    if(ql)ql.textContent='Su Miktarı (mm)'; if(us)us.value='mm'; if(cl)cl.textContent='Birim Fiyat (₺/m³)';
  }else if(type==='gübre'){
    const fg={
      '── N GÜBRE (Azot) ──':['Üre (%46 N)','Amonyum Nitrat (%33 N)','CAN — Kalsiyum Amonyum Nitrat (%26 N)','Amonyum Sülfat (%21 N)','Amonyum Klorür (%25 N)'],
      '── P GÜBRE (Fosfor) ──':['TSP — Triple Süperfos (%46 P₂O₅)','SSP — Tek Süperfos (%20 P₂O₅)','MAP — Monoamonyum Fosfat (12-61-0)','DAP (18-46-0)','Rock Fosfat'],
      '── K GÜBRE (Potasyum) ──':['Potasyum Klorür MOP (%60 K₂O)','Potasyum Sülfat SOP (%50 K₂O)','Potasyum Nitrat (13-0-46)','Potasyum Magnezyum Sülfat'],
      '── NPK KOMPOZİT ──':['NPK 20-20-0','NPK 15-15-15','NPK 8-16-16','NPK 10-20-20','NPK 12-12-17','NPK 20-10-10','NPK 5-10-25','NPK 3-9-27+4MgO','NPK 15-5-30','NPK 13-13-21','NPK 20-0-0','NPK 11-52-0 (MAP)'],
      '── Ca & Mg ──':['Kalsiyum Nitrat (%15.5 N + %26 CaO)','Magnezyum Sülfat — Kiserit (%27 MgO)','Kalsiyum Klorür','Dolomit (CaMg)','Kireç — Kalsit'],
      '── MİKRO ELEMENT ──':['Çinko Sülfat ZnSO₄','Demir Sülfat FeSO₄','Mangan Sülfat','Bor — Sodyum Tetraborat','Bakır Sülfat','Molibden (Na Molibdat)','Şelatlı Demir EDTA-Fe','Şelatlı Çinko EDTA-Zn','Şelatlı Mangan EDTA-Mn','Şelatlı Bakır EDTA-Cu','Multimikro Karışım'],
      '── ORGANİK & BİOSTİMÜLANT ──':['Humik Asit (%85)','Humik+Fulvik Asit','Fulvik Asit Konsantre','Deniz Yosunu Ekstre (Ascophyllum)','Aminoasit Kompleks','Organik gübre (kompost)','Çiftlik gübresi','Leonardit','Vermikompost','Biyogübre Rhizobium','Mikoriza İnokulant (VAM)'],
      '── YAPRAK GÜBRE ──':['Yaprak gübresi NPK sıvı','Yaprak Ca+B','Yaprak Zn+Mn','Yaprak Fe+Mg','Yaprak Multimikro+İz Element'],
      '── ÖZEL ──':['Kükürt (%99 S granül)','Sodyum Molibdat','Silisyum Dioksit','Zeatin (Sitokinin)','Hümüs Toprağı']
    };
    let opt='';
    for(const [g,items] of Object.entries(fg)){
      opt+=`<optgroup label="${g}">${items.map(i=>`<option>${i}</option>`).join('')}</optgroup>`;
    }
    df.innerHTML=`<div class="fr"><div class="fg"><label>Gübre Türü / Ürün</label><select id="e-ft">${opt}</select></div><div class="fg"><label>Uygulama Yöntemi</label><select id="e-fa"><option>Topraktan serpme</option><option>Topraktan karıştırma</option><option>Bant uygulaması</option><option>Fertigasyon (damla ile)</option><option>Yapraktan ilaçlama</option><option>Toprak enjeksiyonu</option><option>Tohum ilaçlama</option></select></div></div><div class="fg"><label>Ticari Ürün / Marka (opsiyonel)</label><input type="text" id="e-fbrand" placeholder="Ürün adı, formülasyon..."/></div>`;
    if(ql)ql.textContent='Miktar (kg/da veya lt/da)'; if(us)us.value='kg'; if(cl)cl.textContent='Birim Fiyat (₺/kg)';
  }else if(type==='ilaç'){
    const pg={
      '── FUNGİSİT (Mantar Hastalıkları) ──':['Bakır Sülfat — Bordo bulamacı','Bakır Hidroksit','Mankozeb','Metalaksil+Mankozeb','Tebukonazol','Trifloksistrobin','Azoksistrobin','Propikonazol','Iprodion','Boskalid','Fenheksamid','Kresoksim-metil','Difenokonazol','Penthiopyrad'],
      '── İNSEKTİSİT (Böcek İlaçları) ──':['İmidakloprid','Tiyametoksam','Asetamiprit','Spirotetramat','Flonikamit','Klorpirfos','Deltametrin','Lambda-sihalotrin','Spinosad','Azadiraktin — Neem özü','Piretrin (doğal)'],
      '── AKARİSİT (Akar/Kene) ──':['Abamektin','Bifenazat','Spiromesifen','Etoksazol','Fenproksimat','Heksitiazoks','Propargit'],
      '── HERBİSİT (Yabancı Ot) ──':['Glifosat','Pendimetalin','Metribuzin','İmazamoks','Bentazon','Fluroksipir','2,4-D Amin','Dikamba','Sülkotrion','Klomazon'],
      '── NEMATİSİT (Nematod) ──':['Oksamil','Etoprofos','Dazomet','Biyonematisit (Bk nematisit)'],
      '── MOLUSKİSİT ──':['Demir Fosfat (organik)','Metaldehit'],
      '── BİYOLOJİK MÜCADELE ──':['Bacillus thuringiensis (Bt)','Bacillus subtilis','Beauveria bassiana','Metarhizium anisopliae','Trichoderma spp.','Steinernema (Entomopatojen nematod)','Chrysoperla carnea (Yeşil aslanağzı)','Phytoseiulus persimilis (Akar avcısı)','Trichogramma spp.'],
      '── ORGANİK & GELENEKSEL ──':['Sabunlu su (%2 sıvı sabun)','Göktaş — Kükürtlü kireç','Kükürt tozu (%80 S)','Kireç kaymağı','Sarımsak+biber karışımı','Neem yağı (%100)','Zeytinyağı+sabun emülsiyonu','Piretrum (doğal piretrin)','Kieselgur — Diyatome toprağı','Ahşap sirke (Pyroligneous acid)','Bakır kireç karışımı'],
      '── YAPIŞKAN & TUZAKLAR ──':['Sarı yapışkan tuzak','Mavi yapışkan tuzak','Feromon tuzak (ürüne özel)','Işık tuzağı (UV)','Kitlesel tuzaklama sistemi'],
      '── BÜYÜME DÜZENLEYİCİ ──':['Gibberellik asit (GA3)','Etefon','6-BAP (Benzilaminopürin)','Prohekzadion-Ca','Paklobutrazol','Sitokinin bazlı ürünler']
    };
    let opt='';
    for(const [g,items] of Object.entries(pg)){
      opt+=`<optgroup label="${g}">${items.map(i=>`<option>${i}</option>`).join('')}</optgroup>`;
    }
    df.innerHTML=`<div class="fr"><div class="fg"><label>Aktif Madde / Uygulama Türü</label><select id="e-pt">${opt}</select></div><div class="fg"><label>Ticari Ürün / Marka Adı</label><input type="text" id="e-pn" placeholder="Ürün adı..."/></div></div><div class="fr"><div class="fg"><label>Hedef Zararlı / Hastalık</label><input type="text" id="e-ptarget" placeholder="Zararlı / hastalık adı..."/></div><div class="fg"><label>Uygulama Ekipmanı</label><select id="e-papp"><option>Sırt pülverizatörü</option><option>Traktör pülverizatörü</option><option>Atomizör</option><option>Toprak uygulaması</option><option>Damla sulama ile</option></select></div></div>`;
    if(ql)ql.textContent='Toplam Miktar'; if(us)us.value='lt'; if(cl)cl.textContent='Birim Fiyat (₺/lt)';
  }else if(type==='yakıt'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>Yakıt Türü</label><select id="e-ft2"><option>Motorin</option><option>Benzin</option><option>LPG</option><option>Elektrik (kWh)</option></select></div><div class="fg"><label>Araç / Ekipman</label><input type="text" id="e-fv" placeholder="Traktör, sulama motoru, jeneratör..."/></div></div>`;
    if(ql)ql.textContent='Miktar (lt veya kWh)'; if(us)us.value='lt'; if(cl)cl.textContent='Litre / kWh Fiyatı (₺)';
  }else if(type==='hasat'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>Hasat Miktarı</label><input type="number" id="e-hq" placeholder="0" min="0"/></div><div class="fg"><label>Hasat Birimi</label><select id="e-hu"><option>kg</option><option>ton</option><option>adet</option><option>kasa</option><option>çuval</option><option>balya</option></select></div></div><div class="fr"><div class="fg"><label>Satış Fiyatı (₺/kg)</label><input type="number" id="e-hp" placeholder="0" step="0.01"/></div><div class="fg"><label>Alıcı / Satış Yeri</label><input type="text" id="e-hb" placeholder="Pazar, hal, kooperatif..."/></div></div>`;
    if(ql)ql.textContent='İşçilik Maliyeti'; if(us)us.value='toplam'; if(cl)cl.textContent='İşçilik (₺)';
  }else if(type==='işçilik'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>İşçi Sayısı</label><input type="number" id="e-wc" placeholder="2" min="0"/></div><div class="fg"><label>Süre (gün)</label><input type="number" id="e-wd" placeholder="1" min="0" step="0.5"/></div></div>`;
    if(ql)ql.textContent='Gün sayısı'; if(us)us.value='saat'; if(cl)cl.textContent='Günlük Ücret (₺/kişi)';
  }else{
    df.innerHTML='';
    if(ql)ql.textContent='Miktar'; if(cl)cl.textContent='Birim Maliyet (₺)'; if(us)us.value='toplam';
  }
}

window.openEM = (editId) => {
  qs('#e-eid').value=editId||'';
  qs('#em-title').textContent=editId?'Olayı Düzenle':'Olay / Maliyet Kaydı';
  if(editId&&CUR){
    const ev=(CUR.events||[]).find(e=>e.id===editId); if(!ev) return;
    qs('#e-date').value=ev.date||tstr(); qs('#e-type').value=ev.type||'diğer';
    qs('#e-notes').value=ev.notes||''; qs('#e-cost').value=ev.cost||'';
    qs('#e-qty').value=ev.qty||''; qs('#e-unit').value=ev.unit||'toplam';
    qs('#e-status').value=ev.planned?'planned':'done';
    updEF();
    if(ev.extra){ Object.entries(ev.extra).forEach(([k,v])=>{ const el=qs('#'+k); if(el) el.value=v; }); }
  }else{
    qs('#e-date').value=tstr(); qs('#e-type').value='sulama';
    qs('#e-notes').value=''; qs('#e-cost').value=''; qs('#e-qty').value='';
    qs('#e-status').value='done';
    updEF();
  }
  qs('#m-event').classList.add('on');
}

async window.saveEvent = () => {
  const dt=qs('#e-date').value; if(!dt){ toast('Tarih zorunludur',true); return; }
  if(!CUR) return;
  const eid=qs('#e-eid').value;
  const qty=parseFloat(qs('#e-qty').value)||0;
  const cost=parseFloat(qs('#e-cost').value)||0;
  const extra={};
  ['e-sm','e-sd','e-ft','e-fa','e-fbrand','e-pn','e-pt','e-ptarget','e-papp','e-ft2','e-fv','e-hq','e-hu','e-hp','e-hb','e-wc','e-wd'].forEach(id=>{
    const el=qs('#'+id); if(el&&el.value) extra[id]=el.value;
  });
  const ev={id:eid||gid(),date:dt,type:qs('#e-type').value,notes:qs('#e-notes').value,cost,qty,unit:qs('#e-unit').value,planned:qs('#e-status').value==='planned',extra,total:+(cost*(qty||1)).toFixed(2)};
  if(eid){ const idx=(CUR.events||[]).findIndex(e=>e.id===eid); if(idx>=0) CUR.events[idx]=ev; else (CUR.events=CUR.events||[]).push(ev); }
  else (CUR.events=CUR.events||[]).push(ev);
  CUR.events.sort((a,b)=>b.date.localeCompare(a.date));
  invSoil(CUR.id);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR);
  closeM('event'); renderFieldPage(CUR); renderSB(); renderDash();
  toast(eid?'Güncellendi':'Kaydedildi');
}

async window.delEv = (id) => {
  if(!CUR||!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return;
  CUR.events=(CUR.events||[]).filter(e=>e.id!==id);
  invSoil(CUR.id);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR);
  renderEvTab(CUR); renderDash(); toast('Silindi');
}

window.renderEvTab = (field) => {
  const tb=qs('#ev-tbody'); if(!tb) return;
  const evs=field.events||[];
  if(!evs.length){ tb.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--text3);">Kayıt yok.</td></tr>`; const cc=qs('#ev-cost'); if(cc) cc.innerHTML=''; return; }
  tb.innerHTML=evs.map(e=>{
    const total=e.total||(e.cost*(e.qty||1));
    const extra=e.extra?Object.entries(e.extra).filter(([k])=>['e-ft','e-pn','e-sm','e-ft2','e-fbrand'].includes(k)).map(([,v])=>v).join(' · '):'';
    return`<tr>
      <td style="white-space:nowrap;">${fd(e.date)}</td>
      <td><span>${EVI[e.type]||'📝'}</span> ${e.type}${e.planned?'<br/><span class="tag tb" style="font-size:9px;">Planlandı</span>':''}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${extra?`<small style="color:var(--text3);">${extra}</small><br/>`:''}${e.notes||'—'}</td>
      <td>${e.qty||'—'} ${e.unit||''}</td>
      <td>${e.cost?e.cost.toLocaleString('tr-TR')+'₺':'—'}</td>
      <td style="font-weight:600;">${total?Math.round(total).toLocaleString('tr-TR')+'₺':'—'}</td>
      <td><div style="display:flex;gap:3px;"><button class="btn btnxs btna" onclick="openEM('${e.id}')">✏️</button><button class="btn btnxs btnd" onclick="delEv('${e.id}')">✕</button></div></td>
    </tr>`;
  }).join('');
  const cm={};let tot=0;
  evs.filter(e=>e.cost>0).forEach(e=>{ const t=e.total||(e.cost*(e.qty||1)); cm[e.type]=(cm[e.type]||0)+t; tot+=t; });
  const cc=qs('#ev-cost');
  if(cc) cc.innerHTML=Object.keys(cm).length
    ? Object.entries(cm).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="pr"><span class="prl">${EVI[k]||'📝'} ${k}</span><div class="prt"><div class="prf" style="width:${tot?Math.round(v/tot*100):0}%;background:${EVC[k]||'var(--green2)'};"></div></div><span class="prv">${Math.round(v).toLocaleString()}₺</span></div>`).join('')+`<div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;padding-top:9px;margin-top:5px;border-top:1px solid var(--bdr);"><span>Toplam</span><span>${Math.round(tot).toLocaleString('tr-TR')} ₺</span></div>`
    : 'Maliyet kaydı yok.';
}

// ─── ÖNERİLER ────────────────────────────────────────────────────
window.buildAutoRecs = (field) => {
  const recs=[];
  const s=calcSoil(field);
  const wx=WXC[field.id]?.days||simWX(field.lat,field.lon);
  const today=tstr();
  const futWx=wx.filter(d=>d.date>today).slice(0,7);
  const futR=futWx.reduce((t,d)=>t+d.rain,0);
  const futET=futWx.reduce((t,d)=>t+(d.et0||s.et),0);
  const maxT=futWx.length?Math.max(...futWx.map(d=>d.tmax)):25;
  const rainyD=futWx.filter(d=>d.rain>3).length;
  const evs=field.events||[];
  const dSince=type=>{ const e=evs.filter(x=>x.type===type&&!x.planned).sort((a,b)=>b.date.localeCompare(a.date))[0]; return e?Math.round((Date.now()-new Date(e.date))/(864e5)):999; };
  const a=agrd(field.crop);

  if(s.pct<20) recs.push({i:'🚨',bg:'var(--rbg)',c:'var(--red)',t:'ACİL Sulama!',s:`Toprak nemi kritik (%${s.pct}). Hemen sulama yapın. Beklenen yağış: ${Math.round(futR)}mm.`,pr:'YÜKSEK'});
  else if(s.pct<35&&(futR-futET)<0) recs.push({i:'⚠️',bg:'var(--abg)',c:'var(--amber)',t:'Sulama Planlanmalı',s:`Nem %${s.pct}, 7g su dengesi: ${Math.round(futR-futET)}mm açık. 2-3 gün içinde sulama önerilir.`,pr:'ORTA'});

  if(dSince('gübre')>45) recs.push({i:'🧪',bg:'var(--abg)',c:'var(--amber)',t:'Gübreleme Değerlendirin',s:`${dSince('gübre')<999?dSince('gübre')+' gündür':'Hiç'} gübreleme yapılmamış. ${a.fert?.slice(0,80)||'Dönemsel gübre planı yapın'}.`,pr:'ORTA'});

  if(rainyD>=3&&dSince('ilaç')>21) recs.push({i:'🔬',bg:'var(--pbg)',c:'var(--purple)',t:'Fungal Hastalık Riski',s:`${rainyD} günlük yağışlı hava bekleniyor. Yüksek nem → fungus/mildiyö riski. Koruyucu ilaçlama değerlendirin.`,pr:'ORTA'});

  if(maxT>a.tm) recs.push({i:'🌡️',bg:'var(--rbg)',c:'var(--red)',t:'Kritik Sıcaklık Stresi!',s:`${maxT}°C bekleniyor, ürün üst limiti ${a.tm}°C. Sabah erken sulama yapın.`,pr:'YÜKSEK'});
  else if(maxT>a.to+8) recs.push({i:'☀️',bg:'var(--abg)',c:'var(--amber)',t:'Yüksek Sıcaklık Uyarısı',s:`${maxT}°C bekleniyor. Optimum: ${a.to}°C. Sulama zamanlamasına dikkat edin.`,pr:'ORTA'});

  const he=calcHarvest(field);
  if(he&&!he.already&&he.daysLeft<=14&&he.daysLeft>=0) recs.push({i:'🌾',bg:'var(--gbg)',c:'var(--green2)',t:'Hasat Yaklaşıyor',s:`GDD tahmini: ${he.daysLeft} gün kaldı. GDD ilerlemesi: %${he.gddPct}. Hasat hazırlıklarını başlatın.`,pr:'BİLGİ'});
  if(he?.already) recs.push({i:'🟢',bg:'var(--gbg)',c:'var(--green2)',t:'Hasat Zamanı!',s:'Fenolojik hesaplama hasat olgunluğuna ulaşıldığını gösteriyor. Görsel kontrol yapın.',pr:'YÜKSEK'});

  return recs;
}

window.renderRecTab = (field) => {
  // Fenoloji + Hasat Tahmini
  const ph=calcPheno(field);
  const he=calcHarvest(field);
  const sh=calcSolar(field);
  const a=agrd(field.crop);
  const phen=qs('#rec-pheno');
  if(phen){
    let html='';
    if(ph){
      html+=`<div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:700;">🌱 Gelişim Dönemi: <span style="color:var(--green2);">${ph.stage}</span></span>
          <span class="tag tgr">${ph.days} gün</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:10px;color:var(--text3);min-width:80px;">Sezon İlerlemesi</span>
          <div style="flex:1;height:7px;border-radius:4px;background:var(--bg3);overflow:hidden;"><div style="height:100%;border-radius:4px;background:var(--green2);width:${ph.totPct}%;transition:width .6s;"></div></div>
          <span style="font-size:11px;font-weight:700;">%${ph.totPct}</span>
        </div>
        <div style="font-size:11px;color:var(--text2);">GDD: ${ph.gdd} · Sezon: ${a.td} gün</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:7px;">${a.st.map((s,i)=>`<span style="font-size:9px;padding:2px 6px;border-radius:8px;background:${i<ph.si?'var(--gbg)':i===ph.si?'var(--green2)':'var(--bg3)'};color:${i<ph.si?'var(--green)':i===ph.si?'#fff':'var(--text3)'};">${s}</span>`).join('')}</div>
      </div>`;
    }
    if(sh){
      const hc={normal:'var(--green2)',uyarı:'var(--amber)',stres:'var(--red)',soğuk:'var(--blue)'};
      const hl={normal:'Normal',uyarı:'Sıcaklık Uyarısı',stres:'Isı Stresi',soğuk:'Soğuk Riski'};
      html+=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
        <div class="kpi"><div class="kpi-l">☀️ Güneşlenme</div><div class="kpi-v">${sh.sunH}<small>sa</small></div></div>
        <div class="kpi"><div class="kpi-l">🌡️ Sıcaklık</div><div class="kpi-v" style="font-size:12px;color:${hc[sh.hs]};">${hl[sh.hs]}</div></div>
        <div class="kpi"><div class="kpi-l">⚡ Solar</div><div class="kpi-v">${sh.rad}<small>MJ/m²</small></div></div>
      </div>`;
    }
    if(he){
      const cc={yüksek:'var(--green2)',orta:'var(--amber)',düşük:'var(--red)',manuel:'var(--blue)'};
      html+=`<div style="background:var(--glt);border:1px solid var(--gbg);border-radius:var(--r);padding:12px 14px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">🌾 GDD Hasat Tahmini</div>
        <div style="font-size:18px;font-weight:800;color:${he.already?'var(--green2)':'var(--text)'};">${he.already?'🟢 Hasat Zamanı!':he.daysLeft+' gün kaldı'}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:3px;">${fd(he.estDate)}</div>
        ${!he.already&&he.gddPct!==null?`<div style="display:flex;align-items:center;gap:8px;margin-top:8px;"><span style="font-size:10px;color:var(--text3);min-width:80px;">GDD %${he.gddPct}</span><div style="flex:1;height:6px;border-radius:4px;background:var(--bg3);overflow:hidden;"><div style="height:100%;border-radius:4px;background:var(--amber);width:${he.gddPct}%;"></div></div><span style="font-size:11px;font-weight:700;">${he.gddAcc}/${he.gddTarget}</span></div>`:''}
        <div style="font-size:10px;color:var(--text3);margin-top:5px;">Güvenilirlik: <span style="font-weight:700;color:${cc[he.conf]||'var(--text)'};">${he.conf.toUpperCase()}</span>${he.manDate?` · Manuel: ${fd(he.manDate)}${he.dev!==null?` (${he.dev>0?'+':''}${he.dev}g sapma)`:''}`:''}${!WXC[field.id]?' · ⚠️ Gerçek hava bekleniyor':''}</div>
      </div>`;
    }else if(!field.plantDate){
      html+=`<div style="color:var(--text3);font-size:12px;padding:12px 0;">Ekim tarihi girildiğinde fenoloji ve hasat tahmini hesaplanır.</div>`;
    }
    phen.innerHTML=html;
  }

  // Akıllı uyarılar
  const recs=buildAutoRecs(field);
  const ar=qs('#rec-auto');
  if(ar) ar.innerHTML=recs.length
    ? recs.map(r=>`<div class="ritem" style="background:${r.bg};"><div class="rico" style="background:${r.bg};color:${r.c};font-size:15px;">${r.i}</div><div class="rbody"><div class="rtitle">${r.t}<span class="rpri" style="background:${r.c}22;color:${r.c};">${r.pr}</span></div><div class="rsub">${r.s}</div></div></div>`).join('')
    : '<div style="color:var(--green2);font-size:13px;">✅ Kritik uyarı yok.</div>';

  // Gübre programı
  const fertH=(field.events||[]).filter(e=>e.type==='gübre').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3)
    .map(e=>`${fd(e.date)}: ${e.extra?.['e-ft']||''} (${e.qty||'?'}${e.unit||'kg'})`);
  const fr=qs('#rec-fert');
  if(fr) fr.innerHTML=`<div style="font-size:13px;font-weight:600;margin-bottom:8px;">${field.crop||'Ürün seçilmemiş'} — Gübre Programı</div><div style="font-size:13px;line-height:1.7;background:var(--bg3);padding:10px 12px;border-radius:var(--r);">${a.fert}</div>${fertH.length?`<div style="font-size:11px;color:var(--text3);margin-top:8px;">Son gübrelemeler: ${fertH.join(' · ')}</div>`:''}`;

  // Hastalık/zararlı riski
  const futWx=(WXC[field.id]?.days||simWX(field.lat,field.lon)).filter(d=>d.date>tstr()).slice(0,7);
  const avgR=futWx.reduce((s,d)=>s+d.rain,0)/Math.max(futWx.length,1);
  const avgT=futWx.reduce((s,d)=>s+d.tmax,0)/Math.max(futWx.length,1);
  const rl=avgR>5&&avgT>18?'YÜKSEK':avgR>2||avgT>24?'ORTA':'DÜŞÜK';
  const rc={YÜKSEK:'var(--red)',ORTA:'var(--amber)',DÜŞÜK:'var(--green2)'}[rl];
  const pests=PEST_DATA[field.crop]||PEST_DATA.default;
  const pr=qs('#rec-pest');
  if(pr) pr.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;"><span style="font-size:13px;">7 günlük hava koşullarına göre risk:</span><span class="tag" style="background:${rc}22;color:${rc};">${rl}</span></div>${pests.map(p=>`<div class="ritem" style="background:var(--bg3);padding:7px 10px;margin-bottom:5px;"><div class="rico" style="background:var(--pbg);color:var(--purple);font-size:12px;">🔬</div><div class="rbody"><div class="rtitle" style="font-size:12px;">${p}</div></div></div>`).join('')}<div style="font-size:11px;color:var(--text3);margin-top:7px;">⚠️ İlaçlama öncesi zirai mühendis ve resmi etiket bilgilerine başvurun.</div>`;

  // Son AI analizi
  const ar2=qs('#rec-ai');
  if(ar2) ar2.innerHTML=field.aiRecs?.length
    ? `<div class="bubble bb" style="white-space:pre-line;">${field.aiRecs[0].text}</div><div style="font-size:10px;color:var(--text3);margin-top:4px;">${fd(field.aiRecs[0].date)} tarihli analiz</div>`
    : '<div style="color:var(--text3);font-size:13px;">🤖 AI Analiz butonu ile tüm veriler harmanlanarak bütünsel uzman yorumu oluşturulur.</div>';
}

// ─── YAPAY ZEKA (GEMINI 2.5 FLASH) ───────────────────────────────
// Tüm verileri harmanlayarak TEK BÜTÜNsel analiz yapar
async window.runAI = () => {
  if(!CUR) return;

  // Hava verisi yoksa önce çek
  if(!WXC[CUR.id]){
    addB('sys','⏳ Hava verisi alınıyor...');
    await fetchWX(CUR);
  }
  // Uydu verisi yoksa veya eskiyse çek
  if(!SATC[CUR.id]||(Date.now()-SATC[CUR.id].at>3600000)){
    addB('sys','🛰️ Uydu verisi alınıyor...');
    await fetchSat(CUR);
  }

  goTab('ai');
  const chat=qs('#ai-chat'); if(chat) chat.innerHTML='';
  const photoCount=(CUR.photos||[]).filter(p=>p.data).length;
  addB('sys',`🔬 Tüm veriler + uydu indeksleri + ${photoCount} fotoğraf işleniyor...`);
  addB('load','');

  try{
    const s=calcSoil(CUR); const sc=scl(s.pct);
    const wx=WXC[CUR.id]?.days||simWX(CUR.lat,CUR.lon);
    const today=tstr();
    const pastWx=wx.filter(d=>d.date<today).slice(-7).map(d=>`${d.date.slice(5)}: ${d.tmax}°/${d.tmin}° yağış:${d.rain}mm rüzgar:${d.wind}km/h ET₀:${d.et0||'—'}mm`).join('\n');
    const futWx=wx.filter(d=>d.date>today).slice(0,7).map(d=>`${d.date.slice(5)}: ${d.tmax}°/${d.tmin}° yağış:${d.rain}mm ET₀:${d.et0||'—'}mm`).join('\n');
    const futR=wx.filter(d=>d.date>today).slice(0,7).reduce((t,d)=>t+d.rain,0);
    const futET=wx.filter(d=>d.date>today).slice(0,7).reduce((t,d)=>t+(d.et0||s.et),0);
    const ph=calcPheno(CUR);
    const he=calcHarvest(CUR);
    const sh=calcSolar(CUR);
    const a=agrd(CUR.crop);
    const lastIrr=(CUR.events||[]).filter(e=>e.type==='sulama'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const lastFert=(CUR.events||[]).filter(e=>e.type==='gübre'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const lastSpray=(CUR.events||[]).filter(e=>e.type==='ilaç'&&!e.planned).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const evLog=(CUR.events||[]).map(e=>{
      const ex=e.extra?Object.entries(e.extra).filter(([,v])=>v).map(([,v])=>v).join(', '):'';
      return`  ${e.date} | ${e.type}${ex?' ['+ex+']':''}${e.notes?' — '+e.notes:''} | ${e.qty?e.qty+(e.unit||''):''}${e.cost?' | '+e.cost+'₺':''} ${e.planned?'[PLANLI]':''}`;
    }).join('\n');
    const costMap={};let totalCost=0;
    (CUR.events||[]).filter(e=>e.cost>0).forEach(e=>{ const t=e.total||(e.cost*(e.qty||1)); costMap[e.type]=(costMap[e.type]||0)+t; totalCost+=t; });
    const costStr=Object.entries(costMap).map(([k,v])=>`${k}: ${Math.round(v)}₺`).join(' · ');
    const photoDesc=(CUR.photos||[]).map((p,i)=>`  Fotoğraf ${i+1}: ${p.date} [${p.type}]${p.note?' — '+p.note:''}${p.ai&&p.ai.length>10?' | Önceki analiz: '+p.ai.slice(0,120):''}`).join('\n');

    const prompt=`SEN DENEYİMLİ BİR TÜRK TARIM DANIŞMANISIN.

Aşağıdaki tüm veri kaynaklarını zihninde harmanlayarak YALNIZCA BİR BÜTÜNSEL UZMANSAL PARAGRAF GRUBU yaz. Başlık başlık liste DEĞİL — akıcı, birbirine bağlı uzman paragrafları.

═══ TARLA BİLGİSİ ═══
Tarla: ${CUR.name} | Ürün: ${CUR.crop||'?'} (${CUR.category||''}) | Alan: ${CUR.area} ${CUR.areaUnit||'dönüm'} | Toprak: ${CUR.soilType}
Konum: ${CUR.location||''} (${CUR.lat.toFixed(4)}°N, ${CUR.lon.toFixed(4)}°E)
Ekim: ${CUR.plantDate||'girilmemiş'} | Planlanan Hasat: ${CUR.harvestDate||'girilmemiş'}
Tarla Notu: ${CUR.notes||'—'}

═══ FENOLOJİ ═══
${ph?`Dönem: ${ph.stage} — toplam %${ph.totPct} tamamlandı (${ph.days} gün, ${ph.gdd} GDD)\nTüm dönemler: ${a.st.join(' → ')}\nGübre tavsiyesi: ${a.fert}`:'Ekim tarihi girilmemiş (fenoloji hesaplanamıyor)'}

═══ HASAT TAHMİNİ ═══
${he?`Tahmini hasat: ${fd(he.estDate)} (${he.daysLeft>0?he.daysLeft+' gün kaldı':he.already?'HASAT ZAMANI':'—'})\nGDD ilerlemesi: ${he.gddAcc}/${he.gddTarget} (%${he.gddPct})\nGüvenilirlik: ${he.conf}${he.manDate?' | Manuel tarih: '+fd(he.manDate)+(he.dev!==null?' ('+he.dev+'g sapma)':''):''}` :'Ekim tarihi yok — hesaplanamadı'}

═══ GÜNEŞ & SICAKLIK ═══
${sh?`Güneşlenme: ${sh.sunH} sa/gün | Solar: ${sh.rad} MJ/m²\nSıcaklık durumu: ${sh.hs} | Bugün max: ${sh.actMax}°C\nOptimum: ${sh.topt}°C | Kritik maks: ${sh.tmaxLim}°C | Min sınır: ${sh.minT}°C`:'Veri yok'}

═══ TOPRAK SUYU ═══
Nem: %${s.pct} (${sc.l}) | Mevcut: ${s.moist}mm / ${s.fc}mm tarla kapasitesi | Günlük ET: ${s.et}mm/g
7 günlük net su dengesi: +${Math.round(futR)}mm yağış − ${Math.round(futET)}mm ET = ${Math.round(futR-futET)}mm
Son sulama: ${lastIrr?lastIrr.date+' ('+Math.round((Date.now()-new Date(lastIrr.date))/(864e5))+' gün önce, '+lastIrr.qty+'mm)':'kayıt yok'}

═══ HAVA DURUMU — SON 7 GÜN ═══
${pastWx||'Veri yok'}

═══ HAVA DURUMU — ÖNÜMÜZDEKİ 7 GÜN ═══
${futWx||'Veri yok'}

═══ TARLA UYDU VERİLERİ (Sentinel-2 / NASA / Open-Meteo Agro) ═══
${satCtxStr(CUR)}

═══ OLAY & İŞÇİLİK KAYITLARI ═══
${evLog||'Kayıt yok'}
Son gübreleme: ${lastFert?lastFert.date+' — '+(lastFert.extra?.['e-ft']||''):'kayıt yok'}
Son ilaçlama: ${lastSpray?lastSpray.date+' — '+(lastSpray.extra?.['e-pn']||lastSpray.extra?.['e-pt']||''):'kayıt yok'}

═══ MALİYET ANALİZİ ═══
${costStr||'Kayıt yok'} | TOPLAM: ${Math.round(totalCost).toLocaleString('tr-TR')}₺${CUR.area>0?' | Dönüm başı: '+Math.round(totalCost/CUR.area).toLocaleString()+'₺':''}

═══ TARLA FOTOĞRAFLARI (${(CUR.photos||[]).length} adet — görseller ekli) ═══
${photoDesc||'Fotoğraf yok'}

═══════════════════════════════════════════════════════════
UZMANSAL YORUM TALEBİ:

Yukarıdaki tüm verileri ve eklenen fotoğrafların görsellerini birlikte değerlendirerek BİR UZMAN TARIMCI GİBİ BÜTÜNsel yorum yaz.

KURALLAR:
• Başlık başlık liste YOK — sadece akıcı, birbirine bağlı paragraflar
• Hava + toprak nemi + uydu indeksleri + fenoloji + geçmiş uygulamalar + fotoğraflar tek bir analize entegre olsun
• Veriler çelişiyorsa bunu belirt ve yorumla
• Somut tarih ve miktar belirterek aksiyon önerileri ver
• Türk tarım koşullarına özgü, teknik ama anlaşılır dil
• Maksimum 5-6 paragraf: durum → risk → eylem sıralamasıyla`;

    // Multimodal parts: text + all images
    const parts=[{text:prompt}];
    (CUR.photos||[]).forEach((p,i)=>{
      if(p.data&&p.data.startsWith('data:')){
        try{
          const b64=p.data.split(',')[1];
          const mime=p.data.split(';')[0].split(':')[1]||'image/jpeg';
          parts.push({inline_data:{mime_type:mime,data:b64}});
          parts.push({text:`[Fotoğraf ${i+1}: ${p.date}, tür:${p.type}${p.note?', not:'+p.note:''}]`});
        }catch(e){ console.warn('Photo error:',e); }
      }
    });

    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GK}`;
    const resp=await fetch(url,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:0.62,maxOutputTokens:8192}})
    });
    if(!resp.ok){ const err=await resp.json(); throw new Error(err.error?.message||'Gemini '+resp.status); }
    const data=await resp.json();
    const text=data.candidates?.[0]?.content?.parts?.[0]?.text||'Yanıt alınamadı';

    rmLoad();
    // Paragraf tabanlı render (markdown bold destekli, başlık yok)
    const rendered=text
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .split('\n\n').filter(p=>p.trim())
      .map(p=>`<p style="margin-bottom:10px;">${p.replace(/\n/g,'<br/>')}</p>`)
      .join('');
    const el=document.createElement('div');
    el.className='bubble bb';
    el.style.lineHeight='1.78';
    el.style.fontSize='13px';
    el.innerHTML=rendered;
    qs('#ai-chat')?.appendChild(el);
    qs('#ai-chat').scrollTop=qs('#ai-chat').scrollHeight;

    CUR.aiRecs=[{date:today,text}];
    const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
    await saveFieldToDB(CUR);
    renderRecTab(CUR);
    toast('✓ Bütünsel AI analizi tamamlandı');
  }catch(e){ rmLoad(); addB('bot','❌ '+e.message); }
}

async window.sendChat = () => {
  const inp=qs('#ai-inp'); const msg=inp.value.trim(); if(!msg) return;
  inp.value=''; addB('user',msg); addB('load','');
  aiHist.push({role:'user',content:msg});
  if(aiHist.length>14) aiHist=aiHist.slice(-14);
  const s=CUR?calcSoil(CUR):null;
  const ph=CUR?calcPheno(CUR):null;
  const sat=SATC[CUR?.id]?.data;
  const sys=CUR
    ? `Tarım danışmanısın. Tarla:${CUR.name}, ürün:${CUR.crop||'?'}, ${ph?'dönem:'+ph.stage+', ':''}nem:%${s?.pct||'?'}(${s?scl(s.pct).l:'?'}), alan:${CUR.area}${CUR.areaUnit||'dön'}, toprak:${CUR.soilType}${sat?', NDVI:'+sat.ndvi:''}. Kısa, pratik, Türkçe.`
    : 'Tarım danışmanısın. Türkçe yanıt ver.';
  const contents=aiHist.slice(-12).map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
  contents.push({role:'user',parts:[{text:`[Sistem: ${sys}]\n\n${msg}`}]});
  try{
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GK}`;
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents,generationConfig:{temperature:0.72,maxOutputTokens:4096}})});
    if(!r.ok){ const e=await r.json(); throw new Error(e.error?.message||'Gemini '+r.status); }
    const d=await r.json();
    const text=d.candidates?.[0]?.content?.parts?.[0]?.text||'Yanıt alınamadı';
    rmLoad(); addB('bot',text); aiHist.push({role:'assistant',content:text});
  }catch(e){ rmLoad(); addB('bot','❌ '+e.message); }
}

window.addB = (role, text) => {
  const chat=qs('#ai-chat'); if(!chat) return;
  if(role==='load'){
    const el=document.createElement('div'); el.id='ai-load'; el.className='bubble bb';
    el.innerHTML='<div style="display:inline-flex;gap:3px;"><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s .2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s .4s infinite;"></span></div>';
    chat.appendChild(el);
  }else{
    const el=document.createElement('div');
    el.className=`bubble ${role==='user'?'bu':role==='sys'?'bs':'bb'}`;
    el.style.whiteSpace='pre-line';
    el.textContent=(role==='user'?'Siz: ':'')+text;
    chat.appendChild(el);
  }
  chat.scrollTop=chat.scrollHeight;
}
window.rmLoad = () => { const el=qs('#ai-load'); if(el) el.remove(); }
window.clrChat = () => { const c=qs('#ai-chat'); if(c) c.innerHTML=''; aiHist=[]; }

async window.analyzePhoto = () => {
  if(!pendPh){ toast('Fotoğraf seçin',true); return; }
  const el=qs('#p-ai-res');
  el.innerHTML='<div class="bubble bs"><span style="display:inline-flex;gap:3px;"><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s .2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.3;animation:dl 1.2s .4s infinite;"></span></span> Görsel + tarla bağlamı analiz ediliyor...</div>';
  try{
    const b64=pendPh.split(',')[1]; const mime=pendPh.split(';')[0].split(':')[1]||'image/jpeg';
    const s=CUR?calcSoil(CUR):null;
    const ph=CUR?calcPheno(CUR):null;
    const sat=SATC[CUR?.id]?.data;
    const wx=CUR?WXC[CUR.id]?.days||simWX(CUR.lat,CUR.lon):[];
    const todayWx=wx.find(d=>d.date===tstr());
    const photoDate=qs('#p-date')?.value||tstr();
    const parts=[
      {inline_data:{mime_type:mime,data:b64}},
      {text:`Bu tarla fotoğrafını (${photoDate}) şu bağlamla analiz et:
TARLA:${CUR?.name||'?'} | ÜRÜN:${CUR?.crop||'?'} | DÖNEM:${ph?.stage||'?'} (%${ph?.totPct||'?'} tamamlandı)
NEM:%${s?.pct||'?'} (${s?scl(s.pct).l:'?'}) | BUGÜN:${todayWx?todayWx.tmax+'°C, '+todayWx.rain+'mm yağış':'?'}
UYDU:${sat?'NDVI:'+sat.ndvi+' NDWI:'+sat.ndwi+' LST:'+sat.lst+'°C':'veri yok'}

Türkçe, uzman görüşü:
1. Bitki sağlığı ve gelişim uygunluğu (döneme göre)
2. Görsel hastalık/zararlı belirtileri (varsa)
3. Fenolojik dönem doğrulaması (görseldeki dönem tahminim)
4. Toprak/nem görünümü
5. Acil müdahale gerektiren durum (varsa)
6. Hasat olgunluğu değerlendirmesi`}
    ];
    const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GK}`;
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{maxOutputTokens:2000}})});
    if(!r.ok){ const e=await r.json(); throw new Error(e.error?.message||r.status); }
    const d=await r.json();
    const text=d.candidates?.[0]?.content?.parts?.[0]?.text||'Analiz yapılamadı';
    el.innerHTML=`<div class="bubble bb" style="white-space:pre-line;margin-top:7px;">${text}</div>`;
  }catch(e){ el.innerHTML=`<div style="color:var(--red);font-size:12px;margin-top:6px;">Hata: ${e.message}</div>`; }
}

// ─── FOTOĞRAF YÖNETİMİ ────────────────────────────────────────────
async window.prevPhoto = (e) => {
  const file=e.target.files[0]; if(!file) return;
  const si=qs('#p-size-info'); if(si) si.textContent='Sıkıştırılıyor...';
  pendPh=await compressImg(file,150,0.82);
  const kb=Math.round(pendPh.length*0.75/1024);
  qs('#p-prev').innerHTML=`<img src="${pendPh}" style="width:100%;max-height:140px;object-fit:cover;border-radius:var(--r);margin-top:6px;"/>`;
  if(si) si.textContent=`~${kb} KB (sıkıştırıldı)`;
}
window.openPhM = () => { pendPh=null; qs('#p-prev').innerHTML=''; qs('#p-ai-res').innerHTML=''; qs('#p-date').value=tstr(); qs('#p-note').value=''; if(qs('#p-size-info'))qs('#p-size-info').textContent=''; qs('#p-file').value=''; qs('#m-photo').classList.add('on'); }
async window.savePhoto = () => {
  if(!pendPh){ toast('Fotoğraf seçin',true); return; } if(!CUR) return;
  CUR.photos=CUR.photos||[];
  const aiText=qs('#p-ai-res')?.innerText||'';
  CUR.photos.push({id:gid(),date:qs('#p-date').value||tstr(),type:qs('#p-type').value,note:qs('#p-note').value,data:pendPh,ai:aiText.length>10?aiText:''});
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR);
  closeM('photo'); pendPh=null; renderPhTab(CUR); toast('Fotoğraf kaydedildi');
}
window.renderPhTab = (field) => {
  const grid=qs('#ph-grid'); if(!grid) return;
  if(!field.photos?.length){ grid.innerHTML='<div style="grid-column:1/-1;"><div class="empty">📷<br/>Fotoğraf yok</div></div>'; return; }
  grid.innerHTML=field.photos.map((p,idx)=>`
    <div style="aspect-ratio:1;border-radius:var(--r);overflow:hidden;background:var(--bg3);border:1px solid var(--bdr);position:relative;cursor:pointer;" onclick="openPhV(${idx})">
      <img src="${p.data}" alt="${p.type}" loading="lazy" style="width:100%;height:100%;object-fit:cover;"/>
      <div class="ph-thumb-ov">
        <button class="btn btns" onclick="event.stopPropagation();openPhV(${idx})">🔍</button>
        <button class="btn btns btnd" onclick="event.stopPropagation();delPhoto(${idx})">🗑️</button>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:9px;padding:3px 5px;">${fd(p.date)} · ${p.type}</div>
    </div>`).join('');
}
window.openPhV = (idx) => {
  if(!CUR?.photos?.[idx]) return;
  curPhIdx=idx; const p=CUR.photos[idx];
  qs('#phv-img').src=p.data;
  qs('#phv-info').textContent=`${fd(p.date)} · ${p.type}${p.note?' · '+p.note:''}${p.ai&&p.ai.length>10?'\n🤖 '+p.ai.slice(0,150)+'...':''}`;
  qs('#phv').classList.add('on');
}
window.closePhV = () => { qs('#phv')?.classList.remove('on'); curPhIdx=null; }
window.editPhNote = () => {
  if(curPhIdx===null||!CUR?.photos?.[curPhIdx]) return;
  const p=CUR.photos[curPhIdx];
  const n=prompt('Notu düzenle:',p.note||''); if(n===null) return;
  p.note=n; saveFieldToDB(CUR);
  qs('#phv-info').textContent=`${fd(p.date)} · ${p.type}${p.note?' · '+p.note:''}`;
  renderPhTab(CUR); toast('Not güncellendi');
}
async window.delCurPh = () => {
  if(curPhIdx===null||!CUR?.photos) return;
  if(!confirm('Bu fotoğrafı silmek istediğinizden emin misiniz?')) return;
  CUR.photos.splice(curPhIdx,1);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR); closePhV(); renderPhTab(CUR); toast('Silindi');
}
async window.delPhoto = (idx) => {
  if(!CUR?.photos||!confirm('Bu fotoğrafı silmek istediğinizden emin misiniz?')) return;
  CUR.photos.splice(idx,1);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR); renderPhTab(CUR); toast('Silindi');
}

// ─── TARLA CRUD ──────────────────────────────────────────────────
window.fillCrops = () => {
  const cat=qs('#f-cat').value; const list=CROPS[cat]||[];
  const sel=qs('#f-crop');
  sel.innerHTML=list.length?list.map(c=>`<option value="${c}">${c}</option>`).join(''):'<option>Kategori seçin</option>';
  const lbl=qs('#f-qty-lbl'); if(!lbl) return;
  if(['meyve','narenciye','zeytin'].includes(cat)) lbl.textContent='Ağaç / Bitki Adedi';
  else if(['tahil','baklagil','endustri','yembitki'].includes(cat)) lbl.textContent='Tohum Miktarı (kg/da)';
  else lbl.textContent='Miktar';
}

window.openFM = (editId) => {
  qs('#f-eid').value=editId||'';
  qs('#fm-title').textContent=editId?'Tarla Düzenle':'Yeni Tarla Ekle';
  qs('#f-prev').style.display='none';
  if(editId){
    const f=DB.fields.find(x=>x.id===editId); if(!f) return;
    qs('#f-lat').value=f.lat||''; qs('#f-lon').value=f.lon||'';
    qs('#f-name').value=f.name||''; qs('#f-loc').value=f.location||'';
    qs('#f-area').value=f.area||''; qs('#f-aunit').value=f.areaUnit||'dönüm';
    qs('#f-soil').value=f.soilType||'killiTin';
    qs('#f-cat').value=f.category||''; fillCrops();
    if(f.crop) qs('#f-crop').value=f.crop;
    qs('#f-qty').value=f.qty||''; qs('#f-qunit').value=f.qunit||'adet';
    qs('#f-color').value=f.color||'#40916c';
    qs('#f-plant').value=f.plantDate||''; qs('#f-harvest').value=f.harvestDate||'';
    qs('#f-notes').value=f.notes||'';
  }else{
    ['f-lat','f-lon','f-name','f-loc','f-area','f-qty','f-notes','f-plant','f-harvest'].forEach(id=>{ const el=qs('#'+id); if(el) el.value=''; });
    qs('#f-color').value='#40916c'; qs('#f-cat').value=''; qs('#f-aunit').value='dönüm';
    if(qs('#f-file')) qs('#f-file').value='';
    fillCrops();
  }
  qs('#m-field').classList.add('on');
}

async window.saveField = () => {
  const name=qs('#f-name').value.trim(); if(!name){ toast('Tarla adı zorunlu',true); return; }
  const eid=qs('#f-eid').value; const ex=eid?DB.fields.find(f=>f.id===eid):null;
  const f={
    id:ex?ex.id:gid(), name,
    lat:parseFloat(qs('#f-lat').value)||36.8, lon:parseFloat(qs('#f-lon').value)||30.7,
    area:parseFloat(qs('#f-area').value)||0, areaUnit:qs('#f-aunit').value||'dönüm',
    location:qs('#f-loc').value,
    category:qs('#f-cat').value, crop:qs('#f-crop').value,
    qty:parseFloat(qs('#f-qty').value)||0, qunit:qs('#f-qunit').value,
    soilType:qs('#f-soil').value, plantDate:qs('#f-plant').value, harvestDate:qs('#f-harvest').value,
    color:qs('#f-color').value||'#40916c', notes:qs('#f-notes').value,
    events:ex?ex.events:[], photos:ex?ex.photos:[], aiRecs:ex?ex.aiRecs:[]
  };
  if(ex){ DB.fields[DB.fields.indexOf(ex)]=f; }else DB.fields.push(f);
  await saveFieldToDB(f);
  WXC[f.id]=null; invSoil(f.id);
  closeM('field'); renderAll(); showField(f.id);
  toast(ex?'Tarla güncellendi':'Tarla eklendi');
}

async window.delField = (id) => {
  if(!id||!confirm('Bu tarla ve tüm verileri silinecek. Emin misiniz?')) return;
  DB.fields=DB.fields.filter(f=>f.id!==id);
  await deleteFieldFromDB(id);
  delete WXC[id]; delete SATC[id]; invSoil(id);
  if(CUR?.id===id){ CUR=null; goPage('dash'); }
  renderAll();
}

// ─── DOSYA İMPORT (JSON/GeoJSON/KML) ─────────────────────────────
async window.importFF = (e) => {
  const file=e.target.files[0]; if(!file) return;
  const name=file.name.toLowerCase();
  const reader=new FileReader();
  reader.onload=ev=>{
    let R={};
    if(name.endsWith('.kml')) R=parseKML(ev.target.result);
    else{ try{ R=parseGeoJSON(JSON.parse(ev.target.result)); }catch(err){ toast('Dosya hatası: '+err.message,true); return; } }
    if(R.lat) qs('#f-lat').value=R.lat.toFixed(5);
    if(R.lon) qs('#f-lon').value=R.lon.toFixed(5);
    if(R.name&&!qs('#f-name').value) qs('#f-name').value=R.name;
    if(R.area){ qs('#f-area').value=R.area.toFixed(4); if(R.areaUnit) qs('#f-aunit').value=R.areaUnit; }
    if(R.description) qs('#f-notes').value=(qs('#f-notes').value?qs('#f-notes').value+'\n':'')+R.description;
    if(R.location) qs('#f-loc').value=R.location;
    const prev=qs('#f-prev');
    if(prev){ prev.style.display='block'; prev.innerHTML=`✅ <strong>Dosyadan:</strong> ${R.name||'İsimsiz'} · ${R.lat?.toFixed(4)}, ${R.lon?.toFixed(4)}${R.area?' · Alan: '+R.area.toFixed(1)+' '+(R.areaUnit||'m²'):''}${R.description?' · '+R.description.slice(0,80):''}`; }
    toast('Dosya verisi yüklendi ✓');
  };
  reader.readAsText(file);
}

window.parseGeoJSON = (d) => {
  const R={}; let geom=null, props={};
  if(d.type==='FeatureCollection'&&d.features?.length){ geom=d.features[0].geometry; props=d.features[0].properties||{}; }
  else if(d.type==='Feature'){ geom=d.geometry; props=d.properties||{}; }
  else if(['Point','Polygon','MultiPolygon'].includes(d.type)) geom=d;
  else if(d.lat&&d.lon){ R.lat=d.lat; R.lon=d.lon; }
  if(geom){
    if(geom.type==='Point'){ R.lon=geom.coordinates[0]; R.lat=geom.coordinates[1]; }
    else if(geom.type==='Polygon'){ const ring=geom.coordinates[0]; R.lat=ring.reduce((s,p)=>s+p[1],0)/ring.length; R.lon=ring.reduce((s,p)=>s+p[0],0)/ring.length; R.area=calcPolyArea(ring); R.areaUnit='m²'; }
    else if(geom.type==='MultiPolygon'){ const ring=geom.coordinates[0][0]; R.lat=ring.reduce((s,p)=>s+p[1],0)/ring.length; R.lon=ring.reduce((s,p)=>s+p[0],0)/ring.length; R.area=calcPolyArea(ring); R.areaUnit='m²'; }
  }
  R.name=props.name||props.Name||props.isim||props.ad||'';
  R.description=props.description||props.aciklama||props.note||'';
  R.location=props.location||props.konum||props.mahalle||'';
  if(props.area||props.alan) R.area=parseFloat(props.area||props.alan)||R.area;
  if(props.areaUnit||props.birim) R.areaUnit=props.areaUnit||props.birim||R.areaUnit;
  return R;
}

window.parseKML = (kmlText) => {
  const parser=new DOMParser(); const doc=parser.parseFromString(kmlText,'text/xml');
  const R={};
  const nameEl=doc.querySelector('Placemark > name, Document > name'); if(nameEl) R.name=nameEl.textContent.trim();
  const descEl=doc.querySelector('description'); if(descEl) R.description=descEl.textContent.replace(/<[^>]+>/g,'').trim().slice(0,200);
  const coordEl=doc.querySelector('coordinates');
  if(coordEl){
    const pairs=coordEl.textContent.trim().split(/\s+/).filter(Boolean).map(p=>p.split(',').map(Number));
    if(pairs.length===1){ R.lon=pairs[0][0]; R.lat=pairs[0][1]; }
    else if(pairs.length>1){ R.lat=pairs.reduce((s,p)=>s+p[1],0)/pairs.length; R.lon=pairs.reduce((s,p)=>s+p[0],0)/pairs.length; R.area=calcPolyArea(pairs.map(p=>[p[0],p[1]])); R.areaUnit='m²'; }
  }
  doc.querySelectorAll('SimpleData').forEach(sd=>{
    const n=(sd.getAttribute('name')||'').toLowerCase(); const v=sd.textContent.trim();
    if(n.includes('alan')||n.includes('area')) R.area=parseFloat(v)||R.area;
    if(n.includes('birim')||n.includes('unit')) R.areaUnit=v;
    if(n.includes('konum')||n.includes('location')) R.location=v;
  });
  return R;
}

window.calcPolyArea = (ring) => {
  if(!ring||ring.length<3) return 0;
  const Rm=6371000; let area=0;
  for(let i=0;i<ring.length-1;i++){
    const [lo1,la1]=ring[i]; const [lo2,la2]=ring[i+1];
    area+=(lo2-lo1)*Math.PI/180*(2+Math.sin(la1*Math.PI/180)+Math.sin(la2*Math.PI/180));
  }
  return Math.abs(area*Rm*Rm/2);
}

// ─── FİREBASE / YEREL DEPOLAMA ───────────────────────────────────
async window.saveFieldToDB = (field) => {
  // Firebase'e kaydetmeden önce önbelleklenmiş geçici verileri temizle
  const clean=JSON.parse(JSON.stringify(field));
  delete clean._soilCache;
  const uid=window.FB_USER?.uid;
  if(uid&&window.FB_MODE){ try{ await window.fbSaveField(uid,clean); }catch(e){ toast('DB kayıt hatası: '+e.message,true); } }
  saveLocalDB();
}
async window.deleteFieldFromDB = (fieldId) => {
  const uid=window.FB_USER?.uid;
  if(uid&&window.FB_MODE){ try{ await window.fbDeleteField(uid,fieldId); }catch(e){ toast('DB silme hatası: '+e.message,true); } }
  saveLocalDB();
}
async window.syncDB = () => {
  const uid=window.FB_USER?.uid; if(!uid||!window.FB_MODE) return;
  try{
    const fields=await window.fbLoadFields(uid);
    DB.fields=fields||[];
    saveLocalDB();
    invSoilAll();
    // Hava verisi olmayan tarlalar için çek
    DB.fields.forEach(f=>{ if(!WXC[f.id]) fetchWX(f); });
    renderAll();
    if(CUR){ const u=DB.fields.find(f=>f.id===CUR.id); if(u){ CUR=u; if(qs('#page-field.on')) renderFieldPage(CUR); }else{ CUR=null; goPage('dash'); } }
    toast('Veriler güncellendi ✓');
  }catch(e){ toast('Senkronizasyon hatası: '+e.message,true); }
}
window.saveLocalDB = () => { try{ localStorage.setItem('tt_fields',JSON.stringify(DB.fields)); }catch(e){} }
window.loadLocalDB = () => { try{ const d=localStorage.getItem('tt_fields'); if(d) DB.fields=JSON.parse(d)||[]; }catch(e){} }
window.saveSettings = () => { DB.s.acuKey=qs('#acu-key')?.value||''; localStorage.setItem('tt_s',JSON.stringify(DB.s)); toast('Kaydedildi'); }
window.loadSettings = () => {
  try{ const s=localStorage.getItem('tt_s'); if(s){ const p=JSON.parse(s); DB.s={...DB.s,...p}; } }catch(e){}
  if(qs('#acu-key')) qs('#acu-key').value=DB.s.acuKey||'';
}
window.expData = () => { const a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify({fields:DB.fields},null,2)); a.download='tarim_'+tstr()+'.json'; a.click(); }
window.impData = (e) => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); if(d.fields){ DB.fields=d.fields; saveLocalDB(); renderAll(); toast('İçe aktarıldı'); } }catch{ toast('Geçersiz JSON',true); } }; r.readAsText(f); }

// ─── KULLANICI GİRİŞİ ────────────────────────────────────────────
window.swAuthTab = (tab, el) => {
  qs('#auth-screen .auth-pane.on')?.classList.remove('on');
  qs('#ap-'+tab)?.classList.add('on');
  qs('#auth-screen .auth-tab.on')?.classList.remove('on');
  el.classList.add('on');
}
async window.signGoogle = () => {
  if(!window.FB_MODE){ noFBNotice(); return; }
  try{ await window.fbGoogle(); }catch(e){ showAErr('login',e.message); }
}
async window.signEmail = (mode) => {
  if(!window.FB_MODE){ noFBNotice(); return; }
  const em=qs('#'+mode[0]+'e')?.value; const pw=qs('#'+mode[0]+'p')?.value;
  try{
    if(mode==='login') await window.fbEmail(em,pw);
    else await window.fbRegister(em,pw);
  }catch(e){ showAErr(mode,e.message); }
}
window.showAErr = (m,msg) => { const el=qs('#'+m[0]+'err'); if(el){ el.style.display='block'; el.textContent=msg; } }
window.noFBNotice = () => { qs('#no-fb-note').style.display='block'; qs('#auth-form').style.display='none'; }
window.enterLocal = () => { LOCAL=true; qs('#auth-screen').classList.add('hidden'); loadLocalDB(); DB.fields.forEach(f=>fetchWX(f)); renderAll(); toast('Yerel modda çalışıyorsunuz'); }
async window.doSignOut = () => { if(window.FB_MODE&&window.FB_USER) await window.fbOut(); else{ LOCAL=false; DB.fields=[]; } qs('#auth-screen')?.classList.remove('hidden'); }

window.onAuthChange=async(user)=>{
  if(user){
    qs('#auth-screen').classList.add('hidden');
    updateChip(user);
    await syncDB();
  }else{
    if(!LOCAL) qs('#auth-screen')?.classList.remove('hidden');
  }
};
window.updateChip = (user) => {
  if(!user) return;
  const av=qs('#user-avatar'); const nm=qs('#user-name');
  if(user.photoURL) av.innerHTML=`<img src="${user.photoURL}" style="width:22px;height:22px;border-radius:50%;"/>`;
  else av.textContent=(user.displayName||user.email||'?')[0].toUpperCase();
  if(nm) nm.textContent=user.displayName||user.email||'';
  const ai=qs('#account-info');
  if(ai) ai.innerHTML=`<div style="font-size:13px;"><strong>${user.displayName||''}</strong><br/>${user.email||''}</div>`;
}

// ─── RENDER FONKSİYONLARI ────────────────────────────────────────
window.renderAll = () => { renderSB(); renderDash(); renderCal(); renderRep(); }

window.renderSB = () => {
  const el=qs('#sb-list'); if(!el) return; el.innerHTML='';
  DB.fields.forEach(f=>{
    invSoil(f.id);
    const s=calcSoil(f); const sc=scl(s.pct);
    const d=document.createElement('div'); d.className='fi'+(f.id===CUR?.id?' on':'');
    d.onclick=()=>{ showField(f.id); clSBmob(); };
    d.innerHTML=`<div class="fi-dot" style="background:${f.color||'#40916c'};"></div><div class="fi-info"><div class="fi-name">${f.name}</div><div class="fi-sub">${f.crop||'Ürün yok'} · <span class="tag ${sc.tag}" style="font-size:9px;">${sc.l} %${s.pct}</span></div></div>`;
    el.appendChild(d);
  });
}

window.renderFKPIs = (field) = {
  invSoil(field.id);
  const s=calcSoil(field); const sc=scl(s.pct);
  const tc=(field.events||[]).reduce((t,e)=>t+(e.total||(e.cost*(e.qty||1))),0);
  const lastEv=(field.events||[]).filter(e=>!e.planned)[0];
  const ph=calcPheno(field);
  const he=calcHarvest(field);
  const el=qs('#fp-tags');
  if(el) el.innerHTML=`
    ${field.crop?`<span class="tag tg">${field.crop}</span>`:''}
    ${field.qty?`<span class="tag tgr">${field.qty} ${field.qunit}</span>`:''}
    <span class="tag tgr">${field.area} ${field.areaUnit||'dönüm'}</span>
    ${field.location?`<span class="tag tgr">📍 ${field.location}</span>`:''}
    <span class="tag ${sc.tag}">${sc.l} %${s.pct}</span>`;
  const kp=qs('#fp-kpis');
  if(kp) kp.innerHTML=`
    <div class="kpi"><div class="kpi-l">Toprak Nemi</div><div class="kpi-v" style="color:${sc.color};">${s.pct}<small>%</small></div><div class="kpi-s">${sc.l}</div></div>
    <div class="kpi"><div class="kpi-l">Gelişim Dönemi</div><div class="kpi-v" style="font-size:12px;">${ph?ph.stage:'—'}</div><div class="kpi-s">${ph?'%'+ph.totPct+' tamamlandı':'Ekim tarihi yok'}</div></div>
    <div class="kpi"><div class="kpi-l">Hasat Tahmini</div><div class="kpi-v" style="font-size:12px;color:${he?.already?'var(--green2)':'var(--text)'};">${he?(he.already?'🟢 Hazır!':he.daysLeft+'g'):'—'}</div><div class="kpi-s">${he&&!he.already?fd(he.estDate):'—'}</div></div>
    <div class="kpi"><div class="kpi-l">Toplam Maliyet</div><div class="kpi-v">${Math.round(tc).toLocaleString('tr-TR')}<small>₺</small></div><div class="kpi-s">${(field.events||[]).length} kayıt</div></div>`;
}

window.renderDash = () => {
  const now=new Date();
  qs('#ddate').textContent=now.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const ta=DB.fields.reduce((s,f)=>s+(f.area||0),0);
  const tc=DB.fields.reduce((s,f)=>s+(f.events||[]).reduce((c,e)=>c+(e.total||(e.cost*(e.qty||1))),0),0);
  qs('#dkpis').innerHTML=`
    <div class="kpi"><div class="kpi-l">Tarla</div><div class="kpi-v">${DB.fields.length}</div></div>
    <div class="kpi"><div class="kpi-l">Toplam Alan</div><div class="kpi-v">${ta.toFixed(1)}</div></div>
    <div class="kpi"><div class="kpi-l">Toplam Maliyet</div><div class="kpi-v">${Math.round(tc).toLocaleString('tr-TR')}</div><div class="kpi-s">₺</div></div>
    <div class="kpi"><div class="kpi-l">Ekili Tarla</div><div class="kpi-v">${DB.fields.filter(f=>f.crop).length}<small>/${DB.fields.length}</small></div></div>`;
  const df=qs('#dfields');
  if(!DB.fields.length){ df.innerHTML='<div class="empty">🌾<br/>Tarla yok.<br/>"+ Yeni Tarla" ile başlayın.</div>'; qs('#devents').innerHTML=''; qs('#dplanned').innerHTML=''; return; }
  df.innerHTML=DB.fields.map(f=>{
    invSoil(f.id);
    const s=calcSoil(f); const sc=scl(s.pct);
    const ph=calcPheno(f); const he=calcHarvest(f);
    return`<div class="evrow" style="cursor:pointer;" onclick="showField('${f.id}')">
      <div class="evico" style="background:${f.color||'#40916c'}22;font-size:14px;">🌿</div>
      <div class="evbody">
        <div class="evtitle">${f.name}</div>
        <div class="evsub">${f.crop||'Ürün yok'} · ${f.area}${f.areaUnit||'dön'} · ${f.location||'—'}</div>
        ${ph?`<div class="evsub" style="margin-top:2px;">📍 ${ph.stage}${he&&!he.already?' · Hasat ~'+he.daysLeft+'g':he?.already?' · 🟢 Hasat zamanı!':''}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
        <span class="tag ${sc.tag}">${sc.l}</span>
        <span style="font-size:11px;font-weight:700;color:${sc.color};">%${s.pct}</span>
      </div>
    </div>`;
  }).join('');
  const allEvs=[];DB.fields.forEach(f=>(f.events||[]).filter(e=>!e.planned).forEach(e=>allEvs.push({...e,fn:f.name})));
  allEvs.sort((a,b)=>b.date.localeCompare(a.date));
  qs('#devents').innerHTML=allEvs.slice(0,4).map(e=>`<div class="evrow"><div class="evico" style="background:${EVC[e.type]||'#eee'};font-size:12px;">${EVI[e.type]||'📝'}</div><div class="evbody"><div class="evtitle">${e.fn} — ${e.type}</div><div class="evsub">${fd(e.date)}${e.notes?' · '+e.notes.slice(0,40):''}</div></div>${e.total?`<span class="evcost">${Math.round(e.total).toLocaleString()}₺</span>`:''}</div>`).join('')||'<div style="color:var(--text3);font-size:13px;">Kayıt yok.</div>';
  const planned=[];DB.fields.forEach(f=>(f.events||[]).filter(e=>e.planned&&e.date>=tstr()).forEach(e=>planned.push({...e,fn:f.name,fc:f.color})));
  planned.sort((a,b)=>a.date.localeCompare(b.date));
  qs('#dplanned').innerHTML=planned.slice(0,4).map(e=>`<div class="evrow"><div class="evico" style="background:${e.fc||'#40916c'}22;font-size:13px;">${EVI[e.type]||'📝'}</div><div class="evbody"><div class="evtitle">${e.fn} — ${e.type}</div><div class="evsub">${fd(e.date)}</div></div></div>`).join('')||'<div style="color:var(--text3);font-size:13px;">Planlanan görev yok.</div>';
}

window.showField = (id) => {
  CUR=DB.fields.find(f=>f.id===id); if(!CUR) return;
  aiHist=[]; curTab='map';
  goPage('field'); renderSB(); renderFieldPage(CUR);
  if(!WXC[CUR.id]) fetchWX(CUR);
}

window.renderFieldPage = (field) => {
  CUR=field;
  qs('#fp-name').textContent=field.name;
  renderFKPIs(field);
  goTab('map');
}

window.goTab = (t) => {
  curTab=t;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.tp').forEach(x=>x.classList.remove('on'));
  qs(`.tab[data-t="${t}"]`)?.classList.add('on');
  qs('#tp-'+t)?.classList.add('on');
  if(!CUR) return;
  if(t==='map'){
    requestAnimationFrame(()=>{ setTimeout(()=>{ initMap(CUR.lat,CUR.lon,CUR); renderLocInfo(CUR); },80); });
  }else if(t==='wx'){
    if(!WXC[CUR.id]) fetchWX(CUR); else renderWX(CUR);
  }else if(t==='sat'){
    if(!SATC[CUR.id]||Date.now()-SATC[CUR.id].at>3600000) fetchSat(CUR);
    else renderSat(CUR, SATC[CUR.id].data);
  }else if(t==='soil'){ renderSoil(CUR); }
  else if(t==='ev'){ renderEvTab(CUR); }
  else if(t==='rec'){ renderRecTab(CUR); }
  else if(t==='ph'){ renderPhTab(CUR); }
  else if(t==='ai'){
    const chat=qs('#ai-chat');
    if(chat&&!chat.children.length) chat.innerHTML=`<div class="bubble bs">👋 <strong>${CUR.name}</strong> tarlası için AI asistanı hazır.<br/>🤖 <strong>AI Analiz</strong> butonuna basın → Hava + toprak + uydu + fenoloji + olaylar + fotoğraflar tek bütünsel uzman yorumu.</div>`;
    const qq=qs('#qqbtns');
    if(qq) qq.innerHTML=['Sulama planı','Gübre tavsiyesi',`${CUR.crop||'ürün'} hastalık riskleri`,'Bu hafta ne yapmalıyım?'].map(q=>`<button style="padding:4px 9px;border-radius:7px;font-size:11px;border:1px solid var(--bdr2);background:transparent;color:var(--text2);cursor:pointer;" onmouseover="this.style.borderColor='var(--green2)';this.style.color='var(--green2)'" onmouseout="this.style.borderColor='var(--bdr2)';this.style.color='var(--text2)'" onclick="qs('#ai-inp').value='${q}';sendChat()">${q}</button>`).join('');
  }
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>goTab(t.dataset.t)));

window.closeM = (id) => { qs('#m-'+id)?.classList.remove('on'); }

window.goPage = (p) => {
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));
  qs('#page-'+p)?.classList.add('on');
  document.querySelectorAll('.tn').forEach(b=>b.classList.remove('on'));
  const idx={dash:0,cal:1,rep:2,cfg:3}[p];
  if(idx!==undefined) document.querySelectorAll('.tn')[idx]?.classList.add('on');
  if(p==='dash'){ invSoilAll(); renderDash(); }
  if(p==='cal') renderCal();
  if(p==='rep'){ invSoilAll(); renderRep(); }
  clSBmob();
}

window.renderCal = () => {
  const now=new Date(); const y=now.getFullYear(), m=now.getMonth();
  const MO=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  qs('#cal-hdr').textContent=MO[m]+' '+y;
  qs('#cal-heads').innerHTML=['Pt','Sa','Ça','Pe','Cu','Ct','Pz'].map(d=>`<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text3);padding:3px 0;">${d}</div>`).join('');
  const first=(new Date(y,m,1).getDay()+6)%7, dc=new Date(y,m+1,0).getDate();
  const mon=now.toISOString().slice(0,7);
  const ed=new Set(); DB.fields.forEach(f=>(f.events||[]).forEach(e=>{ if(e.date.startsWith(mon)) ed.add(+e.date.slice(8,10)); }));
  let html=Array(first).fill('<div></div>').join('');
  for(let i=1;i<=dc;i++){ const isTd=i===now.getDate(); html+=`<div style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;border-radius:7px;background:${isTd?'var(--gbg)':'transparent'};color:${isTd?'var(--green2)':'inherit'};font-weight:${isTd?700:400};position:relative;">${i}${ed.has(i)?`<span style="width:4px;height:4px;background:var(--green2);border-radius:50%;position:absolute;bottom:2px;"></span>`:''}</div>`; }
  qs('#cal-cells').innerHTML=html;
  const me=[]; DB.fields.forEach(f=>(f.events||[]).filter(e=>e.date.startsWith(mon)).forEach(e=>me.push({...e,fn:f.name})));
  me.sort((a,b)=>a.date.localeCompare(b.date));
  qs('#cal-evs').innerHTML=me.length?me.map(e=>`<div class="evrow"><div class="evico" style="background:${EVC[e.type]||'#eee'};font-size:12px;">${EVI[e.type]||'📝'}</div><div class="evbody"><div class="evtitle">${e.fn}</div><div class="evsub">${e.type} · ${fd(e.date)}</div></div>${e.total?`<span class="evcost">${Math.round(e.total).toLocaleString()}₺</span>`:''}</div>`).join(''):'<div style="color:var(--text3);font-size:13px;">Bu ay olay yok.</div>';
  const aiS=[]; DB.fields.forEach(f=>{ if(f.aiRecs?.length) aiS.push({fn:f.name,text:f.aiRecs[0].text.slice(0,130)+'...',date:f.aiRecs[0].date}); });
  qs('#cal-ai').innerHTML=aiS.length?aiS.map(s=>`<div class="ritem" style="background:var(--glt);"><div class="rico" style="background:var(--gbg);color:var(--green2);">🤖</div><div class="rbody"><div class="rtitle">${s.fn}</div><div class="rsub">${s.text}</div><div style="font-size:10px;color:var(--text3);margin-top:2px;">${fd(s.date)}</div></div></div>`).join(''):'<div style="color:var(--text3);font-size:13px;">AI analizi çalıştırarak öneri alın.</div>';
}

window.renderRep = () => {
  const rc=qs('#rep-content'); if(!rc) return;
  if(!DB.fields.length){ rc.innerHTML='<div class="empty">📊<br/>Tarla ekleyin.</div>'; return; }
  const total=DB.fields.reduce((s,f)=>s+(f.events||[]).reduce((c,e)=>c+(e.total||(e.cost*(e.qty||1))),0),0);
  const ta=DB.fields.reduce((s,f)=>s+(f.area||0),0);
  const byCat={}; DB.fields.forEach(f=>(f.events||[]).filter(e=>e.cost>0).forEach(e=>{ const t=e.total||(e.cost*(e.qty||1)); byCat[e.type]=(byCat[e.type]||0)+t; }));
  rc.innerHTML=`
    <div class="krow">
      <div class="kpi"><div class="kpi-l">Toplam Yatırım</div><div class="kpi-v">${Math.round(total).toLocaleString('tr-TR')}</div><div class="kpi-s">₺</div></div>
      <div class="kpi"><div class="kpi-l">Alan Başı</div><div class="kpi-v">${ta?Math.round(total/ta).toLocaleString():0}</div><div class="kpi-s">₺/birim</div></div>
      <div class="kpi"><div class="kpi-l">Tarla</div><div class="kpi-v">${DB.fields.length}</div></div>
      <div class="kpi"><div class="kpi-l">Toplam Alan</div><div class="kpi-v">${ta.toFixed(1)}</div></div>
    </div>
    <div class="g2">
      <div class="card"><div class="ct">Tarla Bazlı Maliyet</div>
        ${DB.fields.map(f=>{const fc=(f.events||[]).reduce((s,e)=>s+(e.total||(e.cost*(e.qty||1))),0);return`<div class="pr"><span class="prl" style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${f.color};flex-shrink:0;"></span>${f.name}</span><div class="prt"><div class="prf" style="width:${total?Math.round(fc/total*100):0}%;background:${f.color};"></div></div><span class="prv">${Math.round(fc).toLocaleString()}₺</span></div>`;}).join('')}
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;padding-top:9px;margin-top:5px;border-top:1px solid var(--bdr);"><span>Toplam</span><span>${Math.round(total).toLocaleString('tr-TR')} ₺</span></div>
      </div>
      <div class="card"><div class="ct">İşlem Bazlı Dağılım</div>
        ${Object.keys(byCat).length?Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="pr"><span class="prl">${EVI[k]||'📝'} ${k}</span><div class="prt"><div class="prf" style="width:${total?Math.round(v/total*100):0}%;"></div></div><span class="prv">${Math.round(v).toLocaleString()}₺</span></div>`).join(''):'<div style="color:var(--text3);">Kayıt yok</div>'}
      </div>
    </div>
    <div class="card"><div class="ct">Tarla Özet Tablosu</div>
      <div style="overflow-x:auto;"><table class="tbl"><thead><tr><th>Tarla</th><th>Ürün</th><th>Alan</th><th>Dönem</th><th>Nem</th><th>Hasat</th><th>Maliyet</th></tr></thead>
      <tbody>${DB.fields.map(f=>{
        invSoil(f.id); const s=calcSoil(f); const sc=scl(s.pct);
        const fc=(f.events||[]).reduce((c,e)=>c+(e.total||(e.cost*(e.qty||1))),0);
        const ph=calcPheno(f); const he=calcHarvest(f);
        return`<tr>
          <td style="font-weight:600;white-space:nowrap;"><span style="width:8px;height:8px;border-radius:50%;background:${f.color};display:inline-block;margin-right:5px;"></span>${f.name}</td>
          <td>${f.crop||'—'}</td><td>${f.area} ${f.areaUnit||'dön'}</td>
          <td style="font-size:11px;">${ph?ph.stage:'—'}</td>
          <td><span class="tag ${sc.tag}">${sc.l} %${s.pct}</span></td>
          <td style="font-size:11px;">${he?(he.already?'🟢 Hazır!':he.daysLeft+'g'):'—'}</td>
          <td>${Math.round(fc).toLocaleString()}₺</td>
        </tr>`;}).join('')}</tbody></table></div>
    </div>`;
}

// ─── OTOMATİK YENİLEME ───────────────────────────────────────────
// Her 10 dakikada bir: toprak önbelleğini temizle + hava verisini yenile
setInterval(async()=>{
  invSoilAll();
  const toFetch=DB.fields.filter(f=>!WXC[f.id]||(Date.now()-WXC[f.id].at>1800000));
  await Promise.allSettled(toFetch.map(f=>fetchWX(f)));
  renderSB(); renderDash();
  if(CUR&&qs('#page-field.on')){
    renderFKPIs(CUR);
    if(curTab==='soil') renderSoil(CUR);
    if(curTab==='rec') renderRecTab(CUR);
  }
}, 600000);

// Her 5 dakikada bir: Firebase sessiz senkronizasyon
setInterval(async()=>{
  if(window.FB_USER&&window.FB_MODE){
    try{
      const fields=await window.fbLoadFields(window.FB_USER.uid);
      if(fields?.length){ DB.fields=fields; saveLocalDB(); invSoilAll(); renderSB(); renderDash(); if(CUR){const u=DB.fields.find(f=>f.id===CUR.id);if(u)CUR=u;} }
    }catch(e){}
  }
}, 300000);

// ─── BAŞLATMA ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  const th=localStorage.getItem('tt_theme'); if(th==='dark') document.documentElement.setAttribute('dark','');
  loadSettings();
  setTimeout(()=>{ if(!window.FB_MODE) noFBNotice(); }, 1500);
  qs('#main')?.addEventListener('click',()=>{ if(window.innerWidth<=768) qs('#sb')?.classList.remove('open'); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closePhV(); });
});
