import { lazy, Suspense } from "react";
import { Graph3D } from "./components/Graph3D.js";
import { SidePanel } from "./components/SidePanel.js";
import { HUD } from "./components/HUD.js";
import { FloatingTerminal } from "./components/FloatingTerminal.js";
import { StatusTicker } from "./components/StatusTicker.js";
import { NexusOverlay } from "./components/NexusOverlay.js";
import { BacklogPanel } from "./components/BacklogPanel.js";
import { InboxPanel } from "./components/InboxPanel.js";
import { NotificationLayer } from "./components/NotificationLayer.js";
import { ActivityLog } from "./components/ActivityLog.js";

// WebXR spike (Phase 10) — opt-in via ?xr so the XR chunk never loads on the
// default desktop path. See docs/phases/phase10/.
const XrEntry = lazy(() => import("./xr/XrEntry.js"));
const xrRequested = new URLSearchParams(window.location.search).has("xr");

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
        <ActivityLog />
        <FloatingTerminal />
        <SidePanel />
        <BacklogPanel />
        <InboxPanel />
        <NotificationLayer />
        {xrRequested && (
          <Suspense fallback={null}>
            <XrEntry />
          </Suspense>
        )}
      </main>
      <StatusTicker />
    </div>
  );
}
