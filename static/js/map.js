// static/js/map.js
(function () {
  // ========================
  // CONFIG — service URLs
  // ========================
  // You can replace these with state-specific services later if desired.
  const SERVICE_URLS = {
    // Public Lands (PAD-US statewide features) — Living Atlas
    PADUS: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Protected_Areas_State/FeatureServer/0',

    // USA Park Boundaries — Living Atlas (includes state parks; we’ll style lightly)
    // If this ever changes, swap to your state’s Parks layer.
    PARKS: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Park_Boundaries/FeatureServer/0',

    // Walk-In Hunting Access (WIHA) — paste your Kansas WIHA FeatureServer layer /0 here.
    // If unknown right now, leave it empty; the checkbox will show a gentle warning.
    WIHA: 'https://services1.arcgis.com/q2CglofYX6ACNEeu/arcgis/rest/services/24_25_7_29/FeatureServer/0'
    // Example placeholder:
    // WIHA: 'https://<kdwpt-or-ksgeoportal>/arcgis/rest/services/WalkIn_Hunting_Access_2025/FeatureServer/0'
  };

  // ========================
  // Base map setup
  // ========================
  const sat = L.tileLayer(
    // Esri World Imagery (standard basemap)
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles © Esri — World Imagery' }
  );
  const topo = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenTopoMap' }
  );
  const osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenStreetMap' }
  );

  const map = L.map('map', { center: [38.8845, -99.3260], zoom: 13, layers: [sat] });
  const baseMapLookup = { sat, topo, osm };

  const basemapSelect = document.getElementById('basemapSelect');
  basemapSelect?.addEventListener('change', () => {
    Object.values(baseMapLookup).forEach(t => map.removeLayer(t));
    (baseMapLookup[basemapSelect.value] || sat).addTo(map);
  });

  // ========================
  // Overlay layers (Esri-Leaflet)
  // ========================
  const hasEsri = !!(L && L.esri);
  let lyrPublic = null, lyrParks = null, lyrWiha = null;

  if (hasEsri) {
    // Public Lands: soft green wash, OnX-like
    if (SERVICE_URLS.PADUS) {
      lyrPublic = L.esri.featureLayer({
        url: SERVICE_URLS.PADUS,
        simplifyFactor: 0.5,
        precision: 5,
        minZoom: 7,
        style: () => ({ color: '#3ddc97', weight: 1, fillColor: '#3ddc97', fillOpacity: 0.15 })
      }).on('click', (e) => {
        const p = e.layer.feature?.properties || {};
        const unit = p.Unit_Name || p.Local_Name || 'Public Land';
        const owner = p.Owner_Name || p.Mang_Name || p.Own_Name || 'Unknown manager';
        e.layer.bindPopup(`<strong>${unit}</strong><br>Owner/Manager: ${owner}`).openPopup();
      });
      lyrPublic.addTo(map);
    }

    // State Parks/Lakes (parks emphasis): blue wash
    if (SERVICE_URLS.PARKS) {
      lyrParks = L.esri.featureLayer({
        url: SERVICE_URLS.PARKS,
        minZoom: 8,
        simplifyFactor: 0.5,
        precision: 5,
        style: () => ({ color: '#1e88e5', weight: 1, fillColor: '#1e88e5', fillOpacity: 0.20 })
      }).on('click', (e) => {
        const p = e.layer.feature?.properties || {};
        const name = p.PARK_NAME || p.NAME || 'Park/Rec Area';
        const type = p.PARK_TYPE || p.TYPE || '';
        e.layer.bindPopup(`<strong>${name}</strong><br>${type}`).openPopup();
      });
      lyrParks.addTo(map);
    }

    // WIHA (Walk-In Hunting Access): amber wash
    if (SERVICE_URLS.WIHA) {
      lyrWiha = L.esri.featureLayer({
        url: SERVICE_URLS.WIHA,
        minZoom: 10,
        simplifyFactor: 0.4,
        precision: 5,
        style: () => ({ color: '#ffca28', weight: 1, fillColor: '#ffca28', fillOpacity: 0.25 })
      }).on('click', (e) => {
        const p = e.layer.feature?.properties || {};
        const name = p.NAME || p.TRACT_NAME || 'WIHA Tract';
        const dates = p.SEASON || p.DATES || '';
        const notes = p.NOTES || '';
        e.layer.bindPopup(`<strong>${name}</strong><br>${dates}<br><small>${notes}</small>`).openPopup();
      });
      lyrWiha.addTo(map);
    }
  } else {
    console.warn('Esri-Leaflet not found — public overlays disabled.');
  }

  // Layer toggles
  const cbPublic = document.getElementById('lyrPublic');
  const cbState  = document.getElementById('lyrState');
  const cbWiha   = document.getElementById('lyrWiha');

  function toggleLayer(layer, on) {
    if (!layer) return;
    if (on) map.addLayer(layer); else map.removeLayer(layer);
  }

  cbPublic?.addEventListener('change', () => {
    if (!lyrPublic) return;
    toggleLayer(lyrPublic, cbPublic.checked);
  });

  cbState?.addEventListener('change', () => {
    if (!lyrParks) return;
    toggleLayer(lyrParks, cbState.checked);
  });

  cbWiha?.addEventListener('change', () => {
    if (!SERVICE_URLS.WIHA) {
      alert('WIHA layer URL not configured yet.\nOpen map.js and set SERVICE_URLS.WIHA to your Kansas WIHA FeatureServer /0.');
      cbWiha.checked = false;
      return;
    }
    toggleLayer(lyrWiha, cbWiha.checked);
  });

  // Zoom gating (keeps heavy layers off until closer)
  map.on('zoomend', () => {
    const z = map.getZoom();
    if (lyrWiha && cbWiha?.checked && z < 10) map.removeLayer(lyrWiha);
    if (lyrWiha && cbWiha?.checked && z >= 10) map.addLayer(lyrWiha);
  });

  // ========================
  // Waypoints / Boundaries / Location
  // ========================
  const waypointLayer = L.layerGroup().addTo(map);
  const boundaryLayer = L.layerGroup().addTo(map);

  // Geolocation (works on https OR localhost/127.0.0.1)
  const locateBtn = document.getElementById('locateBtn');
  locateBtn?.addEventListener('click', () => {
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
  });
  map.on('locationfound', e => {
    L.marker(e.latlng, { title: 'You are here' })
      .addTo(waypointLayer).bindPopup('Current Location').openPopup();
  });
  map.on('locationerror', () => alert('Location blocked/unavailable. Check site permissions.'));

  // Drop waypoint at map center
  const waypointBtn = document.getElementById('waypointBtn');
  waypointBtn?.addEventListener('click', () => {
    const c = map.getCenter();
    const m = L.marker(c, { draggable: true }).addTo(waypointLayer);
    m.bindPopup(`Waypoint<br><small>${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}</small>`).openPopup();
  });

  // Simple boundary drawing
  let drawing = false, current = [], tempLine = null;
  const drawBtn   = document.getElementById('drawPolyBtn');
  const finishBtn = document.getElementById('finishPolyBtn');
  const clearBtn  = document.getElementById('clearBtn');

  drawBtn?.addEventListener('click', () => {
    drawing = true; current = [];
    if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
    finishBtn?.classList.remove('d-none');
  });

  finishBtn?.addEventListener('click', () => {
    if (current.length >= 3) {
      L.polygon(current, { color: '#00c853', weight: 2, fillOpacity: 0.2 })
        .addTo(boundaryLayer).bindPopup('Custom Boundary');
    }
    drawing = false; current = [];
    if (tempLine) { map.removeLayer(tempLine); tempLine = null; }
    finishBtn?.classList.add('d-none');
  });

  map.on('click', (e) => {
    if (!drawing) return;
    current.push([e.latlng.lat, e.latlng.lng]);
    if (tempLine) map.removeLayer(tempLine);
    tempLine = L.polyline(current, { color: '#999', dashArray: '4 4' }).addTo(map);
  });

  clearBtn?.addEventListener('click', () => {
    waypointLayer.clearLayers();
    boundaryLayer.clearLayers();
  });
})();
