import { Graph3D } from "./components/Graph3D.js";
import { SidePanel } from "./components/SidePanel.js";
import { HUD } from "./components/HUD.js";
import { FloatingTerminal } from "./components/FloatingTerminal.js";
import { StatusTicker } from "./components/StatusTicker.js";
import { NexusOverlay } from "./components/NexusOverlay.js";
import { BacklogPanel } from "./components/BacklogPanel.js";
import { InboxPanel } from "./components/InboxPanel.js";
import { NotificationLayer } from "./components/NotificationLayer.js";

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
      {/* Graph fills all remaining space — panels float on top as fixed overlays */}
      <main
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <NexusOverlay />
        <Graph3D />
        <FloatingTerminal />
        <SidePanel />
        <BacklogPanel />
        <InboxPanel />
        <NotificationLayer />
      </main>
      <StatusTicker />
    </div>
  );
}
