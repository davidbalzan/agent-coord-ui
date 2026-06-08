import { useCallback } from "react";

type Edge = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type SetRect = (fn: (r: Rect) => Rect) => void;

const MIN_W = 280;
const MIN_H = 180;

export function useResizeHandle(setRect: SetRect) {
  return useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;

      let snapshot: Rect;
      setRect((r) => {
        snapshot = r;
        return r;
      });

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        setRect((r) => {
          const base = snapshot ?? r;
          let { x, y, w, h } = base;

          if (edge.includes("e")) w = Math.max(MIN_W, base.w + dx);
          if (edge.includes("s")) h = Math.max(MIN_H, base.h + dy);
          if (edge.includes("w")) {
            const nw = Math.max(MIN_W, base.w - dx);
            x = base.x + (base.w - nw);
            w = nw;
          }
          if (edge.includes("n")) {
            const nh = Math.max(MIN_H, base.h - dy);
            y = base.y + (base.h - nh);
            h = nh;
          }

          return { x, y, w, h };
        });
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [setRect]
  );
}

// Corner handle style
export const cornerHandle = (edge: Edge): React.CSSProperties => {
  const size = 14;
  const pos: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    zIndex: 10,
  };

  if (edge === "se") {
    pos.bottom = 0;
    pos.right = 0;
    pos.cursor = "se-resize";
  }
  if (edge === "sw") {
    pos.bottom = 0;
    pos.left = 0;
    pos.cursor = "sw-resize";
  }
  if (edge === "ne") {
    pos.top = 0;
    pos.right = 0;
    pos.cursor = "ne-resize";
  }
  if (edge === "nw") {
    pos.top = 0;
    pos.left = 0;
    pos.cursor = "nw-resize";
  }

  return pos;
};

// Edge handle style (for side panels — left edge only typically)
export const edgeHandle = (
  edge: "w" | "e" | "n" | "s"
): React.CSSProperties => {
  const pos: React.CSSProperties = { position: "absolute", zIndex: 10 };

  if (edge === "w") {
    pos.left = 0;
    pos.top = 0;
    pos.bottom = 0;
    pos.width = 5;
    pos.cursor = "w-resize";
  }
  if (edge === "e") {
    pos.right = 0;
    pos.top = 0;
    pos.bottom = 0;
    pos.width = 5;
    pos.cursor = "e-resize";
  }
  if (edge === "n") {
    pos.top = 0;
    pos.left = 0;
    pos.right = 0;
    pos.height = 5;
    pos.cursor = "n-resize";
  }
  if (edge === "s") {
    pos.bottom = 0;
    pos.left = 0;
    pos.right = 0;
    pos.height = 5;
    pos.cursor = "s-resize";
  }

  return pos;
};
