# Design Sync Notes — @coord-ui/ui

## Build steps (re-sync)

Two steps required before running the converter — both must be done from the repo root:

1. Build TypeScript dist: `pnpm -F "@coord-ui/ui..." build`
2. Compile Tailwind CSS — run this Node script from repo root:

```js
const {
  compile,
} = require("./node_modules/.pnpm/@tailwindcss+node@4.2.0/node_modules/@tailwindcss/node/dist/index.js");
const {
  Scanner,
} = require("./node_modules/.pnpm/@tailwindcss+oxide@4.2.0/node_modules/@tailwindcss/oxide");
const fs = require("fs");

const scanner = new Scanner({
  sources: [
    {
      base: process.cwd(),
      pattern: "packages/ui/src/**/*.{ts,tsx}",
      negated: false,
    },
    {
      base: process.cwd(),
      pattern: ".design-sync/previews/**/*.{ts,tsx}",
      negated: false,
    },
  ],
});
const candidates = scanner.scan();
const inputCss = fs.readFileSync("apps/web/src/index.css", "utf8");
compile(inputCss, {
  base: process.cwd() + "/apps/web/src",
  onDependency: () => {},
}).then((r) => {
  fs.writeFileSync("packages/ui/ds-compiled.css", r.build(candidates));
});
```

Then run the converter from **repo root** (not packages/ui):

```sh
node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules .ds-sync/node_modules --entry packages/ui/dist/index.js --out ./ds-bundle
```

## node_modules setup

- The package's `node_modules` doesn't have `react`/`react-dom` (pnpm virtual store).
- The converter uses `.ds-sync/node_modules` which has `react` and `react-dom` installed via npm.
- On fresh clone, run: `(cd .ds-sync && npm i esbuild ts-morph @types/react react react-dom)`

## CSS setup

- `packages/ui` ships no CSS — it's Tailwind utility-class-based.
- `ds-compiled.css` in the package root is generated at sync time (Tailwind v4 compile over `apps/web/src/index.css` scanning the component source files).
- If the token palette changes in `apps/web/src/index.css`, regenerate `ds-compiled.css` and re-sync.

## Known render warns

- `[FONT_DANGLING]` for `JetBrainsMono Nerd Font`: the `@font-face` url `/fonts/JetBrainsMono...` is an absolute app-context path. JetBrainsMono is only used for the PTY terminal, not by Button/Tooltip. Non-blocking — safe to ignore.
- Render check was skipped (user declined Playwright install). Previews were visually verified via browser screenshot instead.

## Re-sync risks

- **CSS drift**: `ds-compiled.css` is generated from `apps/web/src/index.css`. New tokens added there won't appear until re-sync regenerates the file.
- **Tailwind version pinned**: The compile step uses `@tailwindcss/node@4.2.0` and `@tailwindcss/oxide@4.2.0` from the pnpm store. If the project upgrades Tailwind, the pnpm paths change — update the script paths accordingly.
- **Previews are interaction-blind**: Tooltip hover state isn't shown in the static preview (it's hover-triggered). The cards show the trigger buttons only.
