# Live the Gift — Waitlist Page

A simple, high-fidelity waitlist page for an experience‑gifting platform. Clean layout, warm modern aesthetic, and a friendly email capture with a lightweight success state.

## What’s inside

- `index.html` — Page markup with hero, waitlist form, visual collage, carousel, social proof, and footer.
- `styles.css` — Hi‑fi styling: warm gradient backdrop, bold type, rounded corners, subtle shadows, responsive layout.
- `script.js` — Email validation + local success state, plus an auto‑scrolling experiences carousel.

## Try it locally

Open `index.html` directly in a browser, or serve the folder with a tiny web server for best results.

Optional local server (macOS, Python 3):

```bash
cd "/Users/ivansolomichev/Desktop/test"
python3 -m http.server 5173
```

Then visit:

```
http://localhost:5173
```

## Notes

- Images are from Unsplash using public CDN links for demo purposes.
- The form simulates a submission and stores a "joined" flag in `localStorage`. Replace with your backend or a form service when ready.
- All "Privacy / Terms / Contact" links are placeholders.

## Customize

- Edit copy: open `index.html` and adjust the hero headline/subheadline.
- Swap images: update the `img src` URLs in the visual collage and carousel.
- Colors & feel: tune CSS variables in `styles.css` under `:root`.
