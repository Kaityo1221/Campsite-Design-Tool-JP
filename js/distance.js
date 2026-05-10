function getDistanceMeters(a, b) {
  const R = 6378137;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}
function classifyDistanceRisk(distance) {
  if (distance < 20) return "密集";
  if (distance < 30) return "滞留";
  if (distance < 40) return "軽微";
  return null;
}
async function loadDistanceFile() {
  const fileInput = document.getElementById("distanceFile");
  const container = document.getElementById("distanceLayerList");

  if (!fileInput.files.length) return;

  const file = fileInput.files[0];
  const fileName = file.name.toLowerCase();

  window._layerPoints = {};

  if (fileName.endsWith(".csv")) {
    const text = await file.text();
    const points = parseCSV(text);
    window._layerPoints["CSV_POI"] = points;
    renderLayerSelector(["CSV_POI"], container);
    return;
  }

  const result = await extractLayersFromKML(file);
  window._layerPoints = result.pointsByLayer;
  renderLayerSelector(result.layers, container);
}

async function extractLayersFromKML(file) {
  let kmlText = null;
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".kml")) {
    kmlText = await file.text();
  } else if (fileName.endsWith(".kmz") || fileName.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);

    for (const name in zip.files) {
      if (name.toLowerCase().endsWith(".kml")) {
        kmlText = await zip.files[name].async("text");
        break;
      }

      if (name.toLowerCase().endsWith(".kmz")) {
        const kmzBlob = await zip.files[name].async("blob");
        const kmzZip = await JSZip.loadAsync(kmzBlob);

        for (const innerName in kmzZip.files) {
          if (innerName.toLowerCase().endsWith(".kml")) {
            kmlText = await kmzZip.files[innerName].async("text");
            break;
          }
        }
      }
    }
  }

  if (!kmlText) {
    return { layers: [], pointsByLayer: {} };
  }

  const xml = new DOMParser().parseFromString(kmlText, "application/xml");
  const pointsByLayer = extractPointsByLayer(xml);
  const layers = Object.keys(pointsByLayer);

  return {
    layers,
    pointsByLayer
  };
}
function extractPointsByLayer(xml) {
  const result = {};

  const folders = Array.from(xml.getElementsByTagName("Folder"));

  folders.forEach(folder => {
    const layerName =
      folder.getElementsByTagName("name")[0]?.textContent || "無名レイヤー";

    const placemarks = Array.from(folder.getElementsByTagName("Placemark"));

    result[layerName] = placemarks.map(pm => {
      const point = pm.getElementsByTagName("Point")[0];
      if (!point) return null;

      const coord = point.getElementsByTagName("coordinates")[0]?.textContent;
      if (!coord) return null;

      const [lng, lat] = coord.trim().split(",").map(Number);
      if (isNaN(lat) || isNaN(lng)) return null;

      return {
        lat,
        lng,
        name: pm.getElementsByTagName("name")[0]?.textContent || "POI",
        layer: layerName
      };
    }).filter(Boolean);
  });

  return result;
}