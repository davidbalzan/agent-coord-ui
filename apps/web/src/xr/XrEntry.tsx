import { useEffect, useRef, useState } from "react";
import { wireXrSession } from "./enterXr.js";
import { getXrGraphHandle } from "./graphHandle.js";

/**
 * XR entry point — lazy-loaded only when the app is opened with `?xr`.
 * Renders nothing unless the browser reports immersive-vr support, so a
 * desktop browser with `?xr` is unaffected beyond a console note.
 */
export default function XrEntry() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.xr) {
      console.info(
        "[xr] navigator.xr unavailable — needs a secure context + WebXR browser"
      );
      return;
    }
    navigator.xr
      .isSessionSupported("immersive-vr")
      .then((ok) => {
        if (cancelled) return;
        setSupported(ok);
        if (!ok) console.info("[xr] immersive-vr not supported on this device");
      })
      .catch((err: unknown) => {
        console.info("[xr] isSessionSupported failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supported) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let button: HTMLElement | null = null;
    let unwire: (() => void) | null = null;

    // Graph3D registers its instance on mount; this lazy chunk usually
    // resolves later, but poll briefly in case we win the race.
    const tryWire = async () => {
      const graph = getXrGraphHandle();
      if (!graph) {
        timer = setTimeout(() => void tryWire(), 250);
        return;
      }
      const { VRButton } = await import("three/examples/jsm/webxr/VRButton.js");
      if (disposed) return;
      unwire = wireXrSession(graph);
      button = VRButton.createButton(graph.renderer());
      // VRButton positions itself (fixed, bottom-centre) via inline styles.
      hostRef.current?.appendChild(button);
    };
    void tryWire();

    return () => {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      button?.remove();
      unwire?.();
    };
  }, [supported]);

  return <div ref={hostRef} />;
}
