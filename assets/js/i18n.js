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
    "doc.title": "Yerevan Project; An Interactive Research Map",
    "doc.desc": "Mapping urban space, social movements, and political events in Yerevan, Armenia.",
    "brand.title": "Yerevan Project",
    "brand.sub": "Urban space · social movements · political events",
    "panel.collapse": "Collapse panel",
    "lang.title": "Language",

    "search.ph": "Search events, places, actors…",
    "themes": "Themes",
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
    "media.source": "source",
    "media.play": "Play video",
    "media.embed": "Embedded video",

    "north.title": "Reset bearing to north",
    "pick.title": "Pick a coordinate from the map",
    "pick.copy": "Copy",
    "pick.clear": "Clear",
    "map.basemap": "Basemap",
    "map.reset": "Reset view",
    "map.about": "About",

    "basemap.kentron": "Figure-ground",
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
    "spur.close": "close",
    "spur.open": "open this period",
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
    "doc.title": "Երևանի նախագիծ; ինտերակտիվ հետազոտական քարտեզ",
    "doc.desc": "Քաղաքային տարածքի, հասարակական շարժումների և քաղաքական իրադարձությունների քարտեզագրում Երևանում։",
    "brand.title": "Երևանի նախագիծ",
    "brand.sub": "Քաղաքային տարածք · հասարակական շարժումներ · քաղաքական իրադարձություններ",
    "panel.collapse": "Ծալել վահանակը",
    "lang.title": "Լեզու",

    "search.ph": "Որոնել իրադարձություններ, վայրեր, դերակատարներ…",
    "themes": "Թեմաներ",
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
    "media.source": "աղբյուր",
    "media.play": "Նվագարկել տեսանյութը",
    "media.embed": "Ներդրված տեսանյութ",

    "north.title": "Ուղղել դեպի հյուսիս",
    "pick.title": "Ընտրել կոորդինատ քարտեզից",
    "pick.copy": "Պատճենել",
    "pick.clear": "Մաքրել",
    "map.basemap": "Հիմնաքարտեզ",
    "map.reset": "Վերականգնել տեսքը",
    "map.about": "Մասին",

    "basemap.kentron": "Պատկեր-ֆոն",
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
    "spur.close": "փակել",
    "spur.open": "բացել այս ժամանակաշրջանը",
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
    "g3.nothing": "Այստեղ դեռ ոչինչ կապված չէ։ Հանգույցը մոդելում է, որպեսզի նյութն ունենա իր տեղը; ուղարկեք համապատասխան գրառումներ, և դրանք կհայտնվեն այստեղ։",
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
    "doc.title": "پروژهٔ ایروان; نقشهٔ پژوهشی تعاملی",
    "doc.desc": "نقشه‌نگاری فضای شهری، جنبش‌های اجتماعی و رویدادهای سیاسی در ایروانِ ارمنستان.",
    "brand.title": "پروژهٔ ایروان",
    "brand.sub": "فضای شهری · جنبش‌های اجتماعی · رویدادهای سیاسی",
    "panel.collapse": "جمع کردن پنل",
    "lang.title": "زبان",

    "search.ph": "جست‌وجوی رویدادها، مکان‌ها، کنشگران…",
    "themes": "موضوع‌ها",
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
    "media.source": "منبع",
    "media.play": "پخش ویدیو",
    "media.embed": "ویدیوی جاسازی‌شده",

    "north.title": "بازگرداندن جهت به شمال",
    "pick.title": "برداشتن مختصات از روی نقشه",
    "pick.copy": "کپی",
    "pick.clear": "پاک کردن",
    "map.basemap": "نقشهٔ پایه",
    "map.reset": "بازنشانی نما",
    "map.about": "درباره",

    "basemap.kentron": "نگاره‑زمینه",
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
    "spur.close": "بستن",
    "spur.open": "گشودن این دوره",
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
