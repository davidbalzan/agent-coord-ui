import type { XrGraphHandle } from "./enterXr.js";

// Tiny dependency-free registry so the lazy XR entry can reach the live graph
// instance owned by Graph3D without touching its mount path. The type-only
// import above is erased at build time — this module adds nothing to the
// default desktop bundle.
let handle: XrGraphHandle | null = null;

export function setXrGraphHandle(graph: XrGraphHandle | null): void {
  handle = graph;
}

export function getXrGraphHandle(): XrGraphHandle | null {
  return handle;
}
