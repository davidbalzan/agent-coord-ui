import { Button } from "@coord-ui/ui";

export const Primary = () => (
  <div
    style={{
      display: "flex",
      gap: 12,
      alignItems: "center",
      padding: 24,
      background: "#000913",
    }}
  >
    <Button variant="primary" size="sm">
      Small
    </Button>
    <Button variant="primary" size="md">
      Medium
    </Button>
    <Button variant="primary" size="lg">
      Large
    </Button>
  </div>
);

export const Variants = () => (
  <div
    style={{
      display: "flex",
      gap: 12,
      alignItems: "center",
      padding: 24,
      background: "#000913",
    }}
  >
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
  </div>
);

export const Disabled = () => (
  <div
    style={{
      display: "flex",
      gap: 12,
      alignItems: "center",
      padding: 24,
      background: "#000913",
    }}
  >
    <Button variant="primary" disabled>
      Disabled Primary
    </Button>
    <Button variant="secondary" disabled>
      Disabled Secondary
    </Button>
  </div>
);

export const IconVariant = () => (
  <div
    style={{
      display: "flex",
      gap: 12,
      alignItems: "center",
      padding: 24,
      background: "#000913",
    }}
  >
    <Button variant="icon" size="md">
      ✕
    </Button>
    <Button variant="icon" size="md">
      ⟳
    </Button>
    <Button variant="icon" size="md">
      ⊕
    </Button>
  </div>
);
