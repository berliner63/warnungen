import NinaMap from "./components/NinaMap";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>NINA Warnungen</h1>
        <span className="subtitle">Offizielle Warnungen des BBK</span>
      </header>
      <main className="map-container">
        <NinaMap />
      </main>
    </div>
  );
}

export default App;
