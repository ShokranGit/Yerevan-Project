# Yerevan Project

An interactive research map of Yerevan, urban space, social movements, and political events.
Built around the Northern Avenue project and extending to the 2018 revolution, the
Nagorno-Karabakh conflict, and the everyday social life of the city's public spaces.

Every point on the map is a research entry fixed in **time** and **place**.
The timeline lets the city's political geography accumulate; the theme filters
isolate one thread of the argument at a time.

---

## Running it

The map loads its data with `fetch()`, so it needs to be served over HTTP; 
opening `index.html` by double-clicking will not work.

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server, etc.).

---

## What's here

```
index.html                 the page structure
assets/css/styles.css      all styling; palette variables at the top
assets/js/app.js           map, timeline, filters, detail panel
data/events.json           ← the research lives here
media/                     images referenced by entries
DATA-GUIDE.md              how to write an entry
```

**You only ever need to edit `data/events.json`.** Adding an entry there
automatically creates its map point, its timeline position, its theme colour,
its entry in the results list, and its detail page. Nothing in the code has to change.

---

## Features

| | |
|---|---|
| **Timeline** | Drag either handle to set a time window. Press ▶ (or the spacebar) to sweep through the whole period and watch events accumulate. The grey histogram behind the track shows where the density of events sits. |
| **Themes** | Nine colour-coded categories. Click to toggle; counts update to the current time window. |
| **Search** | Matches titles, places, summaries, analysis, actors, and keywords. |
| **Detail panel** | Click any point for date, place, description, analysis, actors, keywords, images, and sources. |
| **Permalinks** | Selecting an event puts its id in the URL, so a specific entry can be cited or shared: `…/#example-mashtots-park` |
| **Basemap** | Toggle dark / light. Both are key-free CARTO styles built on OpenStreetMap. |

---

## Technical notes

- **MapLibre GL JS** (v4.7.1, from unpkg); open source, no account, no API key, no billing.
- **Basemaps**; CARTO dark-matter / positron vector styles, free and key-free, © OpenStreetMap contributors.
- **No build step, no framework, no dependencies to install.** Three files and a JSON document.
- Works as a static site, so it can be hosted on GitHub Pages, Netlify, or any university web space whenever you want it public.

---

## Status

Scaffold complete. `data/events.json` currently holds three entries marked
`EXAMPLE` that exist only to demonstrate the format, delete them as real
research goes in.

See **[DATA-GUIDE.md](DATA-GUIDE.md)** for the full field reference.
