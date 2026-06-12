import * as THREE from "three";

/**
 * Controller ray pointers for the VR cockpit. Deliberately NOT using three's
 * XRControllerModelFactory — it fetches controller meshes from a CDN at
 * runtime; a styled ray + grip dot is offline-safe and matches the NEXUS look.
 *
 * Each controller gets a cyan ray whose length snaps to the current hit;
 * trigger ("select") forwards the hit to the cockpit.
 */
export interface XrControllerRig {
  /** Per-XR-frame: raycast both controllers, update ray visuals + hover. */
  update(): void;
  dispose(): void;
}

interface SetupArgs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** Raycast target roots (graph root + cockpit UI meshes). */
  getTargets: () => THREE.Object3D[];
  onSelect: (hit: THREE.Intersection | null) => void;
  onHover: (hit: THREE.Intersection | null) => void;
}

const RAY_IDLE_LENGTH = 4; // metres when pointing at nothing
const RAY_COLOR = 0x00d4ff;

export function setupXrControllers({
  renderer,
  scene,
  getTargets,
  onSelect,
  onHover,
}: SetupArgs): XrControllerRig {
  const raycaster = new THREE.Raycaster();

  const pick = (controller: THREE.Object3D): THREE.Intersection | null => {
    raycaster.setFromXRController(controller as THREE.XRTargetRaySpace);
    // Sprite.raycast (graph glow nodes) dereferences raycaster.camera to
    // billboard the sprite — without it the first pick crashes the XR loop.
    raycaster.camera = renderer.xr.getCamera();
    const targets = getTargets();
    if (targets.length === 0) return null;
    return raycaster.intersectObjects(targets, true)[0] ?? null;
  };

  const rigs = ([0, 1] as const).map((i) => {
    const controller = renderer.xr.getController(i);

    // Ray: a thin line down -Z, rescaled per frame to the hit distance
    const rayGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const rayMat = new THREE.LineBasicMaterial({
      color: RAY_COLOR,
      transparent: true,
      opacity: 0.55,
    });
    const ray = new THREE.Line(rayGeom, rayMat);
    ray.scale.z = RAY_IDLE_LENGTH;
    controller.add(ray);

    // Hit cursor: small glow dot at the intersection point
    const cursorMat = new THREE.MeshBasicMaterial({ color: RAY_COLOR });
    const cursor = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 12, 8),
      cursorMat
    );
    cursor.visible = false;
    scene.add(cursor);

    const onSelectEvent = () => onSelect(pick(controller));
    controller.addEventListener("select", onSelectEvent);
    scene.add(controller);

    return {
      controller,
      ray,
      rayGeom,
      rayMat,
      cursor,
      cursorMat,
      onSelectEvent,
    };
  });

  return {
    update() {
      let topHit: THREE.Intersection | null = null;
      for (const rig of rigs) {
        const hit = pick(rig.controller);
        if (hit) {
          rig.ray.scale.z = hit.distance;
          rig.cursor.position.copy(hit.point);
          rig.cursor.visible = true;
          if (!topHit || hit.distance < topHit.distance) topHit = hit;
        } else {
          rig.ray.scale.z = RAY_IDLE_LENGTH;
          rig.cursor.visible = false;
        }
      }
      onHover(topHit);
    },
    dispose() {
      for (const rig of rigs) {
        rig.controller.removeEventListener("select", rig.onSelectEvent);
        rig.controller.remove(rig.ray);
        rig.controller.removeFromParent();
        rig.cursor.removeFromParent();
        rig.rayGeom.dispose();
        rig.rayMat.dispose();
        rig.cursor.geometry.dispose();
        rig.cursorMat.dispose();
      }
    },
  };
}
