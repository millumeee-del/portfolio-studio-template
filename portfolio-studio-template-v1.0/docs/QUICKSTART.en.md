# Quick start

Requires Node.js >=22.18 (Node 24 LTS recommended).

```sh
npm ci
node node_modules/astro/bin/astro.mjs dev --background
npm test
npm run audit:share
npm run build
npm run preview
```

Edit content in the local browser. JSON files in src/data hold projects, layout and manual translations. Uploads go into public/works/uploads. Change the site name in src/data/site.js and links in social-links.js.

Deploy dist at the domain root. Editor routes are development-only. Shared mood stickers require the optional Workers + D1 backend; the static build hides that entry by default. See the Chinese architecture and deployment guides for the full system map.

This starter contains only original generic demo assets. Do not commit private data, credentials, runtime databases, or unlicensed replacement media. The code and original sample media use MIT; dependencies keep their own licenses.
