import * as THREE from "three";
import { graphCosmeticTick } from "../components/graph/animationLoop.js";
import { createXrCockpit, type XrCockpit } from "./cockpit/cockpit.js";
import { setupXrControllers, type XrControllerRig } from "./controllers.js";

/**
 * The slice of the 3d-force-graph instance the XR rehost relies on.
 * Validated against 3d-force-graph@1.80.0:
 *  - `pauseAnimation()` cancels the library's internal rAF loop cleanly and
 *    `resumeAnimation()` restarts it (dist/3d-force-graph.mjs `_animationCycle`).
 *  - The internal ThreeForceGraph object (owner of `tickFrame()`, which
 *    advances the d3 force sim + link particles) is added to the scene via
 *    `.objects([forceGraph])`, so it is discoverable as the scene child with a
 *    `tickFrame` method — no fork or private-state access needed.
 *  - The library always renders through an EffectComposer, which bypasses the
 *    XR framebuffer — so while presenting we render directly via
 *    `renderer.render(scene, camera)`; three's WebXRManager substitutes the
 *    stereo XR camera while a session is active.
 */
export interface XrGraphHandle {
  renderer(): THREE.WebGLRenderer;
  scene(): THREE.Scene;
  camera(): THREE.PerspectiveCamera;
  controls(): { target: THREE.Vector3 };
  pauseAnimation(): void;
  resumeAnimation(): void;
  cameraPosition(
    position: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number },
    transitionMs?: number
  ): void;
}

// The graph cluster spans roughly ±400 world units; XR space is metres.
// Scale the cluster down and float its centre at standing eye height, ~2 m
// in front of the operator. Head-look only — no locomotion in the spike.
const XR_WORLD_SCALE = 0.0035;
const XR_WORLD_POSITION = new THREE.Vector3(0, 1.4, -2);

interface ForceGraphObject extends THREE.Object3D {
  tickFrame(): void;
}

function findForceGraphObject(scene: THREE.Scene): ForceGraphObject | null {
  const obj = scene.children.find(
    (child) =>
      typeof (child as Partial<ForceGraphObject>).tickFrame === "function"
  );
  return (obj as ForceGraphObject | undefined) ?? null;
}

interface SavedDesktopState {
  cameraPos: THREE.Vector3;
  controlsTarget: THREE.Vector3;
  graphTransform: { position: THREE.Vector3; scale: THREE.Vector3 } | null;
  grids: { helper: THREE.GridHelper; visible: boolean }[];
}

/**
 * Wire XR session handling onto the live graph's renderer. Idle until a
 * session starts (xr.enabled with no session is a no-op for desktop
 * rendering). Returns an unwire fn for unmount.
 *
 * Loop ownership contract (re: render-loop bug #43): exactly one loop drives
 * the renderer at a time — the library's rAF on desktop XOR
 * `renderer.setAnimationLoop` while presenting. Switch-over happens only on
 * sessionstart/sessionend, and sessionend restores the desktop path exactly:
 * library loop resumed, camera + controls target + world transforms restored.
 */
export function wireXrSession(graph: XrGraphHandle): () => void {
  const renderer = graph.renderer();
  renderer.xr.enabled = true;

  let saved: SavedDesktopState | null = null;
  let cockpit: XrCockpit | null = null;
  let controllers: XrControllerRig | null = null;

  const onSessionStart = () => {
    const scene = graph.scene();
    const camera = graph.camera();
    const forceGraphObj = findForceGraphObject(scene);

    saved = {
      cameraPos: camera.position.clone(),
      controlsTarget: graph.controls().target.clone(),
      graphTransform: forceGraphObj
        ? {
            position: forceGraphObj.position.clone(),
            scale: forceGraphObj.scale.clone(),
          }
        : null,
      grids: [],
    };

    // Hand the renderer to XR: stop the library's rAF loop first.
    graph.pauseAnimation();

    // The holographic grid floors are sized for desktop unit-space (800 units
    // wide, depthTest off) — at metric scale they read as a glitchy skybox.
    for (const child of scene.children) {
      if (child instanceof THREE.GridHelper) {
        saved.grids.push({ helper: child, visible: child.visible });
        child.visible = false;
      }
    }

    // Room-scale the cluster (transform the library's root object only — the
    // library never touches its own root transform, only child positions).
    if (forceGraphObj) {
      forceGraphObj.scale.setScalar(XR_WORLD_SCALE);
      forceGraphObj.position.copy(XR_WORLD_POSITION);
    }

    // Cockpit (world-space HUD / exit / info card) + controller rays —
    // session-scoped, torn down on sessionend.
    cockpit = createXrCockpit(() => void renderer.xr.getSession()?.end());
    scene.add(cockpit.group);
    controllers = setupXrControllers({
      renderer,
      scene,
      getTargets: () => {
        const t: THREE.Object3D[] = [...(cockpit?.uiTargets ?? [])];
        if (forceGraphObj) t.push(forceGraphObj);
        return t;
      },
      onSelect: (hit) => cockpit?.handleSelect(hit),
      onHover: (hit) => cockpit?.handleHover(hit),
    });

    let cockpitDead = false;
    renderer.setAnimationLoop(() => {
      // Advance the force sim + message particles, then the cosmetic
      // material tick (stale pulse / halos / waves) — window rAF can be
      // throttled while a headset session is presenting, so the XR loop
      // pumps it directly. Render bypasses the lib's composer (see above).
      forceGraphObj?.tickFrame();
      graphCosmeticTick.current?.();
      // Cockpit/controller failures must degrade to "no UI", never to
      // "no frames" — an uncaught throw here kills the whole session.
      if (!cockpitDead) {
        try {
          controllers?.update();
          cockpit?.update(renderer.xr.getCamera());
        } catch (err) {
          cockpitDead = true;
          console.error("[xr] cockpit update failed — disabling VR UI", err);
        }
      }
      renderer.render(scene, camera);
    });
  };

  const onSessionEnd = () => {
    renderer.setAnimationLoop(null);

    controllers?.dispose();
    controllers = null;
    cockpit?.dispose();
    cockpit = null;

    if (saved) {
      for (const { helper, visible } of saved.grids) helper.visible = visible;
      const forceGraphObj = findForceGraphObject(graph.scene());
      if (forceGraphObj && saved.graphTransform) {
        forceGraphObj.position.copy(saved.graphTransform.position);
        forceGraphObj.scale.copy(saved.graphTransform.scale);
      }
    }

    // Restore the desktop loop, then the camera — WebXRManager mutates the
    // passed camera's pose while presenting, so put it back explicitly.
    graph.resumeAnimation();
    if (saved) {
      graph.cameraPosition(
        {
          x: saved.cameraPos.x,
          y: saved.cameraPos.y,
          z: saved.cameraPos.z,
        },
        {
          x: saved.controlsTarget.x,
          y: saved.controlsTarget.y,
          z: saved.controlsTarget.z,
        },
        0
      );
    }
    saved = null;
  };

  renderer.xr.addEventListener("sessionstart", onSessionStart);
  renderer.xr.addEventListener("sessionend", onSessionEnd);

  return () => {
    renderer.xr.removeEventListener("sessionstart", onSessionStart);
    renderer.xr.removeEventListener("sessionend", onSessionEnd);
    renderer.xr.enabled = false;
  };
}
