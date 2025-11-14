# LaskaWay — Waitlist (TypeScript)

A high‑fidelity waitlist page for an experience‑gifting platform. Built with TypeScript, vanilla DOM, and CSS animations. Features a swipeable card stack, confetti celebration, gift‑box reveal after 5 likes, and a filterable carousel.

## Repository Structure

- `waitlist/` — The waitlist page (HTML/CSS/TS), compiled JS in `waitlist/build/`.
- `tsconfig.json` — TypeScript configuration (emits to `waitlist/build`).
- `package.json` — Build and dev scripts.

## Prerequisites

- Node.js 18+ and npm

## Quick Start

From the repository root:

```bash
npm install
npm run serve
```

Open:

```
http://localhost:5173/
```

This builds TypeScript and serves the `waitlist` folder. The HTML loads the compiled `./build/script.js`.

## Live‑Reload Development

Run a watch build alongside an auto‑reloading static server:

```bash
npm run dev
```

What happens:
- `tsc -w` compiles `waitlist/script.ts` → `waitlist/build/script.js` on save.
- A lightweight server opens the browser and reloads on changes to `waitlist/build`, `waitlist/index.html`, and `waitlist/styles.css`.

## One‑Off Build

```bash
npm run build
```

Output is written to `waitlist/build/`. The HTML already references `./build/script.js`.

## Clean Build Output

```bash
npm run clean
```
