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
