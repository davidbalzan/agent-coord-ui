import type { ForceGraph3DInstance } from "3d-force-graph";

interface LinkWithKind {
  kind?: string;
}

// Force layout. Two concerns, solved independently:
//   1) SPACING — moderate charge + link distance so connected nodes sit close
//      but the glow halos (~20 units) don't overlap into a blob.
//   2) CONTAINMENT — unlinked nodes (e.g. empty rooms with no members) feel
//      only repulsion and drift to the edge of the world; the default center
//      force only recenters the centroid, never an individual node. A soft
//      spherical boundary fixes this WITHOUT collapsing clusters: it is zero
//      inside BOUND_R and only pulls a node back once it strays past it, so
//      the inner cluster (which lives well inside BOUND_R) is untouched. This
//      is the key difference from a global gravity, which crushed everything.
const BOUND_R = 170;

export function applyForceConfig(graph: ForceGraph3DInstance): void {
  graph.d3Force("charge")?.strength(-150);
  graph.d3Force("link")?.distance((link: object) => {
    const l = link as LinkWithKind;
    return l.kind === "dm" ? 60 : 45;
  });

  const boundary = (alpha: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes: any[] = (graph.graphData() as any).nodes ?? [];
    for (const n of nodes) {
      const x = n.x ?? 0,
        y = n.y ?? 0,
        z = n.z ?? 0;
      const d = Math.hypot(x, y, z);
      if (d > BOUND_R) {
        // Pull back proportionally to how far past the boundary it is.
        const pull = (alpha * 0.25 * (d - BOUND_R)) / d;
        n.vx = (n.vx ?? 0) - x * pull;
        n.vy = (n.vy ?? 0) - y * pull;
        n.vz = (n.vz ?? 0) - z * pull;
      }
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graph.d3Force("boundary", boundary as any);
}
