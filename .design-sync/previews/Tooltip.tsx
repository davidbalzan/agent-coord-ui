import { Tooltip, Button } from "@coord-ui/ui";

export const Default = () => (
  <div
    style={{
      display: "flex",
      gap: 24,
      alignItems: "center",
      justifyContent: "center",
      padding: 48,
      background: "#000913",
    }}
  >
    <Tooltip content="This is a tooltip">
      <Button variant="secondary">Hover me</Button>
    </Tooltip>
    <Tooltip content="Copy to clipboard" shortcut="⌘C">
      <Button variant="ghost">With shortcut</Button>
    </Tooltip>
  </div>
);

export const OnIcon = () => (
  <div
    style={{
      display: "flex",
      gap: 16,
      alignItems: "center",
      justifyContent: "center",
      padding: 48,
      background: "#000913",
    }}
  >
    <Tooltip content="Close panel" shortcut="Esc">
      <Button variant="icon">✕</Button>
    </Tooltip>
    <Tooltip content="Refresh data" shortcut="⌘R">
      <Button variant="icon">⟳</Button>
    </Tooltip>
    <Tooltip content="Add agent" shortcut="⌘N">
      <Button variant="icon">⊕</Button>
    </Tooltip>
  </div>
);
