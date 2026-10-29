# Evanssion website v1.1

Static HTML/CSS/JS, no framework or CMS. 51 pages built from `src/content.json` (the reviewed content draft).

- `dist/`        generated site. Open `dist/index.html`, or run `make dev` and open http://localhost:8080
- `build.js`     generator. `node build.js` (relative links, opens from disk) or `node build.js --prod` (clean URLs for hosting)
- `src/`         `site.css` (design tokens, light and dark), `site.js`, `content.json`, logo files
- `functions/api/lead.js`  Cloudflare Pages Function that receives the forms and emails them (see the header comment for settings)

Deploy: connect the folder to Cloudflare Pages, build command `node build.js --prod`, output directory `dist`.
The theme toggle follows the system setting and remembers the visitor's choice.
