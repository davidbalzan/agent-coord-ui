import * as THREE from "three";

interface GraphAnimationRuntime {
  camera(): THREE.PerspectiveCamera;
  controls(): { target: THREE.Vector3 };
  scene(): THREE.Scene;
}

interface RefLike<T> {
  current: T;
}

interface StartGraphAnimationLoopArgs {
  graphRef: RefLike<GraphAnimationRuntime | null>;
  agentLabelSetters: RefLike<Map<string, (visible: boolean) => void>>;
  agentMsgTimestampRef: RefLike<Map<string, number>>;
  roomActivityRef: RefLike<Map<string, number>>;
  paneWaveState: RefLike<
    Map<string, { color: number; period: number; visible: boolean }>
  >;
  recentMsgMs: number;
  activityGlowTau: number;
}

export function startGraphAnimationLoop({
  graphRef,
  agentLabelSetters,
  agentMsgTimestampRef,
  roomActivityRef,
  paneWaveState,
  recentMsgMs,
  activityGlowTau,
}: StartGraphAnimationLoopArgs): () => void {
  const t0 = performance.now();
  let rafId: number;
  const tick = () => {
    if (graphRef.current) {
      const elapsed = (performance.now() - t0) / 1000;

      // Toggle agent labels + pane group labels based on camera proximity
      const camera = graphRef.current.camera();
      const controls = graphRef.current.controls();
      const camDist = camera.position.distanceTo(controls.target);
      const showAgentLabels = camDist < 650;
      for (const setter of agentLabelSetters.current.values()) {
        setter(showAgentLabels);
      }
      // Show session group labels only when fairly close (zoomed in)
      const showGroupLabels = camDist < 400;
      graphRef.current.scene().traverse((obj: THREE.Object3D) => {
        if (obj.userData?.groupLabel) {
          obj.visible = showGroupLabels;
        }
      });

      graphRef.current.scene().traverse((obj: THREE.Object3D) => {
        // Decaying activity glow — brightest right after a message, fading
        // over the recency window so the most-recently-active node stands out.
        if (obj.userData?.setActivityGlow && obj.userData?.agentId) {
          const lastTs = agentMsgTimestampRef.current.get(
            obj.userData.agentId as string
          );
          let level = 0;
          if (lastTs) {
            const secAgo = (performance.now() - lastTs) / 1000;
            if (secAgo < recentMsgMs / 1000) {
              level = Math.exp(-secAgo / activityGlowTau);
            }
          }
          (obj.userData.setActivityGlow as (n: number) => void)(
            level < 0.02 ? 0 : level
          );
        }
        if (obj.userData?.pulseHalo) {
          // Gentle slow fade — stale is idle, not an alarm
          (
            obj as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
          ).material.opacity =
            0.06 + Math.abs(Math.sin(elapsed * Math.PI * 0.2)) * 0.14;
        }
        if (obj.userData?.activityHalo) {
          const lastTs = roomActivityRef.current.get(
            obj.userData.activityHalo as string
          );
          const mesh = obj as THREE.Mesh<
            THREE.BufferGeometry,
            THREE.MeshBasicMaterial
          >;
          if (lastTs) {
            const secAgo = (performance.now() - lastTs) / 1000;
            // decaying ripple: sin wave * exponential envelope, ~4 s duration
            const ripple = Math.max(
              0,
              Math.sin(secAgo * Math.PI * 2.5) * Math.exp(-secAgo * 1.2)
            );
            mesh.material.opacity = 0.12 + ripple * 0.55;
          } else {
            mesh.material.opacity = 0.12;
          }
        }
        if (obj.userData?.selectionRing && obj.userData?.isSelected) {
          obj.rotation.z = elapsed * 1.4; // slow spin
          obj.rotation.x = Math.sin(elapsed * 0.7) * 0.4; // gentle tilt oscillation
        }
        if (obj.userData?.agentRingWave) {
          const wave = obj as THREE.Sprite;
          const lastTs = agentMsgTimestampRef.current.get(
            obj.userData.agentId as string
          );
          const BURST_DURATION = 2.5; // seconds a burst lasts
          const PERIOD = 1.2;
          if (!lastTs || (performance.now() - lastTs) / 1000 > BURST_DURATION) {
            wave.material.opacity = 0;
          } else {
            const secAgo = (performance.now() - lastTs) / 1000;
            const phase =
              ((secAgo + (obj.userData.phaseOffset as number) * PERIOD) %
                PERIOD) /
              PERIOD;
            const s = 10 + phase * 28;
            wave.scale.set(s, s, 1);
            const envelope = Math.max(0, 1 - secAgo / BURST_DURATION);
            wave.material.opacity = Math.max(0, (1 - phase) * 0.6 * envelope);
          }
        }
        if (obj.userData?.radioWave) {
          const wave = obj as THREE.Sprite;
          const state = paneWaveState.current.get(
            obj.userData.paneId as string
          );
          if (!state?.visible) {
            wave.material.opacity = 0;
            return;
          }
          const phase =
            ((elapsed + (obj.userData.phaseOffset as number) * state.period) %
              state.period) /
            state.period; // 0 → 1
          const s = 8 + phase * 18; // expand 8 → 26 world units
          wave.scale.set(s, s, 1);
          wave.material.opacity = Math.max(0, (1 - phase) * 0.55);
          wave.material.color.setHex(state.color);
        }
      });
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
