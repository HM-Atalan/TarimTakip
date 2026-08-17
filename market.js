// Anonim, resmi İzmir Büyükşehir Belediyesi açık hal fiyat servisi.
window.MARKET_CACHE={items:null,date:null,fetchedAt:0,error:null};

window.marketNorm=value=>String(value||'').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9ÇĞİÖŞÜ ]/g,' ').replace(/\s+/g,' ').trim();
window.marketAliases={
  'DOMATES':['DOMATES'],'BIBER':['BIBER'],'SALATALIK':['SALATALIK','HIYAR'],'PATATES':['PATATES'],
  'SOGAN':['SOGAN'],'ELMA':['ELMA'],'ARMUT':['ARMUT'],'PORTAKAL':['PORTAKAL'],'LIMON':['LIMON'],
  'MANDALINA':['MANDALINA'],'UZUM':['UZUM'],'KARPUZ':['KARPUZ'],'KAVUN':['KAVUN'],'ZEYTIN':['ZEYTIN']
};

window.extractMarketArray=body=>{
  if(Array.isArray(body)) return body;
  for(const value of Object.values(body||{})) if(Array.isArray(value)&&value.some(item=>item?.MalAdi||item?.malAdi)) return value;
  return [];
};

window.fetchMarketPrices=async(force=false)=>{
  if(!force&&window.MARKET_CACHE.items&&Date.now()-window.MARKET_CACHE.fetchedAt<3600000)return window.MARKET_CACHE;
  let lastError=null;
  for(let offset=0;offset<10;offset++){
    const date=new Date();date.setDate(date.getDate()-offset);const key=window.dateKey(date);
    try{
      const response=await fetch(`https://openapi.izmir.bel.tr/api/ibb/halfiyatlari/sebzemeyve/${key}`);
      if(!response.ok){lastError=new Error(`HTTP ${response.status}`);continue;}
      const raw=window.extractMarketArray(await response.json());
      const items=raw.map(item=>({
        name:String(item.MalAdi||item.malAdi||''),type:String(item.MalTipAdi||item.malTipAdi||''),
        unit:String(item.Birim||item.birim||'Kg'),min:Number(String(item.AsgariUcret??item.asgariUcret??0).replace(',','.')),
        max:Number(String(item.AzamiUcret??item.azamiUcret??0).replace(',','.'))
      })).filter(item=>item.name&&Number.isFinite(item.min)&&Number.isFinite(item.max));
      if(items.length){window.MARKET_CACHE={items,date:key,fetchedAt:Date.now(),error:null};return window.MARKET_CACHE;}
    }catch(error){lastError=error;}
  }
  window.MARKET_CACHE={items:null,date:null,fetchedAt:Date.now(),error:lastError||new Error('Güncel fiyat bulunamadı')};
  return window.MARKET_CACHE;
};

window.selectMarketProducts=(items,fields)=>{
  const crops=[...new Set((fields||[]).map(field=>window.marketNorm(field.crop)).filter(Boolean))];
  const wanted=new Set();
  crops.forEach(crop=>{
    wanted.add(crop);
    Object.entries(window.marketAliases).forEach(([key,aliases])=>{if(crop.includes(key)||aliases.some(alias=>crop.includes(alias)))aliases.forEach(alias=>wanted.add(alias));});
  });
  let selected=crops.length?items.filter(item=>[...wanted].some(name=>window.marketNorm(item.name).includes(name)||name.includes(window.marketNorm(item.name)))):[];
  if(!selected.length){
    const popular=['DOMATES','PATATES','SOGAN','BIBER','SALATALIK','ELMA','PORTAKAL','LIMON'];
    selected=popular.flatMap(name=>items.filter(item=>window.marketNorm(item.name).includes(name)).slice(0,1));
  }
  return selected.slice(0,12);
};

window.renderMarketPanel=async(force=false)=>{
  const element=qs('#market-prices');if(!element)return;
  element.innerHTML='<div class="empty">Güncel fiyatlar yükleniyor…</div>';
  const data=await window.fetchMarketPrices(force);
  if(!data.items){
    element.innerHTML=`<div class="empty">Fiyat servisine şu anda ulaşılamıyor.<br><a href="https://www.hal.gov.tr/Sayfalar/FiyatDetaylari.aspx" target="_blank" rel="noopener">Ticaret Bakanlığı güncel hal fiyatlarını aç</a></div>`;return;
  }
  const selected=window.selectMarketProducts(data.items,DB.fields);
  element.innerHTML=`<div style="font-size:11px;color:var(--text3);margin-bottom:9px;">${DB.fields.some(field=>field.crop)?'Kayıtlı ürünlerle eşleşen fiyatlar':'Popüler ürünlerden güncel görünüm'} · ${window.esc(data.date)} · İzmir Büyükşehir Belediyesi açık verisi</div><div class="market-grid">${selected.map(item=>`<div class="market-item"><div class="market-name">${window.esc(item.name)}${item.type?` <small>${window.esc(item.type)}</small>`:''}</div><div class="market-price">${item.min.toLocaleString('tr-TR')}–${item.max.toLocaleString('tr-TR')} ₺</div><div class="market-unit">/${window.esc(item.unit)}</div></div>`).join('')}</div><div style="margin-top:9px;font-size:10px;color:var(--text3);">Bilgi amaçlı referans fiyattır. <a href="https://www.hal.gov.tr/Sayfalar/FiyatDetaylari.aspx" target="_blank" rel="noopener">Türkiye Hal Kayıt Sistemi</a></div>`;
};
window.refreshMarketPrices=()=>window.renderMarketPanel(true);
