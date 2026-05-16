import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./NinaMap.css";

// Lokale Datei – wird von GitHub Actions alle 5 Minuten aktualisiert
const WARNINGS_URL = import.meta.env.BASE_URL + "data/warnings.json";

// Farben nach NINA-Warnstufe
const SEVERITY_COLORS = {
  Extreme: "#7b0000",
  Severe: "#cc0000",
  Moderate: "#ff8800",
  Minor: "#ffcc00",
  Unknown: "#888888",
};

function severityColor(severity) {
  return SEVERITY_COLORS[severity] || SEVERITY_COLORS.Unknown;
}

function styleFeature(feature) {
  const color = severityColor(feature?.properties?.severity);
  return {
    color,
    weight: 2,
    fillColor: color,
    fillOpacity: 0.35,
  };
}

function onEachFeature(feature, layer) {
  if (feature.properties) {
    const { headline, severity, description } = feature.properties;
    layer.bindPopup(`
      <strong>${headline || "Warnung"}</strong><br/>
      Stufe: ${severity || "–"}<br/>
      ${description ? `<p>${description}</p>` : ""}
    `);
  }
}

// Hilfreich: Karte an Grenzen anpassen
function FitBounds({ geojson }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson || !geojson.features || geojson.features.length === 0) return;
    // Karte bleibt auf Deutschland zentriert – keine automatische Anpassung
  }, [geojson, map]);
  return null;
}

export default function NinaMap() {
  const [geojson, setGeojson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function loadWarnings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(WARNINGS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setGeojson(data);
      setLastUpdate(
        data.generated
          ? new Date(data.generated).toLocaleTimeString("de-DE")
          : new Date().toLocaleTimeString("de-DE")
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarnings();
    const interval = setInterval(loadWarnings, 60_000); // jede Minute aktualisieren
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="nina-map-wrapper">
      <div className="nina-toolbar">
        {loading && <span className="status loading">Lade Warnungen…</span>}
        {error && <span className="status error">Fehler: {error}</span>}
        {!loading && !error && (
          <span className="status ok">
            {geojson?.features?.length ?? 0} Warngebiet
            {geojson?.features?.length !== 1 ? "e" : ""} aktiv
          </span>
        )}
        {lastUpdate && (
          <span className="last-update">Stand: {lastUpdate}</span>
        )}
        <button className="refresh-btn" onClick={loadWarnings} disabled={loading}>
          ↻ Aktualisieren
        </button>
        <div className="legend">
          {Object.entries(SEVERITY_COLORS).map(([label, color]) => (
            <span key={label} className="legend-item">
              <span
                className="legend-dot"
                style={{ background: color }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <MapContainer
        center={[51.1657, 10.4515]}
        zoom={6}
        className="leaflet-map"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geojson && geojson.features.length > 0 && (
          <GeoJSON
            key={lastUpdate}
            data={geojson}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
        <FitBounds geojson={geojson} />
      </MapContainer>
    </div>
  );
}
