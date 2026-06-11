import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useBusStore, type NotificationItem } from "../store/bus.js";
import { PRIORITY_ACCENT, FONT_MONO, FONT_DISPLAY } from "../theme/tokens.js";

type NotificationLocation = "popup" | "dock";
type PopupStyle = CSSProperties & {
  "--origin-x"?: string;
  "--origin-y"?: string;
};

interface NotificationLayerProps {
  renderContent?: (
    item: NotificationItem,
    location: NotificationLocation
  ) => ReactNode;
}

const POPUP_DWELL_MS = 5000;
const POPUP_EXIT_MS = 480;

export function NotificationLayer({ renderContent }: NotificationLayerProps) {
  const popup = useBusStore((s) => s.notificationPopup);
  const dockItems = useBusStore((s) => s.notificationDockItems);
  const moveNotificationToDock = useBusStore((s) => s.moveNotificationToDock);
  const dismissNotification = useBusStore((s) => s.dismissNotification);
  const actNotification = useBusStore((s) => s.actNotification);
  const [exitingPopupId, setExitingPopupId] = useState<string | null>(null);

  useEffect(() => {
    if (!popup) {
      setExitingPopupId(null);
      return;
    }

    setExitingPopupId(null);
    let exitTimer: number | undefined;
    const dwellTimer = window.setTimeout(() => {
      setExitingPopupId(popup.id);
      exitTimer = window.setTimeout(() => {
        moveNotificationToDock(popup.id);
      }, POPUP_EXIT_MS);
    }, POPUP_DWELL_MS);

    return () => {
      window.clearTimeout(dwellTimer);
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    };
  }, [moveNotificationToDock, popup]);

  const render = renderContent ?? defaultRenderContent;
  const visibleDockItems = dockItems.slice(0, 8);
  const actionableCount = dockItems.filter(
    (item) => item.priority !== "subtle"
  ).length;
  const popupStyle: PopupStyle | undefined = popup
    ? {
        ...popupShell,
        ...(popup.origin
          ? {
              "--origin-x": `${popup.origin.x}px`,
              "--origin-y": `${popup.origin.y}px`,
            }
          : {}),
        animation:
          exitingPopupId === popup.id
            ? "nexus-popup-to-dock 480ms ease-in forwards"
            : popup.origin
              ? "nexus-popup-from-origin 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards"
              : "nexus-popup-in 180ms ease-out forwards",
      }
    : undefined;

  return (
    <>
      {popup ? (
        <section aria-live="assertive" style={popupStyle}>
          <div style={popupHeader}>
            <span>{popup.priority === "loud" ? "PRIORITY" : "NOTICE"}</span>
            <span style={popupPrefix}>{popup.prefix ?? "MESSAGE"}</span>
          </div>
          {render(popup, "popup")}
          <NotificationActions
            onAct={() => actNotification(popup.id)}
            onDismiss={() => dismissNotification(popup.id)}
          />
        </section>
      ) : null}

      <aside style={dockShell} aria-label="Action dock">
        <div style={dockHeader}>
          <span>ACTION DOCK</span>
          {actionableCount > 0 ? (
            <span style={dockBadge}>{actionableCount}</span>
          ) : null}
        </div>
        {visibleDockItems.length === 0 ? (
          <div style={emptyDock}>NO PENDING SIGNALS</div>
        ) : (
          <div style={dockList}>
            {visibleDockItems.map((item) => (
              <article key={item.id} style={dockItemStyle(item)}>
                <div style={dockItemMeta}>
                  <span>{item.prefix ?? "MESSAGE"}</span>
                  <span>{formatTime(item.timestamp)}</span>
                </div>
                {render(item, "dock")}
                <NotificationActions
                  compact
                  onAct={() => actNotification(item.id)}
                  onDismiss={() => dismissNotification(item.id)}
                />
              </article>
            ))}
          </div>
        )}
      </aside>

      <style>{`
        @keyframes nexus-popup-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        @keyframes nexus-popup-from-origin {
          0% {
            opacity: 0;
            filter: blur(8px);
            transform: translate(
              calc(var(--origin-x) - 50vw - 50%),
              calc(var(--origin-y) - 50vh - 50%)
            ) scale(0.26);
          }
          55% {
            opacity: 1;
            filter: blur(0);
            transform: translate(-50%, -50%) scale(1.04);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes nexus-popup-to-dock {
          from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          to {
            opacity: 0.15;
            transform: translate(calc(-50vw + 190px), calc(50vh - 145px)) scale(0.42);
          }
        }
      `}</style>
    </>
  );
}

