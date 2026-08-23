# How to add research to the map

Everything lives in **`data/events.json`**. That file has three parts: `meta`,
`categories`, and `events`.

---

## 1. An entry, field by field

```json
{
  "id": "northern-ave-demolitions-2004",
  "title": "Demolitions begin on Buzand Street",
  "date": "2004-06-15",
  "dateEnd": "2005-03-01",
  "datePrecision": "day",
  "coordinates": [44.5136, 40.1817],
  "location": "Buzand Street, Kentron",
  "categories": ["demolition", "development"],
  "summary": "What happened, described.",
  "analysis": "What it means, argued.",
  "actors": ["Yerevan Municipality", "Residents' committee"],
  "tags": ["expropriation", "eminent domain"],
  "sources": [
    { "title": "Hetq, 12 July 2004", "url": "https://…", "note": "press" },
    { "title": "Interview, R.M., Sept 2023", "note": "fieldwork" }
  ],
  "media": [
    { "type": "image", "url": "media/buzand-1.jpg", "caption": "Buzand Street before clearance.", "credit": "Photo: author, 2023" }
  ],
  "fieldnote": "Optional. Your own observational notes."
}
```

### Required

| Field | Notes |
|---|---|
| `id` | Unique, lowercase, hyphenated. Becomes the permalink (`#your-id`). Never reuse or reorder, once cited, it should stay stable. |
| `title` | Short. It appears in the list, the hover label, and the detail heading. |
| `date` | `YYYY-MM-DD`, `YYYY-MM`, or `YYYY`. |
| `coordinates` | **`[longitude, latitude]`; longitude first.** This trips everyone up. For Yerevan longitude is ~44.5, latitude is ~40.1. If a point lands in the ocean off Somalia, they're swapped. |
| `categories` | One or more ids from the `categories` list. The **first one** sets the point's colour on the map. |

### Optional

| Field | Notes |
|---|---|
| `dateEnd` | For anything with a duration, a movement, an occupation, a construction phase. The point stays visible for the whole span as the timeline moves. |
| `datePrecision` | `"day"`, `"month"`, or `"year"`. Controls how the date is *displayed*, so you're not forced to invent a day you don't have. Inferred from `date` if omitted. |
| `location` | Human-readable place name, shown under the title. |
| `summary` | Description. Two consecutive newlines (`\n\n`) start a new paragraph. |
| `analysis` | Your interpretation. Rendered in a serif face on a highlighted block, so description and argument stay visually separate. |
| `actors` | Institutions, groups, named participants. Searchable. |
| `tags` | Free keywords. Searchable. |
| `sources` | Objects with `title`, optional `url`, optional `note`. Plain strings also work. |
| `media` | Images. Put files in `media/` and reference them as `"media/filename.jpg"`. |
| `fieldnote` | Your own observations, kept separate from the analytic voice. |

---

## 2. Getting coordinates

