// Fetches NINA warning data from warnung.bund.de/api31 and writes
// a GeoJSON FeatureCollection to public/data/warnings.json.
// Run by GitHub Actions every 5 minutes.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://warnung.bund.de/api31";
const SOURCES = ["mowas", "katwarn", "biwapp", "dwd", "lhp", "police"];

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  // 1. Fetch all mapData sources in parallel
  const results = await Promise.allSettled(
    SOURCES.map((source) =>
      fetchJSON(`${BASE_URL}/${source}/mapData.json`).then((items) =>
        items.map((item) => ({ ...item, source }))
      )
    )
  );

  const warnings = results.flatMap((r, i) => {
    if (r.status === "fulfilled") return r.value;
    console.warn(`[SKIP] ${SOURCES[i]}/mapData.json: ${r.reason.message}`);
    return [];
  });

  console.log(`Loaded ${warnings.length} warnings from ${SOURCES.length} sources`);

  // 2. Fetch GeoJSON for each warning in parallel (ignore failures)
  const geoResults = await Promise.allSettled(
    warnings.map((w) =>
      fetchJSON(`${BASE_URL}/warnings/${w.id}.geojson`).then((geo) => ({
        warning: w,
        geo,
      }))
    )
  );

  const features = [];

  for (const result of geoResults) {
    if (result.status !== "fulfilled") continue;
    const { warning, geo } = result.value;
    if (!geo) continue;

    const props = {
      id: warning.id,
      source: warning.source,
      severity: warning.severity || "Unknown",
      headline: warning.i18nTitle?.de || warning.id,
      startDate: warning.startDate,
      type: warning.type,
    };

    if (geo.type === "FeatureCollection" && Array.isArray(geo.features)) {
      for (const f of geo.features) {
        if (f.geometry) {
          features.push({ ...f, properties: { ...f.properties, ...props } });
        }
      }
    } else if (geo.type === "Feature" && geo.geometry) {
      features.push({ ...geo, properties: { ...geo.properties, ...props } });
    } else if (geo.coordinates || geo.geometries) {
      // Raw geometry object
      features.push({ type: "Feature", geometry: geo, properties: props });
    }
  }

  const geojson = {
    type: "FeatureCollection",
    generated: new Date().toISOString(),
    features,
  };

  const outputPath = path.join(__dirname, "..", "public", "data", "warnings.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(geojson));
  console.log(`Wrote ${features.length} features to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