function defaultRenderContent(
  item: NotificationItem,
  location: NotificationLocation
) {
  const maxLength = location === "popup" ? 220 : 96;
  return (
    <div style={location === "popup" ? popupBody : dockBody}>
      <div style={messageFrom}>FROM {item.from}</div>
      <div>{truncate(item.body, maxLength)}</div>
    </div>
  );
}

function NotificationActions({
  compact = false,
  onAct,
  onDismiss,
}: {
  compact?: boolean;
  onAct: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={compact ? compactActionRow : actionRow}>
      <button style={actionButton} onClick={onAct}>
        ACT
      </button>
      <button style={ghostButton} onClick={onDismiss}>
        DISMISS
      </button>
    </div>
  );
}

function dockItemStyle(item: NotificationItem): CSSProperties {
  const accent = PRIORITY_ACCENT[item.priority];

  return {
    border: `1px solid ${accent}`,
    background:
      item.priority === "subtle" ? "rgba(0,20,35,0.55)" : "rgba(0,12,28,0.88)",
    boxShadow: `0 0 18px ${accent.replace("0.8", "0.24").replace("0.75", "0.22").replace("0.35", "0.12")}`,
    padding: item.priority === "subtle" ? "7px 9px" : "10px 11px",
    opacity: item.priority === "subtle" ? 0.72 : 1,
  };
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toISOString().slice(11, 19);
}

const popupShell: CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  width: 460,
  maxWidth: "calc(100vw - 48px)",
  zIndex: 720,
  border: "1px solid rgba(255,64,129,0.72)",
  background: "linear-gradient(135deg, rgba(18,0,24,0.94), rgba(0,20,42,0.96))",
  boxShadow:
    "0 0 70px rgba(255,64,129,0.35), inset 0 0 24px rgba(0,212,255,0.08)",
  color: "#dff9ff",
  padding: 18,
  fontFamily: FONT_MONO,
  pointerEvents: "auto",
};

const popupHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
  color: "#ff4081",
  fontFamily: FONT_DISPLAY,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.22em",
  textShadow: "0 0 14px rgba(255,64,129,0.75)",
};

const popupPrefix: CSSProperties = {
  color: "#00d4ff",
  textShadow: "0 0 12px rgba(0,212,255,0.7)",
};

const popupBody: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.45,
  color: "rgba(223,249,255,0.92)",
  whiteSpace: "pre-wrap",
};

const messageFrom: CSSProperties = {
  marginBottom: 8,
  color: "rgba(0,212,255,0.62)",
  fontSize: 10,
  letterSpacing: "0.14em",
};

const actionRow: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 16,
};

const compactActionRow: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 6,
  marginTop: 8,
};

const actionButton: CSSProperties = {
  border: "1px solid rgba(0,212,255,0.65)",
  background: "rgba(0,212,255,0.14)",
  color: "#8ff3ff",
  cursor: "pointer",
  fontFamily: FONT_MONO,
  fontSize: 10,
  letterSpacing: "0.14em",
  padding: "5px 9px",
};

const ghostButton: CSSProperties = {
  ...actionButton,
  borderColor: "rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(223,249,255,0.62)",
};

const dockShell: CSSProperties = {
  position: "fixed",
  left: 18,
  bottom: 40,
  width: 330,
  maxHeight: "42vh",
  zIndex: 650,
  pointerEvents: "auto",
  fontFamily: FONT_MONO,
};

const dockHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
  padding: "7px 10px",
  color: "#00d4ff",
  border: "1px solid rgba(0,212,255,0.28)",
  background: "rgba(0,10,24,0.82)",
  fontFamily: FONT_DISPLAY,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  boxShadow: "0 0 18px rgba(0,212,255,0.12)",
};

const dockBadge: CSSProperties = {
  minWidth: 22,
  textAlign: "center",
  color: "#00111f",
  background: "#ffb000",
  borderRadius: 999,
  padding: "2px 6px",
  letterSpacing: 0,
};

const emptyDock: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid rgba(0,212,255,0.12)",
  background: "rgba(0,10,24,0.48)",
  color: "rgba(0,212,255,0.28)",
  fontSize: 10,
  letterSpacing: "0.12em",
};

const dockList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  overflowY: "auto",
  maxHeight: "calc(42vh - 38px)",
};

const dockItemMeta: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "rgba(0,212,255,0.55)",
  fontSize: 9,
  letterSpacing: "0.1em",
  marginBottom: 5,
};

const dockBody: CSSProperties = {
  color: "rgba(223,249,255,0.78)",
  fontSize: 11,
  lineHeight: 1.35,
  whiteSpace: "pre-wrap",
};
