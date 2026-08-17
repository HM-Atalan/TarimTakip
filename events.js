// ============================================================
// events.js – Olay (sulama, gübre, ilaç vb.) yönetimi
// ============================================================

window.updEF = () => {
  const type=qs('#e-type').value, df=qs('#e-dynfields');
  const ql=qs('#e-qlbl'), cl=qs('#e-clbl'), us=qs('#e-unit');
  if(type==='sulama'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>Sulama Yöntemi</label><select id="e-sm"><option>Damla sulama</option><option>Yağmurlama</option><option>Salma sulama</option><option>Karık sulama</option><option>Yüzey sulama</option><option>Mikro yağmurlama</option><option>El ile sulama</option></select></div><div class="fg"><label>Süre (saat)</label><input type="number" id="e-sd" placeholder="2" min="0" step="0.5"/></div></div><div class="hint" style="margin:-4px 0 8px;">💧 En doğru sonuç için <b>mm</b> birimini kullanın. ton/kg/litre girerseniz <b>dönüm başına</b> miktar olarak yorumlanır (ör. salma sulamada dönüme 40-80 ton tipiktir).</div>`;
    if(ql)ql.textContent='Su Miktarı (mm)'; if(us)us.value='mm'; if(cl)cl.textContent='Birim Fiyat (₺/m³)';
  }else if(type==='gübre'){
    const fg={
      '── N GÜBRE (Azot) ──':['Üre (%46 N)','Amonyum Nitrat (%33 N)','CAN — Kalsiyum Amonyum Nitrat (%26 N)','Amonyum Sülfat (%21 N)','Amonyum Klorür (%25 N)'],
      '── P GÜBRE (Fosfor) ──':['TSP — Triple Süperfos (%46 P₂O₅)','SSP — Tek Süperfos (%20 P₂O₅)','MAP — Monoamonyum Fosfat (12-61-0)','DAP (18-46-0)','Rock Fosfat'],
      '── K GÜBRE (Potasyum) ──':['Potasyum Klorür MOP (%60 K₂O)','Potasyum Sülfat SOP (%50 K₂O)','Potasyum Nitrat (13-0-46)','Potasyum Magnezyum Sülfat'],
      '── NPK KOMPOZİT ──':['NPK 20-20-0','NPK 15-15-15','NPK 8-16-16','NPK 10-20-20','NPK 12-12-17','NPK 20-10-10','NPK 5-10-25','NPK 3-9-27+4MgO','NPK 15-5-30','NPK 13-13-21','NPK 20-0-0','NPK 11-52-0 (MAP)'],
      '── Ca & Mg ──':['Kalsiyum Nitrat (%15.5 N + %26 CaO)','Magnezyum Sülfat — Kiserit (%27 MgO)','Kalsiyum Klorür','Dolomit (CaMg)','Kireç — Kalsit'],
      '── MİKRO ELEMENT ──':['Çinko Sülfat ZnSO₄','Demir Sülfat FeSO₄','Mangan Sülfat','Bor — Sodyum Tetraborat','Bakır Sülfat','Molibden (Na Molibdat)','Şelatlı Demir EDTA-Fe','Şelatlı Çinko EDTA-Zn','Şelatlı Mangan EDTA-Mn','Şelatlı Bakır EDTA-Cu','Multimikro Karışım'],
      '── ORGANİK & BİOSTİMÜLANT ──':['Humik Asit (%85)','Humik+Fulvik Asit','Fulvik Asit Konsantre','Deniz Yosunu Ekstre (Ascophyllum)','Aminoasit Kompleks','Organik gübre (kompost)','Organomineral Gübre (Sıvı)','Çiftlik gübresi','Leonardit','Vermikompost','Biyogübre Rhizobium','Mikoriza İnokulant (VAM)'],
      '── YAPRAK GÜBRE ──':['Yaprak gübresi NPK sıvı','Yaprak Ca+B','Yaprak Zn+Mn','Yaprak Fe+Mg','Yaprak Multimikro+İz Element'],
      '── ÖZEL ──':['Kükürt (%99 S granül)','Sodyum Molibdat','Silisyum Dioksit','Zeatin (Sitokinin)','Hümüs Toprağı']
    };
    let opt=''; for(const [g,items] of Object.entries(fg)){ opt+=`<optgroup label="${g}">${items.map(i=>`<option>${i}</option>`).join('')}</optgroup>`; }
    df.innerHTML=`<div class="fr"><div class="fg"><label>Gübre Türü / Ürün</label><select id="e-ft">${opt}</select></div><div class="fg"><label>Uygulama Yöntemi</label><select id="e-fa"><option>Topraktan serpme</option><option>Topraktan karıştırma</option><option>Bant uygulaması</option><option>Fertigasyon (damla ile)</option><option>Yapraktan ilaçlama</option><option>Toprak enjeksiyonu</option><option>Tohum ilaçlama</option></select></div></div><div class="fg"><label>Ticari Ürün / Marka (opsiyonel)</label><input type="text" id="e-fbrand" placeholder="Ürün adı, formülasyon..."/></div>`;
    if(ql)ql.textContent='Miktar (kg/da veya lt/da)'; if(us)us.value='kg'; if(cl)cl.textContent='Birim Fiyat (₺/kg)';
  }else if(type==='ilaç'){
    const pg={
      '── FUNGİSİT ──':['Bakır Sülfat — Bordo bulamacı','Bakır Hidroksit','Mankozeb','Metalaksil+Mankozeb','Tebukonazol','Trifloksistrobin','Azoksistrobin','Propikonazol','Iprodion','Boskalid','Fenheksamid','Kresoksim-metil','Difenokonazol','Penthiopyrad'],
      '── İNSEKTİSİT ──':['İmidakloprid','Tiyametoksam','Asetamiprit','Spirotetramat','Flonikamit','Klorpirfos','Deltametrin','Lambda-sihalotrin','Spinosad','Azadiraktin — Neem özü','Piretrin (doğal)'],
      '── AKARİSİT ──':['Abamektin','Bifenazat','Spiromesifen','Etoksazol','Fenproksimat','Heksitiazoks','Propargit'],
      '── HERBİSİT ──':['Glifosat','Pendimetalin','Metribuzin','İmazamoks','Bentazon','Fluroksipir','2,4-D Amin','Dikamba','Sülkotrion','Klomazon'],
      '── NEMATİSİT ──':['Oksamil','Etoprofos','Dazomet','Biyonematisit'],
      '── BİYOLOJİK ──':['Bacillus thuringiensis (Bt)','Bacillus subtilis','Beauveria bassiana','Metarhizium anisopliae','Trichoderma spp.','Chrysoperla carnea'],
      '── ORGANİK ──':['Sabunlu su','Kükürt tozu (%80 S)','Neem yağı (%100)','Piretrum','Kieselgur']
    };
    let opt=''; for(const [g,items] of Object.entries(pg)){ opt+=`<optgroup label="${g}">${items.map(i=>`<option>${i}</option>`).join('')}</optgroup>`; }
    df.innerHTML=`<div class="fr"><div class="fg"><label>Aktif Madde</label><select id="e-pt">${opt}</select></div><div class="fg"><label>Ticari Ürün / Marka</label><input type="text" id="e-pn" placeholder="Ürün adı..."/></div></div><div class="fr"><div class="fg"><label>Hedef</label><input type="text" id="e-ptarget" placeholder="Zararlı / hastalık..."/></div><div class="fg"><label>Ekipman</label><select id="e-papp"><option>Sırt pülverizatörü</option><option>Traktör pülverizatörü</option><option>Atomizör</option><option>Toprak uygulaması</option><option>Damla sulama ile</option></select></div></div>`;
    if(ql)ql.textContent='Toplam Miktar'; if(us)us.value='lt'; if(cl)cl.textContent='Birim Fiyat (₺/lt)';
  }else if(type==='yakıt'){
    df.innerHTML=`<div class="fr"><div class="fg"><label>Yakıt Türü</label><select id="e-ft2"><option>Motorin</option><option>Benzin</option><option>LPG</option><option>Elektrik (kWh)</option></select></div><div class="fg"><label>Araç / Ekipman</label><input type="text" id="e-fv" placeholder="Traktör, sulama motoru..."/></div></div>`;
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
};

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
};

window.saveEvent = async () => {
  const dt=qs('#e-date').value; if(!dt){ toast('Tarih zorunludur',true); return; }
  if(!CUR) return;
  const eid=qs('#e-eid').value;
  const qty=parseFloat(qs('#e-qty').value)||0;
  const cost=parseFloat(qs('#e-cost').value)||0;
  const extra={};
  ['e-sm','e-sd','e-ft','e-fa','e-fbrand','e-pn','e-pt','e-ptarget','e-papp','e-ft2','e-fv','e-hq','e-hu','e-hp','e-hb','e-wc','e-wd'].forEach(id=>{
    const el=qs('#'+id); if(el&&el.value) extra[id]=el.value;
  });
  let revenue = 0, profit = null;
  if(qs('#e-type').value === 'hasat') {
    const harvestQty = parseFloat(extra['e-hq']) || 0;
    const price = parseFloat(extra['e-hp']) || 0;
    revenue = harvestQty * price;
    profit = revenue - (cost * (qty||1));
  }
  const evType = qs('#e-type').value;

  const oldEv = eid ? (CUR.events||[]).find(e=>e.id===eid) : null;
  const oldDate = oldEv?.date || null;

  const ev={id:eid||gid(),date:dt,type:evType,notes:qs('#e-notes').value,cost,qty,unit:qs('#e-unit').value,planned:qs('#e-status').value==='planned',extra,total:+(cost*(qty||1)).toFixed(2), revenue, profit};
  if(eid){ const idx=(CUR.events||[]).findIndex(e=>e.id===eid); if(idx>=0) CUR.events[idx]=ev; else (CUR.events=CUR.events||[]).push(ev); }
  else (CUR.events=CUR.events||[]).push(ev);
  CUR.events.sort((a,b)=>b.date.localeCompare(a.date));
  invSoil(CUR.id);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR);

  const invalidateFrom = (oldDate && oldDate < dt) ? oldDate : dt;
  await window.invalidateRZWBFrom(CUR.id, invalidateFrom);

  // ══ FAZ 4 DÜZELTME (UI güncelliği): computeAllSoils(true) BURAYA,
  // aşağıdaki renderSB()/renderDash() çağrılarından ÖNCEYE taşındı.
  // Önceden EN SONDA çağrılıyordu — ama renderSB() ve renderDash()
  // KENDİ İÇLERİNDE force=false ile computeAllSoils() çağırıyor, ve bu
  // fonksiyon SOIL_CACHE'in 5 dakikalık TTL'i dolmadıysa CACHE'TEN
  // (bayat) veri döndürüyor. invalidateRZWBFrom, RZWB_CACHE'i doğru
  // şekilde temizlese de, ÜST SEVİYE SOIL_CACHE ayrı bir cache'tir ve
  // sadece force=true ile hemen temizlenir. Sonuç: kullanıcı bir olay
  // ekleyip/düzenleyip/silip ANINDA sidebar/dashboard'a baktığında,
  // düzeltme öncesi en fazla 5 dakika boyunca ESKİ nem yüzdesi
  // görebiliyordu. Artık computeAllSoils(true) ÖNCE çalışıyor, bu
  // yüzden ondan sonra gelen TÜM render çağrıları (renderFKPIs,
  // renderSoil, renderSB, renderDash) güncel veriyi kullanıyor.
  await window.computeAllSoils(true);

  closeM('event');
  // DÜZELTME: Önceden burada renderFieldPage(CUR) çağrılıyordu — bu fonksiyon
  // içeriden her zaman goTab('map') çağırdığı için, kullanıcı Olaylar
  // sekmesindeyken bir kayıt ekleyip/düzenlediğinde otomatik olarak Harita
  // sekmesine fırlatılıyordu. Bu hem can sıkıcıydı hem de yeni eklenen
  // sayfalama/filtre state'ini anlamsızlaştırıyordu. Artık hangi sekmedeysek
  // orada kalıyoruz, sadece o sekmenin içeriğini tazeliyoruz.
  if(qs('#fp-name')) qs('#fp-name').textContent = CUR.name;
  await renderFKPIs(CUR);
  if(curTab==='ev'){ EV_FILTER.page = 1; renderEvTab(CUR); }
  else if(curTab==='soil') await renderSoil(CUR);
  else if(curTab==='rec') await renderRecTab(CUR);
  await renderSB(); await renderDash();
  toast(eid?'Güncellendi':'Kaydedildi');
};

window.delEv = async (id) => {
  if(!CUR||!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return;

  const delEvent = (CUR.events||[]).find(e=>e.id===id);
  const delDate  = delEvent?.date || null;

  CUR.events=(CUR.events||[]).filter(e=>e.id!==id);
  invSoil(CUR.id);
  const fi=DB.fields.findIndex(f=>f.id===CUR.id); if(fi>=0) DB.fields[fi]=CUR;
  await saveFieldToDB(CUR);

  if(delDate) {
    await window.invalidateRZWBFrom(CUR.id, delDate);
  }

  // ══ FAZ 4 DÜZELTME: computeAllSoils(true), renderDash()'ten ÖNCEYE
  // taşındı — aynı gerekçe: renderDash() içeriden force=false ile
  // computeAllSoils() çağırıyor ve SOIL_CACHE'in 5dk TTL'i dolmadıysa
  // bayat veri döner. (bkz. saveEvent'teki aynı düzeltme, events.js)
  await window.computeAllSoils(true);

  renderEvTab(CUR); await renderDash(); toast('Silindi');
};

// ============================================================
// OLAY LİSTESİ — SAYFALAMA / FİLTRE / ARAMA
// ============================================================
// State tek bir tarla+sekme oturumu için tutulur. pageSize kullanıcı
// tercihi olarak localStorage'da kalıcıdır; diğer filtreler farklı bir
// tarlaya geçildiğinde sıfırlanır (kafa karışıklığını önlemek için).
window.EV_FILTER = window.EV_FILTER || {
  page: 1,
  pageSize: parseInt(localStorage.getItem('tt_ev_pagesize')) || 10,
  type: 'all',
  dateFrom: '',
  dateTo: '',
  search: '',
  fieldId: null,
};

window.onEvFilterChange = () => {
  EV_FILTER.search   = qs('#ev-search')?.value.trim().toLowerCase() || '';
  EV_FILTER.type     = qs('#ev-filter-type')?.value || 'all';
  EV_FILTER.dateFrom = qs('#ev-filter-from')?.value || '';
  EV_FILTER.dateTo   = qs('#ev-filter-to')?.value || '';
  EV_FILTER.page = 1;
  if(CUR) renderEvTab(CUR);
};

window.onEvPageSizeChange = () => {
  const val = parseInt(qs('#ev-pagesize')?.value) || 10;
  EV_FILTER.pageSize = val;
  EV_FILTER.page = 1;
  try{ localStorage.setItem('tt_ev_pagesize', String(val)); }catch(e){}
  if(CUR) renderEvTab(CUR);
};

window.clearEvFilters = () => {
  EV_FILTER.search = ''; EV_FILTER.type = 'all';
  EV_FILTER.dateFrom = ''; EV_FILTER.dateTo = '';
  EV_FILTER.page = 1;
  if(qs('#ev-search')) qs('#ev-search').value = '';
  if(qs('#ev-filter-type')) qs('#ev-filter-type').value = 'all';
  if(qs('#ev-filter-from')) qs('#ev-filter-from').value = '';
  if(qs('#ev-filter-to')) qs('#ev-filter-to').value = '';
  if(CUR) renderEvTab(CUR);
};

window.evGoToPage = (p) => {
  EV_FILTER.page = p;
  if(CUR) renderEvTab(CUR);
};

window.renderEvTab = (field) => {
  const tb=qs('#ev-tbody'); if(!tb) return;
  const F = EV_FILTER;

  // Farklı bir tarlaya geçilmişse filtre/arama/sayfa sıfırlanır
  // (sayfa boyutu tercihi kalıcı kalmaya devam eder)
  if(F.fieldId !== field.id){
    F.fieldId = field.id; F.page = 1; F.type = 'all';
    F.dateFrom = ''; F.dateTo = ''; F.search = '';
  }

  const allEvs = field.events||[];

  // Tür filtresi dropdown'ını bu tarladaki mevcut türlerle doldur
  const typeSel = qs('#ev-filter-type');
  if(typeSel){
    if(typeSel.dataset.fieldId !== field.id){
      const typesPresent = [...new Set(allEvs.map(e=>e.type))].sort();
      typeSel.innerHTML = '<option value="all">Tüm Türler</option>' +
        typesPresent.map(t=>`<option value="${t}">${EVI[t]||'📝'} ${t}</option>`).join('');
      typeSel.dataset.fieldId = field.id;
    }
    typeSel.value = F.type;
  }
  if(qs('#ev-search') && qs('#ev-search').value !== F.search) qs('#ev-search').value = F.search;
  if(qs('#ev-filter-from')) qs('#ev-filter-from').value = F.dateFrom;
  if(qs('#ev-filter-to')) qs('#ev-filter-to').value = F.dateTo;
  if(qs('#ev-pagesize')) qs('#ev-pagesize').value = String(F.pageSize);

  const pg=qs('#ev-pagination'); const cc=qs('#ev-cost'); const lbl=qs('#ev-cost-label');

  if(!allEvs.length){
    tb.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:22px;color:var(--text3);">Kayıt yok.</td></tr>`;
    if(cc) cc.innerHTML=''; if(pg) pg.innerHTML=''; if(lbl) lbl.textContent='';
    return;
  }

  // ── FİLTRELEME (tür, tarih aralığı, tür+açıklama araması) ──
  const filtered = allEvs.filter(e=>{
    if(F.type!=='all' && e.type!==F.type) return false;
    if(F.dateFrom && e.date < F.dateFrom) return false;
    if(F.dateTo && e.date > F.dateTo) return false;
    if(F.search){
      const extraStr = e.extra ? Object.values(e.extra).join(' ').toLowerCase() : '';
      const hay = `${e.type} ${e.notes||''} ${extraStr}`.toLowerCase();
      if(!hay.includes(F.search)) return false;
    }
    return true;
  });

  // ── SAYFALAMA ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / F.pageSize));
  if(F.page > totalPages) F.page = totalPages;
  if(F.page < 1) F.page = 1;
  const startIdx = (F.page-1)*F.pageSize;
  const pageItems = filtered.slice(startIdx, startIdx+F.pageSize);

  if(!filtered.length){
    tb.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:22px;color:var(--text3);">🔍 Filtreyle eşleşen kayıt yok.</td></tr>`;
  }else{
    tb.innerHTML=pageItems.map(e=>{
      const total=e.total||(e.cost*(e.qty||1));
      const extra=e.extra?Object.entries(e.extra).filter(([k])=>['e-ft','e-pn','e-sm','e-ft2','e-fbrand'].includes(k)).map(([,v])=>v).join(' · '):'';
      return`<tr>
        <td style="white-space:nowrap;">${fd(e.date)}</td>
        <td><span>${EVI[e.type]||'📝'}</span> ${e.type}${e.planned?'<br/><span class="tag tb" style="font-size:9px;">Planlandı</span>':''}</td>
        <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${extra?`<small style="color:var(--text3);">${window.esc(extra)}</small><br/>`:''}${window.esc(e.notes||'—')}</td>
        <td>${e.qty||'—'} ${e.unit||''}</td>
        <td>${e.cost?e.cost.toLocaleString('tr-TR')+'₺':'—'}</td>
        <td style="font-weight:600;">${total?Math.round(total).toLocaleString('tr-TR')+'₺':'—'}</td>
        <td>${e.revenue?Math.round(e.revenue).toLocaleString('tr-TR')+'₺':(e.type==='hasat'?'—':'')}</td>
        <td><div style="display:flex;gap:3px;"><button class="btn btnxs btna" onclick="openEM('${e.id}')">✏️</button><button class="btn btnxs btnd" onclick="delEv('${e.id}')">✕</button></div></td>
      </tr>`;
    }).join('');
  }

  // ── SAYFALAMA KONTROLLERİ ──
  if(pg){
    if(totalPages<=1){
      pg.innerHTML = `<span style="color:var(--text3);">${filtered.length} kayıt${filtered.length!==allEvs.length?` (${allEvs.length} toplam içinden filtrelendi)`:''}</span>`;
    }else{
      const rangeStart = filtered.length? startIdx+1 : 0;
      const rangeEnd = Math.min(startIdx+F.pageSize, filtered.length);
      pg.innerHTML = `
        <span style="color:var(--text3);">${rangeStart}–${rangeEnd} / ${filtered.length} kayıt</span>
        <div style="display:flex;gap:4px;align-items:center;">
          <button class="btn btnxs" style="opacity:${F.page<=1?0.4:1};" ${F.page<=1?'disabled':''} onclick="window.evGoToPage(${F.page-1})">‹ Önceki</button>
          <span style="padding:0 6px;">Sayfa ${F.page} / ${totalPages}</span>
          <button class="btn btnxs" style="opacity:${F.page>=totalPages?0.4:1};" ${F.page>=totalPages?'disabled':''} onclick="window.evGoToPage(${F.page+1})">Sonraki ›</button>
        </div>`;
    }
  }

  // ── MALİYET DAĞILIMI (aktif filtreye göre) ──
  const cm={};let tot=0, totRev=0, totProfit=0;
  filtered.filter(e=>e.cost>0).forEach(e=>{ const t=e.total||(e.cost*(e.qty||1)); cm[e.type]=(cm[e.type]||0)+t; tot+=t; });
  filtered.filter(e=>e.revenue).forEach(e=>{ totRev+=e.revenue; });
  totProfit = totRev - tot;
  if(cc) cc.innerHTML=Object.keys(cm).length
    ? Object.entries(cm).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="pr"><span class="prl">${EVI[k]||'📝'} ${k}</span><div class="prt"><div class="prf" style="width:${tot?Math.round(v/tot*100):0}%;background:${EVC[k]||'var(--green2)'};"></div></div><span class="prv">${Math.round(v).toLocaleString()}₺</span></div>`).join('')+`
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;padding-top:9px;margin-top:5px;border-top:1px solid var(--bdr);"><span>Toplam Maliyet</span><span>${Math.round(tot).toLocaleString('tr-TR')} ₺</span></div>
    <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:6px;"><span>Toplam Gelir</span><span>${Math.round(totRev).toLocaleString('tr-TR')} ₺</span></div>
    <div style="display:flex;justify-content:space-between;font-weight:800;font-size:15px;margin-top:6px;color:${totProfit>=0?'var(--green2)':'var(--red)'}"><span>Net Kar</span><span>${Math.round(totProfit).toLocaleString('tr-TR')} ₺</span></div>`
    : 'Maliyet kaydı yok.';

  if(lbl) lbl.textContent = filtered.length!==allEvs.length ? `(filtrelenmiş ${filtered.length}/${allEvs.length} kayıt)` : '';
};
