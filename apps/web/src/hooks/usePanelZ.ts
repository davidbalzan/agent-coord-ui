import { useBusStore } from "../store/bus.js";

// Floating panels share a stacking band that sits ABOVE the status ticker (200)
// and BELOW the radial menu (500), notifications (650+) and HUD (9999) — so
// alerts and the context menu always win. Each panel gets a 20-wide slot so the
// FloatingTerminal can place its internal card stack within its own slot.
const Z_BASE = 300;
const Z_SLOT = 20;

export interface PanelZ {
  zIndex: number;
  /** Spread onto the panel's root to raise it on click (capture phase, so it
   *  fires before inner handlers). */
  onMouseDownCapture: () => void;
}

/**
 * Bring-to-front-on-click stacking for a floating panel. Returns a dynamic
 * `zIndex` from the shared panel stack plus a mousedown handler that moves this
 * panel to the top. `offset` places internal layers within the panel's slot.
 */
export function usePanelZ(id: string, offset = 0): PanelZ {
  const order = useBusStore((s) => s.panelOrder);
  const focusPanel = useBusStore((s) => s.focusPanel);
  const idx = order.indexOf(id);
  const zIndex = Z_BASE + (idx < 0 ? 0 : idx) * Z_SLOT + offset;
  return { zIndex, onMouseDownCapture: () => focusPanel(id) };
}
