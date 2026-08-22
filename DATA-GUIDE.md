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
annual rite is not a series of near-identical entries; sixteen of those would
drown the timeline. It is one entry with an internal calendar.

```jsonc
{
  "id": "genocide-ceremony",
  "date": "1999-04-23", "dateEnd": "2026-04-24",
  "datePrecision": "recurring",

  // Two days of every year, marked on the timeline in their own colour.
  // Clicking any year's mark opens this entry and highlights that year below.
  "recurs": { "month": 4, "days": [23, 24], "from": 1999, "color": "#7d5ba6" },

  // More than one route. The FIRST is the primary: it is what the camera
  // frames and what the entry's replay button walks. Every one of them is
  // drawn, each with a note on the map naming the years it was used.
  "pathColor": "#7d5ba6",
  "paths": [
    { "id": "genocide-march-republic",
      "label": "Republic Square → Tsitsernakaberd",
      "years": "2022–2026", "active": true,  "path": [[lng, lat], …] },
    { "id": "genocide-march-freedom",
      "label": "Freedom Square → Tsitsernakaberd",
      "years": "1999–2021", "active": false, "path": [[lng, lat], …] }
  ],

  // The year-by-year chronicle rendered under the analysis.
  // `confidence` is rendered, not footnoted: half the argument rests on
  // which years are actually known, so a reader must see the gaps.
  "years": [
    { "year": 2022, "date": "2022-04-23",
      "start": "republic",            // republic | freedom | unconfirmed | none
      "actor": "ARF Youth Union",
      "flags": true,                  // true | false | null (unrecorded)
      "confidence": "confirmed",      // confirmed | partial | unknown
      "note": "…", "note_hy": "…", "note_fa": "…" }
  ],

  // Chants and formulas, Armenian first, transliterated, then glossed.
  "slogans": [
    { "hy": "Զարթնի՛ր լաօ", "latin": "Zartnir lao",
      "gloss": "…", "gloss_hy": "…", "gloss_fa": "…" }
  ]
}
```

`active: false` draws a route fainter and gives its note a dashed border; the
route is still there, it is just no longer walked. (MapLibre will not accept a
data expression for `line-dasharray`, so that difference is carried by opacity;
do not try to switch the dash pattern per feature.)

A media item may carry `remote` alongside `url`. `url` is the mirrored local copy
and is what should normally be shown; `remote` is a fallback the panel uses only
if the local file is missing, so an image added to the data before it has been
mirrored still appears.
