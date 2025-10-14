(function(){
  // Base layers
  const sat = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap — (placeholder for Satellite, swap to Esri imagery if allowed)'
  });
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap'
  });
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  });

  const map = L.map('map', { center: [38.8845, -99.3260], zoom: 13, layers: [sat] });

  // Swap in Esri WorldImagery if you want real satellite tiles (check terms):
  // const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri' });

  const baseMapLookup = { sat, topo, osm };

  // Layer groups
  const waypointLayer = L.layerGroup().addTo(map);
  const boundaryLayer = L.layerGroup().addTo(map);
  const propertyLayer = L.layerGroup().addTo(map);

  // Load demo properties
  function loadProperties(list){
    propertyLayer.clearLayers();
    const ul = document.getElementById('propertyList');
    ul.innerHTML='';
    list.forEach(p => {
      const poly = L.polygon(p.coords, { color:'#00c853', weight:2, fillOpacity:0.15 }).addTo(propertyLayer);
      poly.bindPopup(`<strong>${p.name}</strong><br>${p.notes}`);
      const li = document.createElement('li');
      li.textContent = `${p.name} — ${p.notes}`;
      li.className = 'mb-1';
      li.style.cursor = 'pointer';
      li.onclick = ()=>{ map.fitBounds(poly.getBounds(), { padding:[20,20] }); poly.openPopup(); };
      ul.appendChild(li);
    });
  }
  loadProperties(PROPERTIES || []);

  // Basemap switcher
  const basemapSelect = document.getElementById('basemapSelect');
  basemapSelect.addEventListener('change', () => {
    Object.values(baseMapLookup).forEach(t => map.removeLayer(t));
    baseMapLookup[basemapSelect.value].addTo(map);
  });

  // Geolocation
  document.getElementById('locateBtn').addEventListener('click', () => {
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
  });
  map.on('locationfound', e => {
    L.marker(e.latlng, { title: 'You are here' }).addTo(waypointLayer).bindPopup('Current Location').openPopup();
  });
  map.on('locationerror', () => alert('Location unavailable. Check browser permissions.'));

  // Waypoints
  document.getElementById('waypointBtn').addEventListener('click', () => {
    const c = map.getCenter();
    const m = L.marker(c, { draggable:true }).addTo(waypointLayer);
    m.bindPopup(`Waypoint<br><small>${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}</small>`).openPopup();
  });

  // Draw polygon (simple click-to-add)
  let drawing = false;
  let currentLatLngs = [];
  let currentTempPolyline = null;

  const drawBtn = document.getElementById('drawPolyBtn');
  const finishBtn = document.getElementById('finishPolyBtn');

  drawBtn.addEventListener('click', () => {
    drawing = true; currentLatLngs = [];
    if (currentTempPolyline) { map.removeLayer(currentTempPolyline); currentTempPolyline = null; }
    finishBtn.classList.remove('d-none');
  });

  finishBtn.addEventListener('click', () => {
    if (currentLatLngs.length >= 3) {
      const poly = L.polygon(currentLatLngs, { color:'#00c853', weight:2, fillOpacity:0.2 }).addTo(boundaryLayer);
      poly.bindPopup('Custom Boundary');
    }
    drawing = false; currentLatLngs = [];
    if (currentTempPolyline) { map.removeLayer(currentTempPolyline); currentTempPolyline = null; }
    finishBtn.classList.add('d-none');
  });

  map.on('click', (e) => {
    if (!drawing) return;
    currentLatLngs.push([e.latlng.lat, e.latlng.lng]);
    if (currentTempPolyline) map.removeLayer(currentTempPolyline);
    currentTempPolyline = L.polyline(currentLatLngs, { color:'#999', dashArray:'4 4' }).addTo(map);
  });

  // Clear layers
  document.getElementById('clearBtn').addEventListener('click', () => {
    waypointLayer.clearLayers();
    boundaryLayer.clearLayers();
  });
})();