/* ===================================================================
   Yerevan Project; THREE LANGUAGES
   -------------------------------------------------------------------
   English, Armenian, Persian. One dictionary, one switch, one rule:

     UI text   lives here, keyed.            I18N.t("detail.analysis")
     Research  lives in the data files,      I18N.tr(event, "analysis")
               beside the English, as
               "<field>_hy" / "<field>_fa".

   The suffix convention is deliberate. Nothing already written had to
   move, English is always the fallback, and adding a language later
   means adding a suffix; not restructuring 200 features. To translate
   a new entry, add "title_hy" next to its "title". Nothing else.

   Persian is right-to-left, so the switch also flips <html dir>, and
   styles.css mirrors the whole interface off that one attribute.

   This file is loaded BEFORE app.js and holds no state that needs the
   map. Everything that must repaint on a language change registers
   with I18N.onChange().
   =================================================================== */

(function () {
  "use strict";

  var LANGS = [
    { code: "en", label: "EN",   name: "English",  dir: "ltr" },
    { code: "hy", label: "ՀԱՅ",  name: "Հայերեն",  dir: "ltr" },
    { code: "fa", label: "فا",   name: "فارسی",    dir: "rtl" }
  ];

  /* ---------------- the dictionary ----------------
     Keep the three blocks in the same order so a missing string is
     visible by eye. A key with no translation falls back to English
     rather than showing the key, a reader should never see plumbing. */

  var STR = {

  en: {
    "doc.title": "Yerevan Project · An Interactive Research Map",
    "doc.desc": "Mapping urban space, social movements, and political events in Yerevan, Armenia.",
    "brand.title": "Yerevan Project",
    "brand.sub": "Urban space · social movements · political events",
    "panel.collapse": "Collapse panel",
    "lang.title": "Language",

    "search.ph": "Search events, places, actors…",
    "themes": "Themes",
    "cat.all": "all themes",
    "cat.none": "no themes",
    "cat.some": "{n} of {total}",
    "all": "all",
    "none": "none",
    "results": "Results",
    "sort.title": "Sort results",
    "sort.dateAsc": "Oldest first",
    "sort.dateDesc": "Newest first",
    "sort.az": "A–Z",

    "res.empty": "No events match the current filters.",
    "res.emptyHint": "Widen the time window or re-enable a theme.",
    "res.untitled": "(untitled)",
    "res.context": "context",

    "detail.back": "Back to all events",
    "detail.happened": "What happened",
    "detail.analysis": "Analysis",
    "detail.actors": "Actors",
    "detail.keywords": "Keywords",
    "detail.sources": "Sources",
    "detail.fieldnote": "Field note",
    "detail.zoom": "Zoom here",
    "detail.copy": "Copy link",
    "detail.copied": "Copied",

    "axis.built": "Avenue as built",
    "axis.apart": "{d}° apart",
    "scale.apart": "{d} km",
    "scale.fromCity": "{d} km from {city}",
    "route.onfoot": "{d} on foot",
    "route.from": "Where it started",
    "route.to": "Where it ended",
    "route.replay": "Walk it again",
    "episode.isolate": "Show this period",
    /* the phone */
    /* the drawing toolbar */
    "draw.title": "Draw",
    "draw.titleLong": "Draw shapes on the map, name them, and copy them out",
    "draw.shapes": "Shapes",
    "draw.tool.point": "Point",
    "draw.tool.line": "Line",
    "draw.tool.area": "Area",
    "draw.tool.rect": "Rectangle",
    "draw.tool.circle": "Radius",
    "draw.tool.select": "Select and edit",
    "draw.clear": "Delete every shape",
    "draw.clearAsk": "Delete every shape you have drawn? This cannot be undone.",
    "draw.kind.point": "Point",
    "draw.kind.line": "Line",
    "draw.kind.area": "Area",
    "draw.kind.rect": "Rectangle",
    "draw.kind.circle": "Radius",
    "draw.hint.point": "click to place",
    "draw.hint.line": "click to add points, double click or Enter to finish, Esc to cancel",
    "draw.hint.area": "click to add points, click the first one or press Enter to close, Esc to cancel",
    "draw.hint.rect": "click the opposite corner",
    "draw.hint.circle": "click to set the radius",
    "draw.name": "Name of this shape",
    "draw.notePh": "a note about this shape",
    "draw.zoom": "Zoom to it",
    "draw.hide": "Show or hide",
    "draw.colour": "Next colour",
    "draw.del": "Delete",
    "draw.copy": "Copy for Claude",
    "draw.copied": "Copied",
    "draw.download": "GeoJSON",
    "draw.import": "Open",
    "draw.empty": "Nothing drawn yet. Pick a tool on the left, draw on the map, then give the shape a name so you can talk about it.",
    "draw.exportHead": "SHAPES DRAWN ON THE YEREVAN MAP",
    "draw.exportFoot": "Coordinates are longitude, latitude, WGS84.",
    "draw.exportAsk": "Drawn on shokrangit.github.io/Yerevan-Project. Refer to a shape by its name.",
    "tl.vertical": "Stand the timeline up the right edge",
    "tl.horizontal": "Lay the timeline back along the bottom",
    "tl.centuryOpen": "The century, 1900 to 2000",
    "geo.nkNote": "under Azerbaijani control since September 2023",
    "geo.nk1994": "held until the 2020 war",
    "m.sheet": "Panel height",
    "m.controls": "Map settings",
    "m.timeline": "Show the timeline",
    "m.map": "Map",
    "m.read": "Read",
    "media.enlarge": "Enlarge",
    "media.close": "Close",
    "media.fullscreen": "Full screen",
    "media.prev": "Previous photograph",
    "media.next": "Next photograph",
    "media.fieldwork": "Fieldwork photograph",
    "media.source": "source",
    "media.play": "Play video",
    "media.embed": "Embedded video",

    "north.title": "Reset bearing to north",
    "pick.title": "Pick a coordinate from the map",
    "pick.copy": "Copy",
    "pick.clear": "Clear",
    "map.basemap": "Basemap",
    "map.terrain": "3D terrain on or off",
    "perf.dropped": "3D terrain was turned off so the map stays usable on this machine. The landform is still drawn as light and shadow.",
    "perf.undo": "Turn it back on",
    "map.reset": "Reset view",
    "map.cube": "Cube",
    "map.cubeTitle": "A period as a space-time cube: geography on the floor, time up the side",
    "cube.open": "Stand this period up: geography on the floor, time up the side",
    "cube.title": "The thirty-nine days",
    "cube.body": "Time stands up off the map, 31 March to 8 May 2018. A disc is an entry on its day, a column is a place holding still, a slope is movement across days. Drag the timeline to slice the cube; press play and the revolution rises.",
    "cube.method": "Dated to the day, so the two-hour march of 22 April is drawn flat. The walk from Gyumri passes Vanadzor, Dilijan, Hrazdan and Abovyan; only its two ends are documented, the middle dates are spaced along the route.",
    "map.pins": "Pins",
    "map.districts": "Districts",
    "map.districtsTitle": "Show or hide the twelve municipal districts",
    "map.region": "Armenia",
    "map.regionTitle": "Armenia, its neighbours and Karabakh in both outlines, 1994 and 2020",
    "place.about": "About this place",
    "place.here": "On the map here",
    "place.open": "This dossier is open: material about the place goes here as it is written.",
    "place.mentions": "Named {n} times in the Northern Avenue article",
    "place.mention1": "Named once in the Northern Avenue article",
    "place.kind.square": "Square",
    "place.kind.street": "Street",
    "place.kind.water": "Water",
    "place.kind.park": "Park",
    "place.kind.site": "Site",
    "place.kind.quarter": "Quarter",
    "map.pinsTitle": "Show or hide the event pins",
    "map.about": "About",

    "basemap.kentron": "Figure-ground",
    "basemap.drawn": "The city we drew",
    "basemap.void": "The city, no earth",
    "basemap.light": "Light",
    "basemap.streets": "Streets",
    "basemap.dark": "Dark",
    "basemap.satellite": "Satellite",

    "about.title": "About this map",
    "about.close": "Close",
    "about.mapped": "{n} events mapped",
    "about.credit": "basemap © CARTO, © OpenStreetMap contributors",
    "about.updated": "data updated {d}",
    "about.draft": "Armenian and Persian are a first translation and still being revised.",

    "loading": "Loading map…",
    "err.load": "Could not load data/events.json",
    "err.localhint": "If you opened index.html directly from disk, run a local server instead:",
    "notice.basemap": "Basemap did not load.",
    "notice.basemapBody": "The timeline, themes and event list still work. This is usually a network or firewall problem reaching the map tile server.",

    "tl.play": "Play through time",
    "tl.full": "full range",
    "tl.here": "entries here",
    "tl.close": "Close",
    "spur.close": "close",
    "spur.open": "open this period",
    "detail.chronology": "Chronology",
    "detail.chronicle": "Year by year",
    "detail.slogans": "What is chanted",
    "march.years": "active {y}",
    "march.replay": "Walk this route",
    "start.freedom": "Freedom Square",
    "start.republic": "Republic Square",
    "start.unconfirmed": "starting square unconfirmed",
    "start.none": "no march",
    "tl.periods": "Periods",
    "tl.century": "The century",
    "tl.fullCentury": "full century",
    "tl.startAria": "Start of time window",
    "tl.endAria": "End of time window",
    "tl.cStartAria": "Start of century window",
    "tl.cEndAria": "End of century window",
    "date.undated": "undated",

    "g3.thumb": "The model",
    "g3.thumbTitle": "The relational model in 3D",
    "g3.title": "The relational model",
    "g3.sub": "Drag to turn it, scroll to zoom, click a node to see what the map holds.",
    "g3.reset": "Reset",
    "g3.close": "Close",
    "g3.empty": "Drag to turn the model. Click any node to see what the map holds about it.",
    "g3.entries": "{n} entries on the map",
    "g3.entry": "1 entry on the map",
    "g3.nothing": "Nothing linked here yet. The node is in the model so the material has somewhere to go, send me entries for it and they will appear here.",
    "g3.connected": "Connected to",

    "p3.thumb": "Parties",
    "p3.thumbTitle": "Armenian political landscape in 3D",
    "p3.title": "The political landscape",
    "p3.sub": "Left to right across, Moscow to Brussels in depth, time rising. Drag the year.",
    "p3.play": "Play",
    "p3.pause": "Pause",
    "p3.reset": "Reset",
    "p3.close": "Close",
    "p3.year": "Year",
    "p3.empty": "Drag the year slider and the landscape fills in. Click a party for its dossier.",
    "p3.caveat": "Spectrum and stance placements are editorial, not measured. Election figures without a check mark still need verifying against a source.",
    "p3.founded": "founded",
    "p3.dissolved": "dissolved",
    "p3.figures": "Figures",
    "p3.elections": "Elections",
    "p3.seats": "{n} seats",
    "p3.checked": "checked against a source",
    "p3.stands": "Where it stands",
    "p3.onmap": "On this map",
    "p3.nothing": "Nothing linked yet.",
    "p3.left": "Left",
    "p3.centre": "Centre",
    "p3.right": "Right",
    "p3.hint": "Solid = holding seats · dashed line = rivalry",
    "p3.electionOf": "{kind} election",
    "kind.parliamentary": "parliamentary",
    "kind.presidential": "presidential",
    "kind.constitutional": "constitutional",
    "kind.local": "local",
    "kind.snap": "snap parliamentary",

    "dir.N": "N", "dir.S": "S", "dir.E": "E", "dir.W": "W",
    "unit.km": "km", "unit.m": "m",
    "months": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    "monthsLong": ["January","February","March","April","May","June","July","August","September","October","November","December"]
  },

  hy: {
    "doc.title": "Երևանի նախագիծ · ինտերակտիվ հետազոտական քարտեզ",
    "doc.desc": "Քաղաքային տարածքի, հասարակական շարժումների և քաղաքական իրադարձությունների քարտեզագրում Երևանում։",
    "brand.title": "Երևանի նախագիծ",
    "brand.sub": "Քաղաքային տարածք · հասարակական շարժումներ · քաղաքական իրադարձություններ",
    "panel.collapse": "Ծալել վահանակը",
    "lang.title": "Լեզու",

    "search.ph": "Որոնել իրադարձություններ, վայրեր, դերակատարներ…",
    "themes": "Թեմաներ",
    "cat.all": "բոլոր թեմաները",
    "cat.none": "ոչ մի թեմա",
    "cat.some": "{n} / {total}",
    "all": "բոլորը",
    "none": "ոչ մեկը",
    "results": "Արդյունքներ",
    "sort.title": "Դասավորել արդյունքները",
    "sort.dateAsc": "Սկզբում՝ հինը",
    "sort.dateDesc": "Սկզբում՝ նորը",
    "sort.az": "Ա–Ֆ",

    "res.empty": "Ընթացիկ զտիչներին համապատասխանող իրադարձություն չկա։",
    "res.emptyHint": "Ընդլայնեք ժամանակային պատուհանը կամ վերականգնեք որևէ թեմա։",
    "res.untitled": "(անվերնագիր)",
    "res.context": "համատեքստ",

    "detail.back": "Վերադառնալ բոլոր իրադարձություններին",
    "detail.happened": "Ինչ է տեղի ունեցել",
    "detail.analysis": "Վերլուծություն",
    "detail.actors": "Դերակատարներ",
    "detail.keywords": "Հիմնաբառեր",
    "detail.sources": "Աղբյուրներ",
    "detail.fieldnote": "Դաշտային նշում",
    "detail.zoom": "Մոտեցնել այստեղ",
    "detail.copy": "Պատճենել հղումը",
    "detail.copied": "Պատճենվեց",

    "axis.built": "Պողոտան՝ ինչպես կառուցվել է",
    "axis.apart": "{d}° տարբերություն",
    "scale.apart": "{d} կմ",
    "scale.fromCity": "{d} կմ {city}ից",
    "route.onfoot": "{d} ոտքով",
    "route.from": "Որտեղ սկսվեց",
    "route.to": "Որտեղ ավարտվեց",
    "route.replay": "Կրկին անցնել ճանապարհը",
    "episode.isolate": "Ցույց տալ այս ժամանակահատվածը",
    "draw.title": "Գծել",
    "draw.titleLong": "Գծել պատկերներ քարտեզի վրա, անվանել դրանք և պատճենել",
    "draw.shapes": "Պատկերներ",
    "draw.tool.point": "Կետ",
    "draw.tool.line": "Գիծ",
    "draw.tool.area": "Տարածք",
    "draw.tool.rect": "Ուղղանկյուն",
    "draw.tool.circle": "Շառավիղ",
    "draw.tool.select": "Ընտրել և խմբագրել",
    "draw.clear": "Ջնջել բոլոր պատկերները",
    "draw.clearAsk": "Ջնջե՞լ ձեր գծած բոլոր պատկերները։ Սա հնարավոր չէ վերականգնել։",
    "draw.kind.point": "Կետ",
    "draw.kind.line": "Գիծ",
    "draw.kind.area": "Տարածք",
    "draw.kind.rect": "Ուղղանկյուն",
    "draw.kind.circle": "Շառավիղ",
    "draw.hint.point": "սեղմեք տեղադրելու համար",
    "draw.hint.line": "սեղմեք կետեր ավելացնելու համար, կրկնակի սեղմում կամ Enter՝ ավարտելու, Esc՝ չեղարկելու",
    "draw.hint.area": "սեղմեք կետեր ավելացնելու համար, սեղմեք առաջինի վրա կամ Enter՝ փակելու, Esc՝ չեղարկելու",
    "draw.hint.rect": "սեղմեք հակառակ անկյունը",
    "draw.hint.circle": "սեղմեք շառավիղը սահմանելու համար",
    "draw.name": "Այս պատկերի անունը",
    "draw.notePh": "նշում այս պատկերի մասին",
    "draw.zoom": "Մոտեցնել",
    "draw.hide": "Ցույց տալ կամ թաքցնել",
    "draw.colour": "Հաջորդ գույնը",
    "draw.del": "Ջնջել",
    "draw.copy": "Պատճենել Claude-ի համար",
    "draw.copied": "Պատճենվեց",
    "draw.download": "GeoJSON",
    "draw.import": "Բացել",
    "draw.empty": "Դեռ ոչինչ գծված չէ։ Ընտրեք գործիք ձախից, գծեք քարտեզի վրա, ապա անուն տվեք պատկերին, որպեսզի կարողանաք խոսել դրա մասին։",
    "draw.exportHead": "ԵՐԵՎԱՆԻ ՔԱՐՏԵԶԻ ՎՐԱ ԳԾՎԱԾ ՊԱՏԿԵՐՆԵՐ",
    "draw.exportFoot": "Կոորդինատները երկայնություն, լայնություն են, WGS84։",
    "draw.exportAsk": "Գծված է shokrangit.github.io/Yerevan-Project կայքում։ Պատկերին հղվեք ըստ անվան։",
    "tl.vertical": "Ուղղահայաց ժամանակագրություն աջ եզրին",
    "tl.horizontal": "Հորիզոնական ժամանակագրություն ներքևում",
    "tl.centuryOpen": "Դարը, 1900-2000",
    "geo.nkNote": "2023 թ. սեպտեմբերից ադրբեջանական վերահսկողության տակ",
    "geo.nk1994": "պահվել է մինչև 2020 թ. պատերազմը",
    "m.sheet": "Վահանակի բարձրությունը",
    "m.controls": "Քարտեզի կարգավորումներ",
    "m.timeline": "Ցույց տալ ժամանակագրությունը",
    "m.map": "Քարտեզ",
    "m.read": "Կարդալ",
    "media.enlarge": "Խոշորացնել",
    "media.close": "Փակել",
    "media.fullscreen": "Լիաէկրան",
    "media.prev": "Նախորդ լուսանկարը",
    "media.next": "Հաջորդ լուսանկարը",
    "media.fieldwork": "Դաշտային լուսանկար",
    "media.source": "աղբյուր",
    "media.play": "Նվագարկել տեսանյութը",
    "media.embed": "Ներդրված տեսանյութ",

    "north.title": "Ուղղել դեպի հյուսիս",
    "pick.title": "Ընտրել կոորդինատ քարտեզից",
    "pick.copy": "Պատճենել",
    "pick.clear": "Մաքրել",
    "map.basemap": "Հիմնաքարտեզ",
    "map.terrain": "3D ռելիեֆը միացնել կամ անջատել",
    "perf.dropped": "3D ռելիեֆն անջատվեց, որպեսզի քարտեզը այս մեքենայի վրա մնա օգտագործելի։ Լանդշաֆտը դեռ գծվում է լույսով և ստվերով։",
    "perf.undo": "Նորից միացնել",
    "map.reset": "Վերականգնել տեսքը",
    "map.cube": "Խորանարդ",
    "map.cubeTitle": "Ժամանակահատվածը որպես տարածաժամանակային խորանարդ՝ աշխարհագրությունը հատակին, ժամանակը՝ վերև",
    "cube.open": "Կանգնեցնել այս ժամանակահատվածը՝ աշխարհագրությունը հատակին, ժամանակը՝ վերև",
    "cube.title": "Երեսունինը օրը",
    "cube.body": "Ժամանակը կանգնում է քարտեզից վեր՝ 2018-ի մարտի 31-ից մայիսի 8-ը։ Կետը գրառում է իր օրվա վրա, սյունը՝ տեղ, որը մնում է անշարժ, թեքությունը՝ շարժում օրերի միջով։ Քաշեք ժամանակագիծը՝ խորանարդը կտրելու համար։",
    "cube.method": "Ամսաթվերը օրվա ճշտությամբ են, ուստի ապրիլի 22-ի երկժամյա երթը գծված է հորիզոնական։ Գյումրիից քայլերթն անցնում է Վանաձոր, Դիլիջան, Հրազդան և Աբովյան. փաստագրված են միայն երկու ծայրերը, միջանկյալ ամսաթվերը բաշխված են ճանապարհի երկայնքով։",
    "map.pins": "Կետեր",
    "map.districts": "Վարչական շրջաններ",
    "map.districtsTitle": "Ցույց տալ կամ թաքցնել տասներկու վարչական շրջանները",
    "map.region": "Հայաստան",
    "map.regionTitle": "Հայաստանը, հարևանները և Ղարաբաղը երկու ուրվագծով՝ 1994 և 2020",
    "place.about": "Այս վայրի մասին",
    "place.here": "Քարտեզի վրա այստեղ",
    "place.open": "Այս թղթապանակը բաց է․ վայրի մասին նյութը կավելացվի այստեղ, երբ գրվի։",
    "place.mentions": "Հյուսիսային պողոտայի հոդվածում հիշատակված է {n} անգամ",
    "place.mention1": "Հյուսիսային պողոտայի հոդվածում հիշատակված է մեկ անգամ",
    "place.kind.square": "Հրապարակ",
    "place.kind.street": "Փողոց",
    "place.kind.water": "Ջուր",
    "place.kind.park": "Այգի",
    "place.kind.site": "Վայր",
    "place.kind.quarter": "Թաղամաս",
    "map.pinsTitle": "Ցույց տալ կամ թաքցնել իրադարձությունների կետերը",
    "map.about": "Մասին",

    "basemap.kentron": "Պատկեր-ֆոն",
    "basemap.drawn": "Մեր գծած քաղաքը",
    "basemap.void": "Քաղաքը, առանց հողի",
    "basemap.light": "Լուսավոր",
    "basemap.streets": "Փողոցներ",
    "basemap.dark": "Մուգ",
    "basemap.satellite": "Արբանյակային",

    "about.title": "Այս քարտեզի մասին",
    "about.close": "Փակել",
    "about.mapped": "{n} իրադարձություն քարտեզագրված",
    "about.credit": "հիմնաքարտեզը՝ © CARTO, © OpenStreetMap-ի մասնակիցներ",
    "about.updated": "տվյալները թարմացվել են՝ {d}",
    "about.draft": "Հայերեն և պարսկերեն տարբերակները առաջին թարգմանությունն են և դեռ խմբագրվում են։",

    "loading": "Քարտեզը բեռնվում է…",
    "err.load": "Հնարավոր չեղավ բեռնել data/events.json ֆայլը",
    "err.localhint": "Եթե index.html-ը բացել եք ուղղակիորեն սկավառակից, փոխարենը գործարկեք տեղային սերվեր՝",
    "notice.basemap": "Հիմնաքարտեզը չբեռնվեց։",
    "notice.basemapBody": "Ժամանակագրությունը, թեմաները և իրադարձությունների ցանկը շարունակում են աշխատել։ Սովորաբար դա ցանցի կամ պատնեշի խնդիր է քարտեզի սերվերին հասնելու հարցում։",

    "tl.play": "Նվագարկել ժամանակի ընթացքում",
    "tl.full": "ամբողջ միջակայքը",
    "tl.here": "գրառում այստեղ",
    "tl.close": "Փակել",
    "spur.close": "փակել",
    "spur.open": "բացել այս ժամանակաշրջանը",
    "detail.chronology": "Ժամանակագրություն",
    "detail.chronicle": "Տարի առ տարի",
    "detail.slogans": "Ինչ է վանկարկվում",
    "march.years": "գործում է {y}",
    "march.replay": "Անցնել այս ճանապարհը",
    "start.freedom": "Ազատության հրապարակ",
    "start.republic": "Հանրապետության հրապարակ",
    "start.unconfirmed": "մեկնարկի հրապարակը հաստատված չէ",
    "start.none": "երթ չի եղել",
    "tl.periods": "Ժամանակաշրջաններ",
    "tl.century": "Դարը",
    "tl.fullCentury": "ամբողջ դարը",
    "tl.startAria": "Ժամանակային պատուհանի սկիզբ",
    "tl.endAria": "Ժամանակային պատուհանի ավարտ",
    "tl.cStartAria": "Դարի պատուհանի սկիզբ",
    "tl.cEndAria": "Դարի պատուհանի ավարտ",
    "date.undated": "առանց ամսաթվի",

    "g3.thumb": "Մոդելը",
    "g3.thumbTitle": "Հարաբերական մոդելը եռաչափ",
    "g3.title": "Հարաբերական մոդելը",
    "g3.sub": "Քաշեք՝ պտտելու համար, ոլորեք՝ մասշտաբելու, սեղմեք հանգույցին՝ տեսնելու, թե ինչ ունի քարտեզը։",
    "g3.reset": "Վերականգնել",
    "g3.close": "Փակել",
    "g3.empty": "Քաշեք՝ մոդելը պտտելու համար։ Սեղմեք ցանկացած հանգույցի վրա՝ տեսնելու, թե քարտեզն ինչ ունի դրա մասին։",
    "g3.entries": "{n} գրառում քարտեզի վրա",
    "g3.entry": "1 գրառում քարտեզի վրա",
    "g3.nothing": "Այստեղ դեռ ոչինչ կապված չէ։ Հանգույցը մոդելում է, որպեսզի նյութն ունենա իր տեղը։ Ուղարկեք համապատասխան գրառումներ, և դրանք կհայտնվեն այստեղ։",
    "g3.connected": "Կապված է",

    "p3.thumb": "Կուսակցություններ",
    "p3.thumbTitle": "Հայաստանի քաղաքական դաշտը եռաչափ",
    "p3.title": "Քաղաքական դաշտը",
    "p3.sub": "Ձախից աջ՝ լայնքով, Մոսկվայից Բրյուսել՝ խորությամբ, ժամանակը՝ վեր։ Քաշեք տարեթիվը։",
    "p3.play": "Նվագարկել",
    "p3.pause": "Դադար",
    "p3.reset": "Վերականգնել",
    "p3.close": "Փակել",
    "p3.year": "Տարի",
    "p3.empty": "Քաշեք տարեթվի սահիչը, և դաշտը կլցվի։ Սեղմեք կուսակցության վրա՝ տեսնելու նրա տվյալները։",
    "p3.caveat": "Սպեկտրի և դիրքորոշումների տեղադրումները խմբագրական են, ոչ թե չափված։ Առանց նշանի ընտրական տվյալները դեռ պետք է ստուգվեն աղբյուրով։",
    "p3.founded": "հիմնադրվել է",
    "p3.dissolved": "լուծարվել է",
    "p3.figures": "Դեմքեր",
    "p3.elections": "Ընտրություններ",
    "p3.seats": "{n} մանդատ",
    "p3.checked": "ստուգված է աղբյուրով",
    "p3.stands": "Դիրքորոշումները",
    "p3.onmap": "Այս քարտեզի վրա",
    "p3.nothing": "Դեռ ոչինչ կապված չէ։",
    "p3.left": "Ձախ",
    "p3.centre": "Կենտրոն",
    "p3.right": "Աջ",
    "p3.hint": "Լիքը՝ մանդատ ունեցող · կետագիծ՝ մրցակցություն",
    "p3.electionOf": "{kind} ընտրություններ",
    "kind.parliamentary": "խորհրդարանական",
    "kind.presidential": "նախագահական",
    "kind.constitutional": "սահմանադրական",
    "kind.local": "տեղական",
    "kind.snap": "արտահերթ խորհրդարանական",

    "dir.N": "Հս", "dir.S": "Հվ", "dir.E": "Արլ", "dir.W": "Արմ",
    "unit.km": "կմ", "unit.m": "մ",
    "months": ["հնվ","փտվ","մրտ","ապր","մյս","հնս","հլս","օգս","սեպ","հոկ","նոյ","դեկ"],
    "monthsLong": ["հունվար","փետրվար","մարտ","ապրիլ","մայիս","հունիս","հուլիս","օգոստոս","սեպտեմբեր","հոկտեմբեր","նոյեմբեր","դեկտեմբեր"]
  },

  fa: {
    "doc.title": "پروژهٔ ایروان · نقشهٔ پژوهشی تعاملی",
    "doc.desc": "نقشه‌نگاری فضای شهری، جنبش‌های اجتماعی و رویدادهای سیاسی در ایروانِ ارمنستان.",
    "brand.title": "پروژهٔ ایروان",
    "brand.sub": "فضای شهری · جنبش‌های اجتماعی · رویدادهای سیاسی",
    "panel.collapse": "جمع کردن پنل",
    "lang.title": "زبان",

    "search.ph": "جست‌وجوی رویدادها، مکان‌ها، کنشگران…",
    "themes": "موضوع‌ها",
    "cat.all": "همهٔ موضوع‌ها",
    "cat.none": "هیچ موضوعی",
    "cat.some": "{n} از {total}",
    "all": "همه",
    "none": "هیچ‌کدام",
    "results": "نتایج",
    "sort.title": "مرتب‌سازی نتایج",
    "sort.dateAsc": "قدیمی‌ترین نخست",
    "sort.dateDesc": "تازه‌ترین نخست",
    "sort.az": "الفبایی",

    "res.empty": "هیچ رویدادی با صافی‌های کنونی همخوان نیست.",
    "res.emptyHint": "بازهٔ زمانی را گسترده کنید یا یکی از موضوع‌ها را دوباره فعال کنید.",
    "res.untitled": "(بی‌عنوان)",
    "res.context": "زمینه",

    "detail.back": "بازگشت به همهٔ رویدادها",
    "detail.happened": "آنچه رخ داد",
    "detail.analysis": "تحلیل",
    "detail.actors": "کنشگران",
    "detail.keywords": "کلیدواژه‌ها",
    "detail.sources": "منابع",
    "detail.fieldnote": "یادداشت میدانی",
    "detail.zoom": "بزرگ‌نمایی اینجا",
    "detail.copy": "کپی پیوند",
    "detail.copied": "کپی شد",

    "axis.built": "خیابان، آن‌گونه که ساخته شد",
    "axis.apart": "{d}° اختلاف",
    "scale.apart": "{d} کیلومتر",
    "scale.fromCity": "{d} کیلومتر تا {city}",
    "route.onfoot": "{d} پیاده",
    "route.from": "جایی که آغاز شد",
    "route.to": "جایی که پایان گرفت",
    "route.replay": "دوباره این مسیر را برو",
    "episode.isolate": "نمایش این دوره",
    "draw.title": "ترسیم",
    "draw.titleLong": "روی نقشه شکل بکشید، نام بگذارید و بیرون بدهید",
    "draw.shapes": "شکل‌ها",
    "draw.tool.point": "نقطه",
    "draw.tool.line": "خط",
    "draw.tool.area": "پهنه",
    "draw.tool.rect": "مستطیل",
    "draw.tool.circle": "شعاع",
    "draw.tool.select": "انتخاب و ویرایش",
    "draw.clear": "حذف همهٔ شکل‌ها",
    "draw.clearAsk": "همهٔ شکل‌هایی که کشیده‌اید حذف شود؟ این کار برگشت‌پذیر نیست.",
    "draw.kind.point": "نقطه",
    "draw.kind.line": "خط",
    "draw.kind.area": "پهنه",
    "draw.kind.rect": "مستطیل",
    "draw.kind.circle": "شعاع",
    "draw.hint.point": "برای گذاشتن کلیک کنید",
    "draw.hint.line": "برای افزودن نقطه کلیک کنید، دوبار کلیک یا Enter برای پایان، Esc برای لغو",
    "draw.hint.area": "برای افزودن نقطه کلیک کنید، روی نقطهٔ نخست یا Enter برای بستن، Esc برای لغو",
    "draw.hint.rect": "گوشهٔ روبه‌رو را کلیک کنید",
    "draw.hint.circle": "برای تعیین شعاع کلیک کنید",
    "draw.name": "نام این شکل",
    "draw.notePh": "یادداشتی دربارهٔ این شکل",
    "draw.zoom": "بزرگ‌نمایی روی آن",
    "draw.hide": "نمایش یا پنهان",
    "draw.colour": "رنگ بعدی",
    "draw.del": "حذف",
    "draw.copy": "کپی برای کلود",
    "draw.copied": "کپی شد",
    "draw.download": "GeoJSON",
    "draw.import": "بازکردن",
    "draw.empty": "هنوز چیزی کشیده نشده. از سمت چپ ابزاری را انتخاب کنید، روی نقشه بکشید، سپس به شکل نامی بدهید تا بتوانید دربارهٔ آن حرف بزنید.",
    "draw.exportHead": "شکل‌های کشیده‌شده روی نقشهٔ ایروان",
    "draw.exportFoot": "مختصات‌ها طول و عرض جغرافیایی، WGS84.",
    "draw.exportAsk": "کشیده‌شده در shokrangit.github.io/Yerevan-Project. هر شکل را با نامش صدا بزنید.",
    "tl.vertical": "خط زمان ایستاده در لبهٔ راست",
    "tl.horizontal": "خط زمان خوابیده در پایین",
    "tl.centuryOpen": "قرن، ۱۹۰۰ تا ۲۰۰۰",
    "geo.nkNote": "از سپتامبر ۲۰۲۳ زیر کنترل آذربایجان",
    "geo.nk1994": "تا جنگ ۲۰۲۰ در کنترل",
    "m.sheet": "ارتفاع پنل",
    "m.controls": "تنظیمات نقشه",
    "m.timeline": "نمایش خط زمان",
    "m.map": "نقشه",
    "m.read": "خواندن",
    "media.enlarge": "بزرگ‌نمایی",
    "media.close": "بستن",
    "media.fullscreen": "تمام‌صفحه",
    "media.prev": "عکس پیشین",
    "media.next": "عکس بعدی",
    "media.fieldwork": "عکس میدانی",
    "media.source": "منبع",
    "media.play": "پخش ویدیو",
    "media.embed": "ویدیوی جاسازی‌شده",

    "north.title": "بازگرداندن جهت به شمال",
    "pick.title": "برداشتن مختصات از روی نقشه",
    "pick.copy": "کپی",
    "pick.clear": "پاک کردن",
    "map.basemap": "نقشهٔ پایه",
    "map.terrain": "روشن یا خاموش کردن ناهمواری سه‌بعدی",
    "perf.dropped": "ناهمواری سه‌بعدی خاموش شد تا نقشه روی این دستگاه قابل استفاده بماند. شکل زمین همچنان با نور و سایه رسم می‌شود.",
    "perf.undo": "دوباره روشن کن",
    "map.reset": "بازنشانی نما",
    "map.cube": "مکعب",
    "map.cubeTitle": "یک دوره همچون مکعب زمان-مکان: جغرافیا روی کف، زمان رو به بالا",
    "cube.open": "این دوره را سرِ پا کن: جغرافیا روی کف، زمان رو به بالا",
    "cube.title": "سی و نه روز",
    "cube.body": "زمان از روی نقشه بلند می‌شود، از ۳۱ مارس تا ۸ مه ۲۰۱۸. هر دایره یک مدخل در روز خودش است، هر ستون جایی که ثابت مانده، و هر شیب حرکتی در طول روزها. خط زمان را بکشید تا مکعب برش بخورد.",
    "cube.method": "تاریخ‌ها در حد روز است، پس راهپیمایی دوساعتهٔ ۲۲ آوریل افقی رسم شده. پیاده‌روی از گیومری از وانادزور، دیلیجان، هرازدان و آبویان می‌گذرد؛ تنها دو سرِ آن مستند است و تاریخ‌های میانی در طول مسیر توزیع شده‌اند.",
    "map.pins": "نشانه‌ها",
    "map.districts": "مناطق",
    "map.districtsTitle": "نمایش یا پنهان‌کردن دوازده منطقهٔ شهرداری",
    "map.region": "ارمنستان",
    "map.regionTitle": "ارمنستان، همسایگانش و قره‌باغ با دو مرز، ۱۹۹۴ و ۲۰۲۰",
    "place.about": "دربارهٔ این مکان",
    "place.here": "روی نقشه، اینجا",
    "place.open": "این پرونده باز است: مطالب مربوط به این مکان به‌مرور اینجا افزوده می‌شود.",
    "place.mentions": "{n} بار در مقالهٔ خیابان شمالی نام برده شده",
    "place.mention1": "یک بار در مقالهٔ خیابان شمالی نام برده شده",
    "place.kind.square": "میدان",
    "place.kind.street": "خیابان",
    "place.kind.water": "آب",
    "place.kind.park": "پارک",
    "place.kind.site": "مکان",
    "place.kind.quarter": "محله",
    "map.pinsTitle": "نمایش یا پنهان‌کردن نشانه‌های رویدادها",
    "map.about": "درباره",

    "basemap.kentron": "نگاره‑زمینه",
    "basemap.drawn": "شهری که خودمان کشیده‌ایم",
    "basemap.void": "شهر، بدون زمین",
    "basemap.light": "روشن",
    "basemap.streets": "خیابان‌ها",
    "basemap.dark": "تیره",
    "basemap.satellite": "ماهواره‌ای",

    "about.title": "دربارهٔ این نقشه",
    "about.close": "بستن",
    "about.mapped": "{n} رویداد نقشه‌نگاری‌شده",
    "about.credit": "نقشهٔ پایه © CARTO، © مشارکت‌کنندگان OpenStreetMap",
    "about.updated": "به‌روزرسانی داده‌ها: {d}",
    "about.draft": "ترجمهٔ ارمنی و فارسی نخستین برگردان است و هنوز بازبینی می‌شود.",

    "loading": "در حال بارگذاری نقشه…",
    "err.load": "بارگذاری data/events.json ممکن نشد",
    "err.localhint": "اگر index.html را مستقیم از روی دیسک باز کرده‌اید، به‌جای آن یک سرور محلی اجرا کنید:",
    "notice.basemap": "نقشهٔ پایه بارگذاری نشد.",
    "notice.basemapBody": "خط زمان، موضوع‌ها و فهرست رویدادها همچنان کار می‌کنند. این معمولاً مشکل شبکه یا فایروال در رسیدن به سرور کاشی‌های نقشه است.",

    "tl.play": "پخش در طول زمان",
    "tl.full": "کل بازه",
    "tl.here": "مدخل اینجا",
    "tl.close": "بستن",
    "spur.close": "بستن",
    "spur.open": "گشودن این دوره",
    "detail.chronology": "گاه‌شمار",
    "detail.chronicle": "سال به سال",
    "detail.slogans": "چه شعاری داده می‌شود",
    "march.years": "فعال {y}",
    "march.replay": "این مسیر را بپیما",
    "start.freedom": "میدان آزادی",
    "start.republic": "میدان جمهوری",
    "start.unconfirmed": "میدان آغاز نامعلوم",
    "start.none": "راهپیمایی برگزار نشد",
    "tl.periods": "دوره‌ها",
    "tl.century": "آن سده",
    "tl.fullCentury": "کل سده",
    "tl.startAria": "آغاز بازهٔ زمانی",
    "tl.endAria": "پایان بازهٔ زمانی",
    "tl.cStartAria": "آغاز بازهٔ سده",
    "tl.cEndAria": "پایان بازهٔ سده",
    "date.undated": "بدون تاریخ",

    "g3.thumb": "مدل",
    "g3.thumbTitle": "مدل رابطه‌ای در سه‌بعد",
    "g3.title": "مدل رابطه‌ای",
    "g3.sub": "برای چرخاندن بکشید، برای بزرگ‌نمایی بغلتانید، روی هر گره کلیک کنید تا ببینید نقشه چه دارد.",
    "g3.reset": "بازنشانی",
    "g3.close": "بستن",
    "g3.empty": "برای چرخاندن مدل بکشید. روی هر گره کلیک کنید تا ببینید نقشه دربارهٔ آن چه دارد.",
    "g3.entries": "{n} مدخل روی نقشه",
    "g3.entry": "۱ مدخل روی نقشه",
    "g3.nothing": "هنوز چیزی به اینجا پیوند نخورده است. گره در مدل هست تا مطالب جایی برای نشستن داشته باشند, مدخل‌هایش را بفرستید تا اینجا ظاهر شوند.",
    "g3.connected": "پیوسته به",

    "p3.thumb": "احزاب",
    "p3.thumbTitle": "چشم‌انداز سیاسی ارمنستان در سه‌بعد",
    "p3.title": "چشم‌انداز سیاسی",
    "p3.sub": "چپ به راست در عرض، مسکو تا بروکسل در عمق، زمان رو به بالا. سال را بکشید.",
    "p3.play": "پخش",
    "p3.pause": "مکث",
    "p3.reset": "بازنشانی",
    "p3.close": "بستن",
    "p3.year": "سال",
    "p3.empty": "نوار سال را بکشید تا چشم‌انداز پر شود. روی یک حزب کلیک کنید تا پروندهٔ آن باز شود.",
    "p3.caveat": "جایگاه‌های طیف و مواضع، تحریری‌اند نه اندازه‌گیری‌شده. ارقام انتخاباتی بدون علامت تیک هنوز باید با منبع راستی‌آزمایی شوند.",
    "p3.founded": "تأسیس",
    "p3.dissolved": "انحلال",
    "p3.figures": "چهره‌ها",
    "p3.elections": "انتخابات",
    "p3.seats": "{n} کرسی",
    "p3.checked": "با منبع راستی‌آزمایی شده",
    "p3.stands": "مواضع",
    "p3.onmap": "روی این نقشه",
    "p3.nothing": "هنوز چیزی پیوند نخورده است.",
    "p3.left": "چپ",
    "p3.centre": "میانه",
    "p3.right": "راست",
    "p3.hint": "توپر = دارای کرسی · خط‌چین = رقابت",
    "p3.electionOf": "انتخابات {kind}",
    "kind.parliamentary": "پارلمانی",
    "kind.presidential": "ریاست‌جمهوری",
    "kind.constitutional": "قانون اساسی",
    "kind.local": "محلی",
    "kind.snap": "زودهنگام پارلمانی",

    "dir.N": "ش", "dir.S": "ج", "dir.E": "خ", "dir.W": "ب",
    "unit.km": "کیلومتر", "unit.m": "متر",
    "months": ["ژانویه","فوریه","مارس","آوریل","مه","ژوئن","ژوئیه","اوت","سپتامبر","اکتبر","نوامبر","دسامبر"],
    "monthsLong": ["ژانویه","فوریه","مارس","آوریل","مه","ژوئن","ژوئیه","اوت","سپتامبر","اکتبر","نوامبر","دسامبر"]
  }

  };

  /* ---------------- state ---------------- */

  var KEY = "yerevan-lang";
  var listeners = [];
  var lang = "en";

  function known(c) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === c) return c;
    return null;
  }

  function initial() {
    var q = /[?&]lang=([a-z]{2})/.exec(location.search);
    if (q && known(q[1])) return q[1];
    try { var s = localStorage.getItem(KEY); if (known(s)) return s; } catch (e) {}
    var nav = (navigator.languages || [navigator.language || "en"]);
    for (var i = 0; i < nav.length; i++) {
      var c = String(nav[i]).slice(0, 2).toLowerCase();
      if (c === "hy" || c === "fa") return c;
    }
    return "en";
  }

  function meta(c) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === c) return LANGS[i];
    return LANGS[0];
  }

  /* ---------------- lookup ---------------- */

  /* A missing translation returns the English string, never the key.
     A half-translated site should read as English in the gaps, not as
     debugging output in front of a reader. */
  function t(key, vars) {
    var v = STR[lang] && STR[lang][key];
    if (v == null) v = STR.en[key];
    if (v == null) return "";
    if (vars) {
      v = String(v).replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] == null ? m : vars[k];
      });
    }
    return v;
  }

  function arr(key) {
    var v = STR[lang] && STR[lang][key];
    return v && v.length ? v : STR.en[key];
  }

  /* Data fields. tr(obj,"title") returns obj.title_fa in Persian if it
     exists, obj.title otherwise. That is the whole convention. */
  function tr(obj, field) {
    if (!obj) return "";
    if (lang !== "en") {
      var v = obj[field + "_" + lang];
      if (v != null && v !== "") return v;
    }
    return obj[field] == null ? "" : obj[field];
  }

  function trList(obj, field) {
    if (!obj) return [];
    if (lang !== "en") {
      var v = obj[field + "_" + lang];
      if (v && v.length) return v;
    }
    return obj[field] || [];
  }

  /* ---------------- numbers and dates ---------------- */

  var FA_DIGITS = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];

  /* Persian readers expect Persian-Indic digits in running text. Coordinates
     and zoom levels stay Latin; they are read as machine values and get
     copied into other tools. */
  /* Decimal separators differ too, and a stray full stop in a Persian or
     Armenian number is the kind of small wrongness a reader notices before
     anything else. Armenian keeps Latin digits and takes a comma; Persian
     takes its own digits and its own decimal mark. */
  function num(n) {
    var s = String(n);
    if (lang === "hy") return s.replace(".", ",");
    if (lang !== "fa") return s;
    return s.replace(/[0-9]/g, function (d) { return FA_DIGITS[+d]; }).replace(".", "\u066B");
  }

  function month(i, long) {
    var a = arr(long ? "monthsLong" : "months");
    return a[i] || "";
  }

  /* ---------------- applying a language ---------------- */

  function applyStatic(root) {
    root = root || document;
    var nodes = root.querySelectorAll("[data-i18n]");
    Array.prototype.forEach.call(nodes, function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    ["title", "placeholder", "aria-label"].forEach(function (attr) {
      var sel = "[data-i18n-" + attr + "]";
      Array.prototype.forEach.call(root.querySelectorAll(sel), function (el) {
        el.setAttribute(attr, t(el.getAttribute("data-i18n-" + attr)));
      });
    });
  }

  function apply() {
    var m = meta(lang);
    var html = document.documentElement;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", m.dir);
    html.classList.toggle("rtl", m.dir === "rtl");
    html.classList.remove("lang-en", "lang-hy", "lang-fa");
    html.classList.add("lang-" + lang);
    document.title = t("doc.title");
    var d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute("content", t("doc.desc"));
    applyStatic(document);
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), function (b) {
      var on = b.getAttribute("data-lang") === lang;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    listeners.forEach(function (fn) {
      try { fn(lang); } catch (err) { console.warn("i18n listener:", err); }
    });
  }

  function set(c) {
    if (!known(c) || c === lang) return;
    lang = c;
    try { localStorage.setItem(KEY, c); } catch (e) {}
    apply();
  }

  /* ---------------- the switch ---------------- */

  function mount() {
    var host = document.getElementById("lang-switch");
    if (!host) return;
    host.innerHTML = LANGS.map(function (L) {
      return '<button type="button" data-lang="' + L.code + '" lang="' + L.code +
             '" title="' + L.name + '" aria-pressed="false">' + L.label + "</button>";
    }).join("");
    host.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-lang]");
      if (b) set(b.getAttribute("data-lang"));
    });
  }

  lang = initial();

  window.I18N = {
    get lang() { return lang; },
    get dir() { return meta(lang).dir; },
    langs: LANGS,
    t: t,
    arr: arr,
    tr: tr,
    trList: trList,
    num: num,
    month: month,
    set: set,
    apply: apply,
    applyStatic: applyStatic,
    onChange: function (fn) { listeners.push(fn); }
  };

  function boot() { mount(); apply(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }

})();
