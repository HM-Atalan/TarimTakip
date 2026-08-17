// ============================================================
// phenology.js – Fenoloji, hasat tahmini, GDD
// ============================================================

window.calcDailyGDD = (cropParams, day) => {
  const tmax = Number(day?.tmax);
  const tmin = Number(day?.tmin);
  if (![tmax, tmin].every(Number.isFinite) || tmax < tmin) return null;
  const tavg = (tmax + tmin) / 2;
  return Math.max(0, Math.min(tavg, cropParams.tm) - cropParams.tb);
};

window.calcGDD = (field, untilDate = tstr()) => {
  const a = window.agrd(field.crop);
  if(!field.plantDate) return null;
  const wxDays = window.getBestWXDays(field);
  let acc = 0;
  const seen = new Set();
  wxDays.filter(d => d.date >= field.plantDate && d.date <= untilDate).forEach(d => {
    if (seen.has(d.date)) return;
    seen.add(d.date);
    const daily = window.calcDailyGDD(a, d);
    if (daily !== null) acc += daily;
  });
  return Math.round(acc);
};

window.calcPheno = (field) => {
  const a = window.agrd(field.crop);
  const gdd = window.calcGDD(field);
  if(gdd===null) return null;
  const days = field.plantDate ? Math.round((Date.now()-new Date(field.plantDate+'T00:00:00'))/(864e5)) : 0;
  let si = a.st.length-1;
  for(let i=0; i<a.gd.length; i++){ if(gdd < a.gd[i]){si=i; break;} }
  const gs = si>0 ? a.gd[si-1] : 0;
  const ge = a.gd[si] || a.gd[a.gd.length-1];
  const stagePct = Math.min(100, Math.round((gdd-gs)/Math.max(1,ge-gs)*100));
  const totPct = Math.min(100, Math.round(gdd/(a.gd[a.gd.length-1]||1)*100));
  return {gdd, si, stage:a.st[si]||'Olgunluk', stagePct, totPct, days, a, plantingAge: field.plantingAge || 0};
};

window.calcHarvest = (field) => {
  const a = window.agrd(field.crop);
  const gdd = window.calcGDD(field);
  if(!field.plantDate){
    return field.harvestDate
      ? {estDate:field.harvestDate, daysLeft:Math.round((new Date(field.harvestDate)-Date.now())/(864e5)), conf:'manuel', gddPct:null}
      : null;
  }
  const gddTarget = a.gd[a.gd.length-1];
  const remain = Math.max(0, gddTarget - (gdd||0));
  const wxAll = window.getBestWXDays(field);
  const fut = wxAll.filter(d=>d.date>tstr()).slice(0,14);
  const avgDGDD = fut.length>0
    ? fut.reduce((s,d)=>s+(window.calcDailyGDD(a, d) ?? 0),0)/fut.length
    : Math.max(1, a.to - a.tb)*0.55;
  const dGDD = avgDGDD>0 ? Math.round(remain/avgDGDD) : a.td;
  const dCal = Math.max(0, a.td - Math.round((Date.now()-new Date(field.plantDate+'T00:00:00'))/(864e5)));
  const blend = Math.round(dGDD*0.65 + dCal*0.35);
  const est = new Date(); est.setDate(est.getDate()+blend);
  const historyLen = window.getBestWXDays(field).filter(d=>d.date<=tstr()).length;
  const conf = historyLen >= 60 ? 'yüksek' : historyLen >= 14 ? 'orta' : 'düşük';
  const gddPct = Math.min(100, Math.round((gdd||0)/gddTarget*100));
  let dev = null;
  if(field.harvestDate) dev = blend - Math.round((new Date(field.harvestDate)-Date.now())/(864e5));
  return {estDate:est.toISOString().slice(0,10), daysLeft:blend, conf, gddAcc:gdd||0, gddTarget, gddPct, manDate:field.harvestDate||null, dev, already:blend<=0};
};

window.calcSolar = (field) => {
  const wxAll = window.getBestWXDays(field);
  const td = wxAll.find(d=>d.date===tstr()); if(!td) return null;
  const doy = Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/(864e5));
  const decl = 23.45 * Math.sin((284+doy)*Math.PI/180);
  const maxSun = Math.min(16, Math.max(4, 12+4*Math.sin((field.lat-decl)*Math.PI/180)));
  const code = td.code||0;
  const cf = code<=1?1.0:code<=3?0.82:code<=49?0.5:code<=80?0.35:0.2;
  const sunH = Math.round(maxSun*cf*10)/10;
  const rad = Math.round(sunH*2.5*cf*10)/10;
  const a = window.agrd(field.crop);
  const hs = td.tmax>a.tm?'stres':td.tmax>a.to+6?'uyarı':td.tmax<a.mn+5?'soğuk':'normal';
  return {sunH, rad, cf, hs, topt:a.to, tmaxLim:a.tm, minT:a.mn, actMax:td.tmax};
};
