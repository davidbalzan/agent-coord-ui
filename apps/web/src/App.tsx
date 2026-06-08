import { Graph3D } from "./components/Graph3D.js";
import { SidePanel } from "./components/SidePanel.js";
import { HUD } from "./components/HUD.js";
import { FloatingTerminal } from "./components/FloatingTerminal.js";

export function App() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#000913",
        overflow: "hidden",
      }}
    >
      <HUD />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <main
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <Graph3D />
          <FloatingTerminal />
        </main>
        <SidePanel />
      </div>
    </div>
  );
}
