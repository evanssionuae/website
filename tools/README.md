# Gallery manager

Adds, edits and deletes the photos on the website Gallery (www.evanssion.com/gallery/).

1. Open Terminal in the website folder and run: `node tools/gallery-admin.js`
2. Open http://localhost:4747 in your browser. It works on this computer only.
3. Choose a photo, type the text under it, add the date if you want, and click **Add to gallery**. The photo is resized for fast loading (1600 px full size, 800 px thumbnail).
4. To link a person: select their name in the text, click **Link a person to LinkedIn** and paste the profile address.
5. Press Ctrl+C in Terminal to stop. Then commit and push in GitHub Desktop and merge as usual.

Files: photos in `src/img/gallery/`, text and dates in `src/gallery/gallery.json`. The site shows 18 photos a page, newest date first, and adds pages automatically.
