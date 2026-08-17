// ============================================================
// map.js – Leaflet harita oluşturma
// ============================================================

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
    const isActive = f.id === field?.id;
    const color = f.color || '#40916c';
    if(f.polygon && f.polygon.length >= 3) {
      const poly = L.polygon(f.polygon, {
        color: color,
        fillColor: color,
        fillOpacity: isActive ? 0.35 : 0.18,
        weight: isActive ? 3 : 1.5
      });
      poly.bindPopup(`<b>${window.esc(f.name)}</b><br/>${window.esc(f.crop||'—')} · ${window.esc(f.area)} ${window.esc(f.areaUnit||'dönüm')}`);
      poly.addTo(lmap);
      if(isActive) {
        setTimeout(()=>poly.openPopup(), 300);
        lmap.fitBounds(poly.getBounds(), {padding:[20,20]});
      }
    } else {
      const c=L.circleMarker([f.lat,f.lon],{
        radius: isActive ? 11 : 7,
        color, fillColor: color,
        fillOpacity: 0.7,
        weight: isActive ? 3 : 1.5
      });
      c.bindPopup(`<b>${window.esc(f.name)}</b><br/>${window.esc(f.crop||'—')} · ${window.esc(f.area)} ${window.esc(f.areaUnit||'dönüm')}`);
      c.addTo(lmap);
      if(isActive) setTimeout(()=>c.openPopup(), 300);
    }
  });
};