Right-click any spot on [openstreetmap.org](https://www.openstreetmap.org/#map=14/40.1830/44.5136)
→ "Show address", and read the numbers off the URL. OSM shows them as
`latitude/longitude`, **reverse them** for this file.

Rough anchors:

| Place | `[lng, lat]` |
|---|---|
| Republic Square | `[44.5126, 40.1776]` |
| Freedom Square / Opera | `[44.5152, 40.1859]` |
| Northern Avenue (midpoint) | `[44.5136, 40.1817]` |
| Baghramyan Avenue (Nat. Assembly) | `[44.5175, 40.1900]` |
| Mashtots Park | `[44.5063, 40.1793]` |
| Cascade | `[44.5153, 40.1911]` |
| Kond | `[44.5030, 40.1830]` |

---

## 3. Setting the timeline's span

By default the timeline runs from your earliest entry to your latest, and it
re-scales every time you add something. To hold it open across a period you
haven't filled in yet, so the shape of the research is visible before the
research is finished, set either end in `meta`:

```json
"meta": {
  "timelineStart": "1990-01-01",
  "timelineEnd": "2028-12-31"
}
```

Leave a value as `""` to let that end follow the data. The current setting fixes
the end at **December 2028** and lets the start follow your earliest entry.

### Entries outside the range become "context"

An entry dated outside an explicit range isn't hidden, it's treated as
**standing context**: a condition that predates (or outlasts) the mapped period
rather than an event inside it. Context entries stay visible at every timeline
position, are marked `context` in the results list, and don't compress the scale.

That's how the 1924 Tamanyan master plan sits on a timeline that starts in 2000:
the plan is a standing condition of the site, not a moment inside the story, and
including it doesn't squash twenty years of events into the right-hand third of
the track.

---

## 3a. Entries at the same address

Several entries legitimately share one location, five of them sit on Northern
Avenue itself. Drawn at identical coordinates they collapse into a single dot and
all but one become unclickable, so entries sharing a location are **fanned out on
a small circle, roughly 18 metres, for display only**. The coordinates in the file
are never modified, and the fan disappears as soon as the entries have distinct
coordinates. If you'd rather place them precisely along the avenue, just give each
its own coordinates and the fanning stops on its own.

---

## 4. Changing the themes

Edit the `categories` array. Each needs `id`, `label`, and `color`:

```json
{ "id": "diaspora", "label": "Diaspora & return", "color": "#e07fb0" }
```

Then use that `id` in any entry's `categories`. Filters, legend swatches, colours,
and counts all update on their own. Pick colours that stay legible on the dark
basemap, mid-tone and saturated works; very dark or very pale does not.

---

## 5. Before committing

JSON is unforgiving, one trailing comma and the whole map goes blank. Check first:

```bash
python3 -m json.tool data/events.json > /dev/null && echo "valid"
```

If the map shows an error screen instead of loading, that's almost always the cause.

---

## 6. A note on structure

The `analysis` field is what makes this a research instrument rather than a
gazetteer. A point with a date, a place, and no argument is a pin. The map becomes
an argument when the entries start speaking to each other, which is also why
`tags` and `actors` are worth filling in consistently: they're how you'll later
find the threads running across events you catalogued months apart.

---

## 7. Recurring rites: `recurs`, `paths`, `years`, `slogans`

Most entries happened once. A few things in this city happen every year, and an
annual rite is not a series of near-identical entries; sixteen of those would drown
the timeline. It is one entry with an internal calendar.

```jsonc
{
  "id": "genocide-ceremony",
  "date": "2015-04-23", "dateEnd": "2026-04-24",
  "datePrecision": "recurring",
  "episode": "genocide-commemoration",

  // Marks on the main track, in the rite's own colour. `years` lists only the
  // years the entry gives a box to. A mark for every year of the axis is a
  // calendar; a mark for the years that hold an argument is a reading.
  "recurs": { "month": 4, "days": [23, 24], "color": "#7d5ba6",
              "years": [2015, 2018, 2020, 2021, 2022] },

  // More than one route. The FIRST is the primary: it is what the camera
  // frames and what the entry's replay button walks. Every one is drawn, each
  // with a note on the map naming the years it was used. `active: false` draws
  // it fainter and dashes its note.
  "pathColor": "#7d5ba6",
  "paths": [
    { "id": "genocide-march-republic", "label": "Republic Square to Tsitsernakaberd",
      "years": "2022–2026", "active": true,  "path": [[lng, lat]] },
    { "id": "genocide-march-freedom",  "label": "Freedom Square to Tsitsernakaberd",
      "years": "1999–2021", "active": false, "path": [[lng, lat]] }
  ],

  // The boxes under the analysis, and the stops on the period spur.
  // `route` names one of the paths above: clicking that year frames and walks
  // it. `media` is the year's own photographs, rendered inside its box.
  "years": [
    { "year": "2022", "label": "2022–2026", "date": "2022-04-23",
      "start": "republic",          // republic | freedom | unconfirmed | none
      "route": "genocide-march-republic",
      "note": "...", "note_hy": "...", "note_fa": "...",
      "media": [ ] }
  ],

  // Chants and formulas, Armenian first, transliterated, then glossed.
  "slogans": [
    { "hy": "Զարթնի́ր լաօ", "latin": "Zartnir lao",
      "gloss": "...", "gloss_hy": "...", "gloss_fa": "..." }
  ]
}
```

An episode can carry a **spur**, its own temporary timeline, opened by clicking its
chip in the Periods rail:

```jsonc
{ "id": "2018-revolution",         "spur": { "kind": "events" } }
{ "id": "genocide-commemoration",  "spur": { "kind": "years",
                                             "entry": "genocide-ceremony" } }
```

`"events"` lists every entry whose `episode` is this one, in date order.
`"years"` lists the `years` array of the entry named. Either way a stop opens its
entry, moves the camera and, where there is a route, walks it.

A media item may carry `remote` alongside `url`. `url` is the mirrored local copy
and is what should normally be shown; `remote` is a fallback the panel uses only if
the local file is missing, so an image added to the data before it has been mirrored
still appears.

---

## 8. House rule: no em dashes

**Do not use an em dash (the long one) anywhere in this project, in English,
Armenian or Persian, in data, interface strings, code comments or documentation.**
Use a comma, a semicolon, a colon or parentheses instead. En dashes stay where they
belong, in numeric ranges such as `2022–2026`.

To check before committing:

```bash
grep -rn $'\u2014' . --include='*.json' --include='*.js' --include='*.css' \
  --include='*.html' --include='*.md' | grep -v vendor
```

Silence means clean.

---

## 9. Prose marks

`summary`, `analysis` and a year's `note` accept two marks and no more:
`**bold**` for the sentence a section turns on, and `*italic*` for a
transliteration or a foreign word. Everything is HTML-escaped first, so nothing in
the data can inject markup. Blank lines separate paragraphs.

---

## 10. Photographs the researcher took

Alireza's own photographs are dropped into `Downloads/Yerevanphotosfor site` and are handled
differently from anything found on the web.

**Ship them unmodified.** Do not resize, do not re-encode, do not straighten, and above all
do not crop. The frame is a decision he made when he stood there, and a research photograph
that has been recomposed by a tool is no longer evidence of what he saw. The repository copy
should be byte-identical to the file he supplied. Page weight is the lesser problem.

**Credit is the word `Author`, nothing more.** Set `fieldnote: true` on the media item, which
prints a "Fieldwork photograph" badge ahead of everything else, and set `credit` to `Author`.
Not his name, not the project, not a date: the academic convention, and his preference.
`credit` is read through `tr()`, so it takes `_hy` and `_fa` suffixes like any other field.
There is no `license` field on his own photographs.

```jsonc
{
  "type": "image",
  "url": "media/lenin-headless-courtyard-2021.jpg",
  "fieldnote": true,
  "caption": "...", "caption_hy": "...", "caption_fa": "...",
  "credit": "Author", "credit_hy": "Հեղինակ", "credit_fa": "نگارنده"
}
```

No `source` field: there is no external page to link to, because he is the source.

---

## 11. Photographs never leave the page

Clicking any image on this site opens it in the viewer (`#lightbox`): the picture at the
largest size that fits, its caption underneath, a close button, a fullscreen button, and
arrow keys to move through the photographs of the open entry. Escape closes it, `f` toggles
fullscreen, and clicking the backdrop closes it.

**Do not wrap an image in a link.** No `target="_blank"`, no anchor around a `<figure>`, no
"open original" affordance. A reader following an argument must never be thrown into a
browser tab holding a bare JPEG with no way back except the back button. `renderMedia()`
wraps every image in a `button.d-zoom` and one delegated listener on `document` handles the
rest, so media rendered anywhere (entry panel, year box, anything added later) works without
extra wiring.

The only external links in a caption are the licence and source links required by
attribution. Those are text, not the photograph.

## 12. `data/geography.json`, where this is, at four scales

Added 22 August 2026. One file, three parts.

`features` is a FeatureCollection with four kinds:

| `kind` | what | source |
|---|---|---|
| `country` | Armenia, Georgia, Azerbaijan, Türkiye, Iran, Russia | Natural Earth 10m admin 0, clipped to 36–56 E / 33.5–47.5 N, simplified (Armenia 0.0035°, the rest 0.012°) |
| `karabakh` | `nk-1994`, the 11,900 km² held from 1994; `nk-2020`, the 3,140 km² left after the 2020 war | Natural Earth 10m disputed areas, **release v4.1.0** for the 1994 extent and the current release for the remnant |
| `city` | the Yerevan municipal boundary | OpenStreetMap relation 364087, read 2026-08-22 |
| `district` | Kentron | OpenStreetMap relation 13404218, read 2026-08-22 |
| `borough` | Yerevan's twelve administrative districts | OSM relations, admin_level 5, read 2026-08-23 |
| `massif` | Ararat and Lesser Ararat | real OSM summits, schematic bands, marked `synthetic` |
| `ideal-ring` | the circle the core is an approximation of | drawn by hand, see below |

Every feature carries `label`, `label_hy`, `label_fa` and an `at`, which is
where its name is drawn. `at` is a **design decision, not a centroid**: it is
chosen so the names do not collide with each other or with the subject.

`spaces` is the named public space of the centre: eighteen entries, each with
`at`, a `kind` (`square`, `street`, `water`, `park`, `quarter`, `site`) that
decides how it is set, and a `rank` that decides the zoom at which it appears.
Positions are OpenStreetMap, except Republic Square and Tsitsernakaberd, which
keep the values this project had already verified.

**Since September 2023 the whole of Nagorno-Karabakh is under Azerbaijani
control and the Armenian population has left.** The map draws two historical
outlines and says so under the name; it does not draw a current polity.

### The ring boulevard, removed

A route solved with Dijkstra on the OSM street graph used to stand for the
core. It was taken out on 23 August 2026: closed through the streets south
of Republic Square it read as a half circle shut by a straight chord, which
is a fact about the routing and not about the city. The ideal ring stands
in its place. The routing method is written up in `commemoration-and-routing.md`
and is still the way any march path gets drawn.

### Ararat

Two `massif` features. The **summits are real**, OpenStreetMap positions and
elevations: Ararat 44.2984 / 39.7019 at 5,137 m, Lesser Ararat 44.4138 /
39.6482 at 3,887 m. The **bands are not contours**. They are concentric
rings whose radii come from the massif's published base extent, spaced so
the implied slope is even from the plain to the summit, and every feature
carries `synthetic: true` and a note saying so. `massifFC()` builds them
with the same `annulusSector` the ideal ring uses.

### The ideal ring

A second entry of `kind: "ideal-ring"` carries a centre and two radii
rather than geometry:

```json
{"kind":"ideal-ring","centre":[44.51458,40.181065],
 "r_inner":801,"r_outer":920,"dashes":20,"gap_deg":4}
```

The app builds the dashed band from that at runtime, as twenty annulus
sectors, alternating grey and red at 40 per cent, drawn **under** the
routed ring because the figure is the argument and the street is the
evidence. Sectors rather than a thick line: a line width is in pixels
and would stop meaning 801 to 920 m the moment you zoomed, while a
polygon is the same ground at every scale and drapes over the terrain.

The two radii are Alireza's, drawn with the radius tool. Measured
against the routed ring, 399 points sampled every 15 m: the mean radius
from that centre is **859 m**, almost exactly the middle of his band;
**32 per cent** of the real ring falls inside it and 65 per cent within
700 to 1050 m. It fits east, south-east and south (means 785 to 876 m).
It fails north-west, where the ring cuts in to 428 m at the Matenadaran,
and south-west, where it bulges to 1090 m around the government quarter
and the gorge.

### Zoom bands

Each layer and each name owns a band, `[fade in, full, full until, fade out]`,
in `GEO_BAND` in `app.js`. **Every band must be strictly ascending.** A repeated
stop makes MapLibre reject the interpolate, and it reports that on the error
event rather than throwing, so the layer is simply absent with nothing in the
console to say why.

### Two MapLibre traps recorded here

- A **zoom expression may only be the input of a top-level interpolate or
  step**. `["*", 0.6, ["interpolate", ["linear"], ["zoom"], ...]]` is rejected.
  Bake the constant into the stops, and split the layer when two features want
  different constants.
- **MapLibre owns the inline `opacity` of a marker element.** With terrain on it
  writes `0.2` there every frame to fade markers standing behind a hillside.
  Anything else written to the same property is gone within a frame, silently.
  The names therefore carry their fade on an inner element, and pass
  `opacityWhenCovered: "0.55"` so the occlusion fade is gentler than the default.

## 13. The drawing toolbar, and `data/drawings.json`

Added 23 August 2026. `assets/js/draw.js`.

Five tools: point, line, area, rectangle, radius. Every shape has a
**name**, and that is the point of the tool. A shape with no name is
something to look at; a shape with a name is something you can write a
sentence about. "Copy for Claude" writes the whole set out as text,
names and measurements and coordinates, ready to paste into a message.

Shapes live in `localStorage["yerevan.drawings"]` in the reader's own
browser. Nothing is sent anywhere and nothing is shared. To make a
shape part of the map for every reader, save the GeoJSON as
**`data/drawings.json`** and commit it: `draw.js` loads that file once
at startup and adds anything whose `name` is not already present.

`data/drawings.json` is an ordinary FeatureCollection. Per feature:

| property | meaning |
|---|---|
| `name` | what the shape is called, and how it is referred to |
| `kind` | `point`, `line`, `area`, `rect`, `circle` |
| `colour` | any CSS colour |
| `note` | a sentence about it |
| `radius_m` | present on a circle; a circle is stored as a Polygon plus this |
| `length_m`, `area_m2` | written on export, recomputed on load |

Measurements are geodesic: haversine for length, spherical excess for
area. A length in degrees is not a length, and one degree of longitude
at this latitude is 850 m shorter than one of latitude.

### Two things the toolbar had to be taught

**A list that rebuilds itself destroys what is being typed in it.**
Rendering the shape list on every frame of a vertex drag both wasted
work and, worse, replaced the input the reader had focus in. There are
now two levels: `paintGeom` for the geometry, `paint` for geometry plus
labels plus list, and `renderList` refuses to rebuild while an input
inside it holds focus.

**`isStyleLoaded()` is not a gate you can poll.** It goes false and
true several times while a style settles, and a poll that only acts on
a true sample can miss every one; measured, it missed on two runs in
three, leaving the drawing and the geography absent after a basemap
change. Adding a source either works or throws, so the retry now just
tries. The same fix was applied to the figure-ground and route restore
in `app.js`, which had the same flaw and had had it for longer.

Layer order matters too: whoever rebuilds first after a style change
ends up at the bottom, and `draw.js` has the fastest retry, so it moves
its own layers back to the top afterwards. Nothing the reader draws
should be hidden by the map.

### `bm-light`

`on-light` has meant "not the dark basemap" since the beginning, which
counts the dark figure-ground drawing as light, and several rules keyed
to it were written without the descendant space (`#map-wrap.on-light
.map-btn` as `#map-wrap.on-light.map-btn`) and so never matched
anything. Rather than rewrite that, anything new asks the narrower
question through **`bm-light`**, set only for the `light` and `streets`
basemaps.
