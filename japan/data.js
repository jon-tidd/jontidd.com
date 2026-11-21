/*
 * Gulch Japan knowledge base.
 *
 * Every claim carries one of four labels in the copy:
 *   Vault:    stated in this repository (see meta.vaultSources).
 *   Research: general travel knowledge or a public page read on meta.researchedOn.
 *   Estimate: a research-based range, never a live quote.
 *   Open:     not known yet; one of the two travelers has to answer it.
 */
window.JAPAN_KB = {
  meta: {
    title: "Gulch Japan",
    subtitle: "For Jon & Kathleen · a ~9-day trip for two",
    researchedOn: "2026-11-21",
    planningYear: 2027,
    planningYearNote: "Open: the vault has no dates. Example dates assume 2027.",
    tripFrame: {
      summary: "Fly out on a Friday or Saturday, fly home the following Sunday.",
      why: "Research: westbound flights land the next calendar day, and the flight home lands the same Sunday it leaves. Japan runs 13 hours ahead of Eastern Daylight Time and 14 ahead of Eastern Standard Time.",
      departOptions: [
        { id: "fri", label: "Leave Friday", calendarDays: 10, nightsInJapan: 8, fullDays: 7, note: "Land Saturday afternoon. Eight nights and seven full days on the ground." },
        { id: "sat", label: "Leave Saturday", calendarDays: 9, nightsInJapan: 7, fullDays: 6, note: "Land Sunday afternoon. Seven nights and six full days on the ground." }
      ],
      usableHoursPerFullDay: 8
    },
    travelers: {
      who: "Jon and Kathleen, traveling as a couple.",
      status: "Assumed for planning, not decided.",
      kidsNote: "Vault: the March 2026 brainstorm left 'kids or no kids' as an open question. Kathleen's parents are the usual weekend childcare, and the kids were looked after at home during a four-day Denver trip in October 2026. Nine or ten days is longer than any cover on record."
    },
    airportsNote: "Reagan National (DCA) has no nonstop to Tokyo. The nonstops leave from Dulles (IAD) and land at Tokyo Haneda (HND). There is no flight between DCA and IAD; Dulles is reached by road or the Metro Silver Line.",
    labels: {
      Vault: "Stated in the Gulch vault.",
      Research: "General travel knowledge or a public page read on 2026-11-21.",
      Estimate: "A research range, not a live quote.",
      Open: "Unanswered. Needs Jon or Kathleen."
    },
    costBands: {
      Free: "No ticket",
      "$": "Under about $20 a person",
      "$$": "About $20 to $75 a person",
      "$$$": "About $75 to $200 a person",
      "$$$$": "Over about $200 a person"
    },
    priceBands: {
      "$": "Under about ¥15,000 a night for two",
      "$$": "About ¥15,000 to ¥30,000 a night",
      "$$$": "About ¥30,000 to ¥60,000 a night",
      "$$$$": "Over about ¥60,000 a night"
    },
    yenNote: "Vault: a November 2026 cel note converts ¥16,999 to about $113, roughly ¥150 to the dollar. Research: recheck the rate before budgeting.",
    vaultSources: [
      "raw/claude/2026-09-25/2026-03-31-japan-trip-planning-and-prioritization.md: the original brainstorm request. Eight regions, the UFO town Jon called 'Lena' (Iino, Fukushima), and the open questions on dates, duration, kids and budget.",
      "wiki/personal/travel.md: Japan is 'still in brainstorming' with no dates; the September 2025 Iceland road trip; Marriott stays paid with points.",
      "wiki/people/kathleen-tidd.md: tea for Kathleen and specialty coffee for Jon; her favorite animated films (Bambi, The Lion King, Cinderella); new to gardening; the usual weekend childcare.",
      "raw/claude/2026-09-25/2026-08-08-kathleen-s-favorite-animated-movies-and-cartoons.md: source chat for the animated-film favorites.",
      "raw/claude/2026-09-25/2026-05-24-penn-state-anniversary-itinerary-with-map.md: 'coffee for him, tea for her' on an anniversary afternoon.",
      "raw/claude/2026-09-25/2026-05-07-anniversary-gift-themes-and-ideas.md: the pearls-in-Japan idea (Mikimoto in Ginza, Pearl Island near Toba) tied to the planned trip.",
      "raw/claude/2026-09-25/2026-08-07-lake-anna-date-night-brewery-and-winery-recommendations.md: Jon asked for a quiet, shaded spot for a date night.",
      "wiki/topics/hobbies.md: production-cel collecting (The Big O, Outlaw Star, SWAT Kats), Mandarake and Yahoo Auctions Japan, and the production-cels-only rule.",
      "raw/claude-memory/2026-09-25/files/topics/interests.md: retro-futurism, synthwave and heavy music, meteorites, and the buy-it-for-life philosophy.",
      "raw/claude/2026-09-25/2026-04-28-best-coffee-near-30-rock.md: % Arabica, the Kyoto roaster, was the pick near 30 Rock.",
      "wiki/personal/identity.md: Jon holds Global Entry; no passport scan or expiry date is on record.",
      "wiki/personal/family.md: who has watched the kids, and for how long."
    ],
    researchSources: [
      "KAYAK route pages for Washington Dulles to Tokyo Haneda and Washington, D.C. to Tokyo (fare-trend data dated 2026-11-18).",
      "momondo route page for Dulles to Haneda (cheapest-month note).",
      "Published timetables for ANA NH101/NH102 and United UA803 (FlightsFrom, Directflights, FlightMapper; updated November 2026).",
      "National Astronomical Observatory of Japan, 2027 calendar of national holidays.",
      "Fukushima City and UFO no Sato pages for the UFO Fureaikan (hours, closed days, admission, bus access).",
      "Ghibli Museum and Ghibli Park official ticket pages; teamLab official pages for Borderless and Planets.",
      "Marriott's Kyoto destination page and a January 2026 list of Marriott Bonvoy hotels in Japan."
    ]
  },

  regions: [
    { name: "Kanto", blurb: "Tokyo and its day trips.", inVaultBrainstorm: true },
    { name: "Chubu", blurb: "Fuji, the Japan Alps and the Sea of Japan coast.", inVaultBrainstorm: true },
    { name: "Kansai", blurb: "Kyoto, Osaka, Nara and the temple mountains.", inVaultBrainstorm: true },
    { name: "Hiroshima & Setouchi", blurb: "Hiroshima, Miyajima and the Inland Sea islands.", inVaultBrainstorm: true },
    { name: "Tohoku", blurb: "The quiet north of Honshu, including Jon's UFO town.", inVaultBrainstorm: true },
    { name: "Kyushu", blurb: "Fukuoka food, Beppu steam, Nagasaki history.", inVaultBrainstorm: true },
    { name: "Hokkaido", blurb: "Snow, open country and a separate flight.", inVaultBrainstorm: true },
    { name: "Okinawa", blurb: "Subtropical islands, a different trip.", inVaultBrainstorm: true }
  ],

  seasons: [
    {
      id: "w-winter",
      name: "Deep winter value",
      months: "Mid-January to late February",
      exampleDates: "Fri Jan 22 or Sat Jan 23 → Sun Jan 31, 2027",
      weather: "Tokyo is cold, dry and sunny: about 36–50°F (2–10°C). Kyoto is a little colder. Snow in Takayama, Tohoku and Hokkaido.",
      crowds: "The lowest of the year at the big sights. The exception is Lunar New Year week (February 6, 2027).",
      costs: "Cheapest long-haul fares of the year and soft hotel rates outside ski towns.",
      pros: ["Fuji is visible most days in the dry air", "Onsen and ryokan are at their best in the cold", "Kyoto temples without queues", "Plum blossom starts in late February"],
      cons: ["Short days: sunset near 5 pm", "Gardens are bare", "Mountain routes can close for snow"],
      fitForJonKathleen: "Research: strong for indoor passions (cel hunting, coffee, tea rooms, museums) and for a ryokan night. Weaker for the outdoor walks both of you like.",
      flightCostBand2p: { low: 2500, high: 2900, basis: "KAYAK's cheapest month for Dulles to Haneda is February, about $1,260 a person." },
      scores: { weather: 5, crowds: 9, cost: 9, sakura: 0, foliage: 0 },
      recommendationScore: 7
    },
    {
      id: "w-sakura",
      name: "Cherry blossom",
      months: "Late March to early April",
      exampleDates: "Fri Mar 26 or Sat Mar 27 → Sun Apr 4, 2027",
      weather: "Mild and changeable: about 45–63°F (7–17°C), with some rain.",
      crowds: "The busiest fortnight of the year in Tokyo and Kyoto.",
      costs: "Peak hotel rates, often double, and firm airfares. Good rooms sell out months ahead.",
      pros: ["The postcard version of Japan", "Evening blossom walks along the Meguro River and Kyoto's Philosopher's Path", "Long list of seasonal sweets and teas"],
      cons: ["Full bloom moves by a week either way; a fixed nine-day booking is a bet", "Queues at every famous spot", "The quiet-date mood is hard to find"],
      fitForJonKathleen: "Research: beautiful, but it fights the quiet date-night pattern in the vault and costs the most. Works only with dawn starts and second-tier spots.",
      flightCostBand2p: { low: 3200, high: 3900, basis: "Estimate: spring-break and blossom demand push fares toward the top of KAYAK's typical range." },
      scores: { weather: 7, crowds: 2, cost: 2, sakura: 10, foliage: 0 },
      recommendationScore: 6
    },
    {
      id: "w-golden-week",
      name: "Golden Week",
      months: "April 29 to May 5, 2027",
      exampleDates: "Avoid: Thu Apr 29 → Wed May 5, 2027",
      weather: "Lovely: about 57–72°F (14–22°C).",
      crowds: "All of Japan travels at once. Trains, hotels and sights are full.",
      costs: "Domestic prices peak and reserved Shinkansen seats sell out.",
      pros: ["Good weather", "Late cherry blossom in Tohoku and Hokkaido"],
      cons: ["In 2027 only April 30 is a working day, so the break runs seven days", "Hotel rates spike", "Day trips turn into queues"],
      fitForJonKathleen: "Research: avoid. Nothing on either of your lists needs this week.",
      flightCostBand2p: { low: 3400, high: 4200, basis: "Estimate: holiday-week demand at both ends." },
      scores: { weather: 8, crowds: 0, cost: 1, sakura: 2, foliage: 0 },
      recommendationScore: 2
    },
    {
      id: "w-mid-may",
      name: "Mid-May, after Golden Week",
      months: "May 8 to the end of May",
      exampleDates: "Fri May 21 or Sat May 22 → Sun May 30, 2027",
      weather: "The most comfortable stretch of the year: about 60–75°F (16–24°C), low humidity, little rain.",
      crowds: "A real lull once the holiday ends. School trips fill Kyoto and Nara on weekday mornings.",
      costs: "Shoulder-season fares and normal hotel rates.",
      pros: ["Fresh green maples, wisteria, azalea and iris", "Long daylight for dense sightseeing days", "First tea harvest (shincha) is in the shops", "Easy weather for the Nakasendo, Kamakura and Hakone walks"],
      cons: ["No blossom and no autumn color", "Rain is possible late in the month, and Okinawa is already in its rainy season"],
      fitForJonKathleen: "Vault: the wedding anniversary is May 25. Research: the example dates put it mid-trip and land you home the day before Memorial Day, which gives a free day for jet lag. New-harvest tea suits Kathleen and the weather suits the walks.",
      flightCostBand2p: { low: 2700, high: 3300, basis: "Estimate: mid-range of KAYAK's typical $1,284–$1,861 a person, before summer pricing starts." },
      scores: { weather: 9, crowds: 7, cost: 7, sakura: 0, foliage: 0 },
      recommendationScore: 9
    },
    {
      id: "w-june-rainy",
      name: "Rainy season",
      months: "Early June to mid-July",
      exampleDates: "Fri Jun 11 or Sat Jun 12 → Sun Jun 20, 2027",
      weather: "Warm, humid and grey: about 67–79°F (19–26°C). Rain on roughly half the days, often drizzle rather than downpour.",
      crowds: "Thin at outdoor sights.",
      costs: "Hotels in Japan are cheap. Flights from Washington are not: KAYAK ranks June among the two most expensive months.",
      pros: ["Hydrangea season in Kamakura and Hakone", "Moss gardens and temples look their best wet", "Easy restaurant bookings"],
      cons: ["Views of Fuji are rare", "Humidity wears on long walking days", "US summer airfares"],
      fitForJonKathleen: "Vault: the family spent a June week at Tyler Place in both 2025 and 2026. Research: this window competes with that habit and trades cheap hotels for expensive flights.",
      flightCostBand2p: { low: 3000, high: 3500, basis: "KAYAK's June median is about $1,510–$1,660 a person." },
      scores: { weather: 4, crowds: 8, cost: 5, sakura: 0, foliage: 0 },
      recommendationScore: 5
    },
    {
      id: "w-high-summer",
      name: "High summer",
      months: "Mid-July to late August",
      exampleDates: "Sat Jul 24 → Sun Aug 1, 2027",
      weather: "Hot and very humid: about 77–93°F (25–34°C) in Tokyo and Kyoto. Hokkaido is the escape.",
      crowds: "Japanese school holidays. Cities are bearable; resorts and theme parks are packed.",
      costs: "Summer airfares and firm hotel rates.",
      pros: ["Fireworks and festivals, including Kyoto's Gion Matsuri in July", "Fuji climbing season", "Hokkaido is at its best"],
      cons: ["Heat limits walking to mornings and evenings", "Typhoon risk begins", "Kyoto in August is punishing"],
      fitForJonKathleen: "Research: poor for the temple-and-garden walking most of this plan depends on. It only works as a Hokkaido trip.",
      flightCostBand2p: { low: 3000, high: 3700, basis: "Estimate: US summer peak pricing." },
      scores: { weather: 2, crowds: 5, cost: 4, sakura: 0, foliage: 0 },
      recommendationScore: 3
    },
    {
      id: "w-obon",
      name: "Obon",
      months: "About August 11 to 16, 2027",
      exampleDates: "Avoid: Wed Aug 11 → Mon Aug 16, 2027",
      weather: "Peak heat and humidity.",
      crowds: "The second national travel rush. Trains out of Tokyo and Osaka fill.",
      costs: "Peak domestic prices.",
      pros: ["Bon dances and Kyoto's Daimonji bonfires on August 16"],
      cons: ["Heat", "Crowded transport", "Many small restaurants and shops close for the week"],
      fitForJonKathleen: "Research: avoid.",
      flightCostBand2p: { low: 3300, high: 4000, basis: "Estimate: holiday demand on top of summer pricing." },
      scores: { weather: 2, crowds: 1, cost: 2, sakura: 0, foliage: 0 },
      recommendationScore: 2
    },
    {
      id: "w-september",
      name: "September shoulder",
      months: "September",
      exampleDates: "Fri Sep 3 or Sat Sep 4 → Sun Sep 12, 2027",
      weather: "Still warm: about 70–82°F (21–28°C), easing late in the month. This is the peak of typhoon season.",
      crowds: "Low, apart from the September 18–20 long weekend and the September 23 holiday.",
      costs: "KAYAK's cheapest month across all Washington-to-Tokyo routes.",
      pros: ["Low fares and open hotel calendars", "Warm evenings for izakaya and night walks", "First color in Hokkaido's mountains late in the month"],
      cons: ["A typhoon can cost a day or cancel a flight", "Early September is still humid", "No blossom, little color"],
      fitForJonKathleen: "Vault: the Iceland trip was an early-September week, so the month has worked before. Research: build in one flexible day and avoid tight same-day connections.",
      flightCostBand2p: { low: 2400, high: 2900, basis: "KAYAK's September median for Washington to Tokyo is about $1,200 a person across all routes; the Dulles nonstop usually sits above that." },
      scores: { weather: 5, crowds: 7, cost: 9, sakura: 0, foliage: 1 },
      recommendationScore: 6
    },
    {
      id: "w-october",
      name: "Mid to late October",
      months: "October 12 to 31",
      exampleDates: "Fri Oct 15 or Sat Oct 16 → Sun Oct 24, 2027",
      weather: "Clear, dry and comfortable: about 57–70°F (14–21°C). Typhoon risk fades after the first third of the month.",
      crowds: "Steady international crowds, but below the November peak.",
      costs: "Shoulder fares. momondo lists October as the cheapest month for the Dulles nonstop.",
      pros: ["Best walking weather after May", "Autumn color in Nikko, the Alps and Tohoku", "Clear Fuji views return", "Leaves after the October 11 long weekend"],
      cons: ["Kyoto's maples are still green", "Popular hotels book early"],
      fitForJonKathleen: "Research: the best all-round match. Comfortable for dense days, calm enough for quiet evenings, and a natural fit for a Nikko or Fukushima side trip in color.",
      flightCostBand2p: { low: 2500, high: 3100, basis: "momondo's October average is about $1,250 a person; KAYAK's typical nonstop range starts at $1,284." },
      scores: { weather: 9, crowds: 5, cost: 7, sakura: 0, foliage: 5 },
      recommendationScore: 9
    },
    {
      id: "w-november",
      name: "Autumn color",
      months: "Mid to late November",
      exampleDates: "Fri Nov 12 or Sat Nov 13 → Sun Nov 21, 2027",
      weather: "Crisp and mostly dry: about 48–62°F (9–17°C).",
      crowds: "Kyoto is as busy as blossom season at the famous maple temples. Tokyo is calmer.",
      costs: "Kyoto hotels peak. Airfares rise toward US Thanksgiving (November 25, 2027).",
      pros: ["Kyoto's maples, lit at night at several temples", "Ginkgo avenues in Tokyo", "Good ryokan and onsen weather"],
      cons: ["Kyoto peak color usually falls after November 20, which runs into Thanksgiving week and the November 23 holiday in Japan", "Dusk before 5 pm"],
      fitForJonKathleen: "Research: the most beautiful option if Kyoto is the heart of the trip. The example dates catch early color; the following week catches the peak but collides with Thanksgiving.",
      flightCostBand2p: { low: 2700, high: 3400, basis: "Estimate: shoulder pricing early in the month, rising into Thanksgiving week." },
      scores: { weather: 8, crowds: 3, cost: 6, sakura: 0, foliage: 10 },
      recommendationScore: 8
    },
    {
      id: "w-early-december",
      name: "Early December afterglow",
      months: "December 1 to 15",
      exampleDates: "Fri Dec 3 or Sat Dec 4 → Sun Dec 12, 2027",
      weather: "Cold and bright: about 41–55°F (5–13°C).",
      crowds: "Low. The foliage crowd has left and the holidays have not begun.",
      costs: "Hotels drop back. KAYAK showed its cheapest Dulles nonstop for travel in the first half of December.",
      pros: ["Late maples in Tokyo and southern Kyoto in the first week", "Winter illuminations", "Clear Fuji views and warm onsen"],
      cons: ["Short days", "Color is a bonus, not a promise", "The household calendar is busy before Christmas"],
      fitForJonKathleen: "Research: a sleeper pick for cel hunting, coffee, tea rooms and a ryokan night without the crowds.",
      flightCostBand2p: { low: 2700, high: 3200, basis: "KAYAK listed a $1,365 nonstop for December 1–15; fares climb sharply after mid-month." },
      scores: { weather: 6, crowds: 8, cost: 7, sakura: 0, foliage: 5 },
      recommendationScore: 7
    },
    {
      id: "w-new-year",
      name: "New Year",
      months: "December 28 to January 4",
      exampleDates: "Avoid: Tue Dec 28, 2027 → Tue Jan 4, 2028",
      weather: "Cold and dry.",
      crowds: "Shrines are packed for the first visit of the year. Trains fill with families going home.",
      costs: "KAYAK's most expensive month to fly. Ryokan charge holiday rates.",
      pros: ["First shrine visit of the year is a real cultural moment"],
      cons: ["Museums, markets and many restaurants close from about December 29 to January 3", "The UFO hall closes December 29 to January 3", "Highest fares of the year"],
      fitForJonKathleen: "Research: avoid. Too much of what you would come for is shut.",
      flightCostBand2p: { low: 3400, high: 4200, basis: "KAYAK's December median is about $1,690–$1,720 a person; holiday dates run higher." },
      scores: { weather: 5, crowds: 2, cost: 1, sakura: 0, foliage: 0 },
      recommendationScore: 2
    }
  ],

  flights: {
    estimateLabel: "Research estimates from fare-trend pages read on 2026-11-21. Economy, round trip. Not live quotes.",
    honesty: {
      headline: "DCA has no nonstop to Tokyo.",
      body: "Reagan National's perimeter rule keeps long-haul flights out. The Washington nonstops to Tokyo leave from Dulles, and both land at Haneda.",
      points: [
        "Research: ANA and United each fly Dulles (IAD) to Tokyo Haneda (HND) once a day, about 14 hours 30 minutes out and 12 hours 30 to 50 minutes back.",
        "Research: there is no flight between DCA and IAD. From Northern Virginia, Dulles is a drive or a Metro Silver Line ride.",
        "Research: from DCA itself, the best you can do without touching another country is one stop at a US hub."
      ]
    },
    baseline: {
      perPersonLow: 1284,
      perPersonHigh: 1861,
      note: "KAYAK's typical range for the Dulles to Haneda nonstop, round trip, per person."
    },
    monthlySignals: [
      { month: "February", perPerson: 1260, note: "Cheapest month for Dulles to Haneda (KAYAK median)." },
      { month: "September", perPerson: 1200, note: "Cheapest month across all Washington to Tokyo routes (KAYAK median, includes one-stops)." },
      { month: "October", perPerson: 1250, note: "Cheapest month for the Dulles nonstop per momondo." },
      { month: "June", perPerson: 1650, note: "Second most expensive month (KAYAK median)." },
      { month: "December", perPerson: 1700, note: "Most expensive month (KAYAK median)." }
    ],
    options: [
      {
        id: "f-iad-nonstop",
        name: "Dulles nonstop",
        route: "IAD → HND",
        stops: "Nonstop",
        duration: "About 14 h 30 out, 12 h 30–50 back",
        multiplierLow: 1,
        multiplierHigh: 1,
        selectable: true,
        verdict: "Recommended",
        why: "One flight each way, the shortest total time, and the lowest risk of a missed connection on a nine-day trip.",
        pros: ["Lands at Haneda mid-afternoon, 20 to 30 minutes from central Tokyo", "Two daily choices on Star Alliance carriers", "No bags to recheck"],
        cons: ["Not DCA", "Nonstops price a little above the cheapest one-stop fares"]
      },
      {
        id: "f-dca-onestop",
        name: "DCA, one stop in the US",
        route: "DCA → US hub → HND or NRT",
        stops: "One stop",
        duration: "About 17 to 21 hours each way",
        multiplierLow: 0.95,
        multiplierHigh: 1.05,
        selectable: true,
        verdict: "Works if DCA matters most",
        why: "Keeps the departure at National and still avoids a stop in another country.",
        pros: ["Leaves from DCA", "More airlines and departure times", "Sometimes a little cheaper"],
        cons: ["Three to six hours longer each way", "A missed connection can cost a full day in Japan", "Some routings land at Narita, 60 to 90 minutes from Tokyo"],
        hubs: "Research: typical hubs are Chicago O'Hare, Dallas/Fort Worth, New York JFK, Newark, Detroit, Atlanta and Minneapolis. Routings change by season, so confirm on the booking screen."
      },
      {
        id: "f-third-country",
        name: "One stop abroad",
        route: "IAD → Seoul, Taipei, Toronto or Vancouver → Tokyo",
        stops: "One stop outside the US",
        duration: "About 18 to 24 hours each way",
        multiplierLow: 0.85,
        multiplierHigh: 0.95,
        selectable: false,
        verdict: "Ruled out by the brief",
        why: "Often the cheapest fares on the search page. Jon's brief excludes stopovers in another country, so these are listed only to explain why the cheapest price shown online is not the plan.",
        pros: ["Lowest sticker price"],
        cons: ["Excluded by the brief", "Longest travel days"]
      }
    ],
    nonstops: [
      { airline: "ANA", flights: "NH101 out, NH102 back", out: "Leaves Dulles 11:10 am in winter or 12:15 pm in summer; lands Haneda about 3:20–3:40 pm the next day.", back: "Leaves Haneda about 10:40 am; lands Dulles the same morning.", aircraft: "Boeing 787", alliance: "Star Alliance" },
      { airline: "United", flights: "UA803 out", out: "Leaves Dulles between 12:20 and 1:20 pm; lands Haneda about 3:55–4:50 pm the next day.", back: "Leaves Haneda late afternoon; lands Dulles mid-afternoon the same day.", aircraft: "Boeing 777", alliance: "Star Alliance" }
    ],
    airports: [
      { code: "HND", name: "Tokyo Haneda", note: "Research: 20 to 30 minutes to central Tokyo by monorail or Keikyu line. Both Dulles nonstops use Terminal 3. The better airport by a wide margin." },
      { code: "NRT", name: "Tokyo Narita", note: "Research: 60 to 90 minutes to central Tokyo by Narita Express or Skyliner. Only relevant on one-stop routings." },
      { code: "IAD", name: "Washington Dulles", note: "Research: the only Washington airport with Tokyo nonstops. Metro Silver Line station at the terminal." },
      { code: "DCA", name: "Reagan National", note: "Research: domestic and short-haul only. Any Tokyo trip from here connects." }
    ],
    notes: [
      { tag: "Vault", text: "Jon holds Global Entry. Kathleen's trusted-traveler status is not on record." },
      { tag: "Research", text: "Global Entry speeds US immigration on the way home and includes TSA PreCheck. It does nothing in Japan." },
      { tag: "Research", text: "US passport holders enter Japan visa-free for up to 90 days. Registering on Visit Japan Web before the flight gives you QR codes for immigration and customs." },
      { tag: "Vault", text: "No passport scan or expiry date is on record for either of you." },
      { tag: "Research", text: "The return timing shapes the last night. ANA leaves Haneda mid-morning, so sleep in Tokyo. United leaves late afternoon, which allows a morning Shinkansen from Kyoto." },
      { tag: "Estimate", text: "Premium economy usually runs about twice the economy fare on this route, and business class several times it. Check live prices before deciding." },
      { tag: "Vault", text: "Hotel points on record are Marriott. No airline loyalty program is on record." }
    ],
    bookingTips: [
      "Research: KAYAK's trend data puts the cheapest booking window for this route about six months before departure.",
      "Research: Tuesday-to-Thursday departures price lower, but this frame fixes the weekend. Expect to pay the weekend premium.",
      "Research: compare Friday and Saturday departures. The extra night in Japan can cost less than the fare difference.",
      "Research: book both of you on one reservation so a schedule change moves you together."
    ]
  },

  destinations: [
    {
      id: "d-tokyo", name: "Tokyo", region: "Kanto", lat: 35.6812, lng: 139.7671, type: "city", nightsSuggested: "3–5",
      whyGo: "The arrival city and the one place that serves every interest on both lists: cel dealers, specialty coffee, tea rooms, gardens, food and neon.",
      highlights: ["Nakano Broadway and Akihabara for production cels", "Coffee districts: Kiyosumi-Shirakawa, Tomigaya, Nakameguro", "Meiji Jingu forest and Shinjuku Gyoen", "Ginza, including the Mikimoto flagship", "teamLab Borderless and Planets"],
      fitTags: ["anime-cels", "coffee", "tea", "food", "retro-futurism", "dense-sightseeing"], energy: "intense", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Kanto."
    },
    {
      id: "d-yanaka", name: "Yanaka, old Tokyo", region: "Kanto", lat: 35.7275, lng: 139.7668, type: "niche", nightsSuggested: "Half day",
      whyGo: "A low-rise temple neighborhood that survived the war: lanes, small galleries, a shopping street and one of Tokyo's oldest coffee houses.",
      highlights: ["Yanaka Ginza shopping street", "Yanaka Cemetery's cherry avenue", "Kayaba Coffee, a 1938 kissaten", "Nezu Shrine's torii path"],
      fitTags: ["quiet-date", "walks", "coffee", "photography"], energy: "calm", source: "research"
    },
    {
      id: "d-shimokitazawa", name: "Shimokitazawa", region: "Kanto", lat: 35.6613, lng: 139.668, type: "niche", nightsSuggested: "Half day",
      whyGo: "Tokyo's record-shop and vintage quarter, three minutes from Shibuya, with good espresso between the crates.",
      highlights: ["Vinyl at Flash Disc Ranch, Jet Set and Disk Union", "Bear Pond Espresso", "Vintage clothing lanes", "Bonus Track and Reload courtyards"],
      fitTags: ["music", "coffee", "walks"], energy: "mixed", source: "research"
    },
    {
      id: "d-kamakura", name: "Kamakura", region: "Kanto", lat: 35.3192, lng: 139.5467, type: "daytrip", nightsSuggested: "Day trip",
      whyGo: "A seaside temple town an hour from Tokyo, with wooded hiking trails between the shrines.",
      highlights: ["The Great Buddha at Kotoku-in", "Daibutsu hiking trail from Kita-Kamakura", "Hokoku-ji's bamboo grove, with matcha served in it", "Hasedera's hydrangeas in June", "The Enoden tram along the coast"],
      fitTags: ["walks", "tea", "gardens", "quiet-date"], energy: "calm", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Kanto."
    },
    {
      id: "d-nikko", name: "Nikko", region: "Kanto", lat: 36.7199, lng: 139.6982, type: "daytrip", nightsSuggested: "Day trip or 1",
      whyGo: "Lavish shogun shrines in a cedar forest, with a lake and waterfalls above. About two hours from Tokyo.",
      highlights: ["Toshogu Shrine", "Kanmangafuchi Abyss and its row of stone statues", "Kegon Falls and Lake Chuzenji", "Autumn color from mid-October"],
      fitTags: ["walks", "history", "foliage", "nature"], energy: "mixed", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Kanto."
    },
    {
      id: "d-hakone", name: "Hakone", region: "Kanto", lat: 35.2324, lng: 139.1069, type: "region", nightsSuggested: "1–2",
      whyGo: "The classic ryokan-and-onsen break between Tokyo and Kyoto, with art museums and a volcanic valley.",
      highlights: ["A ryokan with a private open-air bath", "Hakone Open-Air Museum", "Ropeway over Owakudani", "Lake Ashi with Fuji behind it on clear days"],
      fitTags: ["onsen", "quiet-date", "art", "views"], energy: "calm", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Kanto."
    },
    {
      id: "d-kawaguchiko", name: "Kawaguchiko and the Fuji lakes", region: "Chubu", lat: 35.5171, lng: 138.7519, type: "region", nightsSuggested: "1",
      whyGo: "The closest full view of Mount Fuji, across a lake, with onsen hotels facing it.",
      highlights: ["Chureito Pagoda viewpoint", "Oishi Park on the north shore", "Itchiku Kubota Art Museum", "Onsen baths that face the mountain"],
      fitTags: ["views", "onsen", "photography", "walks"], energy: "calm", source: "research"
    },
    {
      id: "d-matsumoto", name: "Matsumoto", region: "Chubu", lat: 36.2381, lng: 137.969, type: "city", nightsSuggested: "Day trip or 1",
      whyGo: "An original black castle keep against the Alps, in a small city with good coffee and craft shops.",
      highlights: ["Matsumoto Castle, a National Treasure", "Nakamachi's storehouse street", "Matsumoto City Museum of Art (Yayoi Kusama's home town)", "Gateway to Kamikochi in summer and autumn"],
      fitTags: ["history", "walks", "coffee", "art"], energy: "calm", source: "research"
    },
    {
      id: "d-kiso", name: "Kiso Valley: Magome and Tsumago", region: "Chubu", lat: 35.5773, lng: 137.5953, type: "niche", nightsSuggested: "Day trip or 1",
      whyGo: "Two preserved post towns on the old Nakasendo highway, linked by a five-mile forest path.",
      highlights: ["The Magome to Tsumago walk, about three hours", "A free tea stop at an old rest house on the trail", "Car-free Edo-period streets", "Family-run inns with dinner by the hearth"],
      fitTags: ["walks", "history", "quiet-date", "tea"], energy: "calm", source: "research"
    },
    {
      id: "d-takayama", name: "Takayama and Shirakawa-go", region: "Chubu", lat: 36.1461, lng: 137.2522, type: "city", nightsSuggested: "2",
      whyGo: "A merchant town of dark timber streets in the Alps, plus the thatched farmhouse village an hour away.",
      highlights: ["Sanmachi Suji old town", "Morning markets on the river", "Hida beef and sake breweries", "Shirakawa-go's thatched houses and the Shiroyama viewpoint"],
      fitTags: ["history", "food", "walks", "photography"], energy: "calm", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Chubu."
    },
    {
      id: "d-kanazawa", name: "Kanazawa", region: "Chubu", lat: 36.5613, lng: 136.6562, type: "city", nightsSuggested: "1–2",
      whyGo: "A castle town that kept its gardens, teahouse districts and craft traditions. Often described as Kyoto without the crowds.",
      highlights: ["Kenroku-en garden and its teahouse", "Higashi Chaya teahouse district", "D.T. Suzuki Museum's water garden", "21st Century Museum of Contemporary Art", "Omicho market seafood"],
      fitTags: ["tea", "gardens", "quiet-date", "art", "food"], energy: "calm", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Chubu."
    },
    {
      id: "d-kyoto", name: "Kyoto", region: "Kansai", lat: 35.0116, lng: 135.7681, type: "city", nightsSuggested: "3–4",
      whyGo: "The old capital: temples, gardens, tea, kaiseki and wooden lanes. The strongest single match for Kathleen's tea and garden interests.",
      highlights: ["Fushimi Inari at dawn", "Arashiyama's bamboo grove and villa gardens", "Tea at Ippodo and a tea ceremony", "Zen gardens at Daitoku-ji", "Kaiseki dinner in Gion or Pontocho"],
      fitTags: ["tea", "gardens", "walks", "quiet-date", "food", "coffee"], energy: "mixed", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Kansai."
    },
    {
      id: "d-uji", name: "Uji", region: "Kansai", lat: 34.8843, lng: 135.7997, type: "daytrip", nightsSuggested: "Half day",
      whyGo: "Japan's most famous tea town, 20 to 30 minutes from Kyoto, built around a riverside temple.",
      highlights: ["Byodo-in's Phoenix Hall", "Tea houses on Byodo-in Omotesando", "Nakamura Tokichi's matcha desserts", "An inexpensive tea ceremony at the municipal tea house, Taihoan"],
      fitTags: ["tea", "gardens", "quiet-date", "walks"], energy: "calm", source: "research"
    },
    {
      id: "d-nara", name: "Nara", region: "Kansai", lat: 34.6851, lng: 135.8048, type: "daytrip", nightsSuggested: "Day trip",
      whyGo: "Japan's first capital, a park of free-roaming deer, and a bronze Buddha in the largest wooden hall you will ever stand in.",
      highlights: ["Todai-ji's Great Buddha", "Kasuga Taisha's lantern paths", "Isuien garden", "Naramachi's merchant lanes"],
      fitTags: ["walks", "history", "gardens", "disney-classics"], energy: "calm", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Kansai. Research: the deer are a light nod to Kathleen's Bambi."
    },
    {
      id: "d-osaka", name: "Osaka", region: "Kansai", lat: 34.6937, lng: 135.5023, type: "city", nightsSuggested: "1–2",
      whyGo: "Japan's street-food capital: louder, looser and cheaper than Tokyo, 15 minutes from Kyoto by Shinkansen.",
      highlights: ["Dotonbori at night", "Kushikatsu in Shinsekai", "Mandarake Grand Chaos and Den Den Town", "Nakazakicho's cafes", "Umeda Sky Building at dusk"],
      fitTags: ["food", "anime-cels", "retro-futurism", "coffee"], energy: "intense", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Kansai."
    },
    {
      id: "d-himeji", name: "Himeji", region: "Kansai", lat: 34.8394, lng: 134.6939, type: "daytrip", nightsSuggested: "Half day",
      whyGo: "The finest surviving castle in Japan, white and intact, an easy stop on the Shinkansen between Kyoto and Hiroshima.",
      highlights: ["Himeji Castle's main keep", "Koko-en gardens next door, with a tea house", "A straight walk from the station"],
      fitTags: ["history", "gardens", "tea", "rail"], energy: "calm", source: "research"
    },
    {
      id: "d-koyasan", name: "Koyasan", region: "Kansai", lat: 34.213, lng: 135.585, type: "niche", nightsSuggested: "1",
      whyGo: "A mountaintop monastery town where you sleep in a temple, eat monks' cuisine and walk a cedar cemetery by lantern light.",
      highlights: ["Temple lodging with morning prayers", "Okunoin cemetery at night", "Vegetarian shojin ryori dinner", "Danjo Garan's vermilion pagoda"],
      fitTags: ["quiet-date", "walks", "history"], energy: "calm", source: "research"
    },
    {
      id: "d-ine", name: "Ine and Amanohashidate", region: "Kansai", lat: 35.6742, lng: 135.288, type: "niche", nightsSuggested: "1",
      whyGo: "A fishing village of boathouses built straight over the water on the Sea of Japan, near a pine-covered sandbar.",
      highlights: ["About 230 funaya boathouses around the bay", "A short bay cruise", "Amanohashidate sandbar by bike or on foot", "Seafood dinner in a converted boathouse"],
      fitTags: ["quiet-date", "photography", "food", "views"], energy: "calm", source: "research"
    },
    {
      id: "d-ise-toba", name: "Toba and Ise", region: "Kansai", lat: 34.4836, lng: 136.8446, type: "niche", nightsSuggested: "Day trip or 1",
      whyGo: "Mikimoto Pearl Island, where cultured pearls began, paired with Japan's most sacred shrine.",
      highlights: ["Mikimoto Pearl Island museum and diver demonstrations", "Ise Jingu's inner shrine", "Okage Yokocho's old-style street"],
      fitTags: ["pearls", "history", "walks", "quiet-date"], energy: "calm", source: "vault",
      vaultNote: "Vault: a May 2026 anniversary chat floated buying pearls in Japan and named Pearl Island near Toba. Not on the March brainstorm list."
    },
    {
      id: "d-hiroshima", name: "Hiroshima", region: "Hiroshima & Setouchi", lat: 34.3853, lng: 132.4553, type: "city", nightsSuggested: "1–2",
      whyGo: "A rebuilt, easygoing city with the most affecting museum in Japan and its own style of okonomiyaki.",
      highlights: ["Peace Memorial Park and Museum", "The A-Bomb Dome", "Layered okonomiyaki at Okonomimura", "Shukkeien garden"],
      fitTags: ["history", "food", "gardens"], energy: "mixed", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list as 'Hiroshima and Miyajima'."
    },
    {
      id: "d-miyajima", name: "Miyajima", region: "Hiroshima & Setouchi", lat: 34.296, lng: 132.3198, type: "daytrip", nightsSuggested: "Day trip or 1",
      whyGo: "The floating torii gate, a forested mountain and tame deer. Staying overnight gives you the island after the day-trippers leave.",
      highlights: ["Itsukushima Shrine and its torii at high tide", "Mount Misen by ropeway or trail", "Grilled oysters and maple-leaf cakes", "Daisho-in temple"],
      fitTags: ["quiet-date", "walks", "views", "photography"], energy: "calm", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list as 'Hiroshima and Miyajima'."
    },
    {
      id: "d-naoshima", name: "Naoshima art islands", region: "Hiroshima & Setouchi", lat: 34.46, lng: 133.995, type: "niche", nightsSuggested: "1",
      whyGo: "A small island turned into a contemporary art site: concrete museums set into hillsides and artworks inside village houses.",
      highlights: ["Chichu Art Museum (timed tickets)", "Benesse House Museum", "Art House Project in Honmura", "Kusama's pumpkins on the shore", "Teshima Art Museum on the next island"],
      fitTags: ["art", "quiet-date", "retro-futurism", "walks"], energy: "calm", source: "research"
    },
    {
      id: "d-kurashiki", name: "Kurashiki", region: "Hiroshima & Setouchi", lat: 34.596, lng: 133.772, type: "daytrip", nightsSuggested: "Half day or 1",
      whyGo: "A willow-lined canal quarter of white storehouses, with Japan's first museum of Western art.",
      highlights: ["Bikan historical quarter", "Ohara Museum of Art", "Canal boats", "Denim from nearby Kojima"],
      fitTags: ["quiet-date", "walks", "art", "coffee"], energy: "calm", source: "research"
    },
    {
      id: "d-onomichi", name: "Onomichi and the Shimanami Kaido", region: "Hiroshima & Setouchi", lat: 34.409, lng: 133.205, type: "niche", nightsSuggested: "Day trip or 1",
      whyGo: "A hillside port town of temple lanes and cats, and the start of a cycling route that crosses the Inland Sea by bridge.",
      highlights: ["Temple walk and ropeway viewpoint", "E-bike across the first bridges", "Onomichi U2 warehouse hotel and cafe", "Onomichi ramen"],
      fitTags: ["walks", "views", "nature", "coffee"], energy: "mixed", source: "research"
    },
    {
      id: "d-iino", name: "Iino, the UFO town", region: "Tohoku", lat: 37.659, lng: 140.546, type: "niche", nightsSuggested: "Day trip",
      whyGo: "The town Jon asked for. Iino, now part of Fukushima City, built a UFO hall beside a pyramid-shaped hill with decades of sighting lore.",
      highlights: ["UFO Fureaikan (UFO Interactive Hall): exhibits and a 3D theater", "A panoramic bath inside the hall", "The trail up Mount Senganmori", "Alien statues along the approach road"],
      fitTags: ["ufo", "quirky", "retro-futurism", "walks", "onsen"], energy: "calm", source: "vault",
      vaultNote: "Vault: Jon asked for 'Lena, Japan' in March 2026; the brainstorm identified it as Iino, with the UFO Interactive Hall and Mount Senganmori. Map position is approximate."
    },
    {
      id: "d-tohoku", name: "Tohoku: Sendai, Matsushima, Yamadera", region: "Tohoku", lat: 38.2682, lng: 140.8694, type: "region", nightsSuggested: "2–3",
      whyGo: "The quiet north: pine islands, a cliff temple, hot-spring towns and far fewer visitors than the Tokyo to Kyoto corridor.",
      highlights: ["Matsushima Bay's pine islands", "Yamadera's thousand steps", "Ginzan Onsen's gaslit street", "Sendai's grilled beef tongue", "Autumn color from mid-October"],
      fitTags: ["onsen", "walks", "quiet-date", "foliage"], energy: "calm", source: "vault",
      vaultNote: "Vault: Tohoku is one of the eight regions on the March 2026 brainstorm list."
    },
    {
      id: "d-fukuoka", name: "Fukuoka", region: "Kyushu", lat: 33.5902, lng: 130.4017, type: "city", nightsSuggested: "1–2",
      whyGo: "A compact, friendly food city known for open-air stalls and pork-bone ramen.",
      highlights: ["Yatai food stalls by the river", "Hakata ramen", "Dazaifu Tenmangu shrine", "Ohori Park"],
      fitTags: ["food", "walks", "coffee"], energy: "mixed", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Kyushu."
    },
    {
      id: "d-beppu", name: "Beppu and Yufuin", region: "Kyushu", lat: 33.2846, lng: 131.4914, type: "region", nightsSuggested: "1–2",
      whyGo: "Japan's most active hot-spring town, steaming from every street, next to a prettier resort village.",
      highlights: ["The boiling 'hells' of Kannawa", "Sand baths", "Steam-cooked lunch", "Yufuin's lake and craft street"],
      fitTags: ["onsen", "quirky", "quiet-date"], energy: "calm", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list under Kyushu."
    },
    {
      id: "d-nagasaki", name: "Nagasaki", region: "Kyushu", lat: 32.7503, lng: 129.8777, type: "city", nightsSuggested: "1–2",
      whyGo: "A harbor city shaped by centuries as Japan's only window to the West, with a second peace museum and a famous night view.",
      highlights: ["Dejima, the old Dutch trading post", "Glover Garden", "Peace Park and Atomic Bomb Museum", "Night view from Mount Inasa"],
      fitTags: ["history", "views", "walks"], energy: "mixed", source: "research"
    },
    {
      id: "d-hokkaido", name: "Hokkaido: Sapporo and Niseko", region: "Hokkaido", lat: 43.0618, lng: 141.3545, type: "region", nightsSuggested: "4+",
      whyGo: "Open country, seafood and powder snow. It needs a domestic flight and most of a trip to itself.",
      highlights: ["Sapporo ramen, beer and the February Snow Festival", "Otaru canal", "Niseko powder from December to March", "Nikka's Yoichi distillery", "Lavender fields in July"],
      fitTags: ["nature", "food", "whisky"], energy: "mixed", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list. Research: hard to combine with Tokyo and Kyoto in nine days."
    },
    {
      id: "d-okinawa", name: "Okinawa", region: "Okinawa", lat: 26.2124, lng: 127.6809, type: "region", nightsSuggested: "4+",
      whyGo: "Subtropical beaches and a distinct island culture, three hours' flight from Tokyo.",
      highlights: ["Kerama Islands snorkeling", "Churaumi Aquarium", "Shuri Castle, under reconstruction after the 2019 fire", "Okinawan food and pottery"],
      fitTags: ["nature", "food"], energy: "calm", source: "vault",
      vaultNote: "Vault: on the March 2026 brainstorm list. Research: a beach holiday rather than a match for the interests on record."
    }
  ],

  activities: [
    {
      id: "a-nakano-broadway", name: "Cel hunting at Nakano Broadway", area: "Nakano, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.7093, lng: 139.6658,
      category: "anime", durationHours: 3, costBand: "Free",
      why: "Mandarake's home base: a 1960s mall with dozens of specialist counters, including production cels and animation art. Shops open around noon.",
      fitTags: ["anime-cels", "retro-futurism"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: Jon collects production cels from The Big O and Outlaw Star and already buys through Mandarake. His rule is production cels only. SWAT Kats cels trade almost only in the West, so do not expect them here."
    },
    {
      id: "a-akihabara", name: "Akihabara: Mandarake Complex and retro games", area: "Akihabara, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.7022, lng: 139.7745,
      category: "anime", durationHours: 2.5, costBand: "Free",
      why: "Eight floors of Mandarake plus retro game shops and arcades. A smaller cel selection than Nakano, but an easy pairing with Ueno or Yanaka.",
      fitTags: ["anime-cels", "retro-futurism"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: Mandarake is one of Jon's regular cel sources."
    },
    {
      id: "a-osaka-mandarake", name: "Osaka: Mandarake Grand Chaos and Den Den Town", area: "Shinsaibashi, Osaka", region: "Kansai", destId: "d-osaka", lat: 34.672, lng: 135.4985,
      category: "anime", durationHours: 2, costBand: "Free",
      why: "A second shot at cels with different stock, in the middle of Osaka's vintage-clothing district. Den Den Town, Osaka's Akihabara, is a short walk south.",
      fitTags: ["anime-cels"], forWhom: "jon", source: "research"
    },
    {
      id: "a-ghibli-museum", name: "Ghibli Museum, Mitaka", area: "Mitaka, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6962, lng: 139.5704,
      category: "anime", durationHours: 3, costBand: "$",
      why: "A small, hand-built museum of how animation is made, with original drawings and a short film shown nowhere else. Tickets (¥1,000) go on sale on the 10th of each month at 10:00 Japan time for the following month and sell out fast.",
      fitTags: ["anime-cels", "disney-classics", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-ghibli-park", name: "Ghibli Park, near Nagoya (stretch)", area: "Nagakute, Aichi", region: "Chubu", destId: null, lat: 35.173, lng: 137.09,
      category: "anime", durationHours: 6, costBand: "$$",
      why: "Five themed areas in a public park, about an hour from Nagoya Station. Passes cost ¥3,300 to ¥7,800 and go on sale two months ahead on the 10th. It takes a full day off the Tokyo to Kyoto run.",
      fitTags: ["disney-classics", "walks"], forWhom: "both", source: "research"
    },
    {
      id: "a-disneysea", name: "Tokyo DisneySea or Disneyland (optional)", area: "Urayasu, near Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6267, lng: 139.8851,
      category: "quirky", durationHours: 10, costBand: "$$$",
      why: "DisneySea is the park found nowhere else. Cinderella Castle and its walk-through are at Tokyo Disneyland next door. Either one takes a full day.",
      fitTags: ["disney-classics"], forWhom: "kathleen", source: "vault", unverified: true,
      vaultNote: "Vault: Kathleen's favorite animated films are Bambi, The Lion King and Cinderella. Open: whether she wants a park day in Japan has not been asked."
    },
    {
      id: "a-coffee-crawl", name: "Specialty coffee crawl, Kiyosumi-Shirakawa", area: "Kiyosumi-Shirakawa, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.681, lng: 139.8005,
      category: "food", durationHours: 3, costBand: "$",
      why: "Tokyo's roastery district: Blue Bottle's first Japan roastery, Allpress, Arise and the reservation-only coffee courses at Koffee Mameya Kakeru. Kiyosumi Garden is around the corner for Kathleen.",
      fitTags: ["coffee", "gardens", "walks"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: Jon prefers specialty coffee."
    },
    {
      id: "a-coffee-west", name: "West-side coffee: Koffee Mameya, Fuglen, Onibus", area: "Omotesando to Nakameguro, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6668, lng: 139.7075,
      category: "food", durationHours: 2.5, costBand: "$",
      why: "A walkable line of Tokyo's best-known counters, from the bean specialists at Koffee Mameya to Fuglen in Tomigaya and Onibus beside the Meguro River.",
      fitTags: ["coffee", "walks"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: Jon prefers specialty coffee."
    },
    {
      id: "a-kissaten", name: "A kissaten morning", area: "Shibuya or Yanaka, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6591, lng: 139.7046,
      category: "food", durationHours: 1.5, costBand: "$",
      why: "Old-school coffee houses with hand-drip coffee, thick toast and bone china: Chatei Hatou in Shibuya or Kayaba Coffee in Yanaka. Most also pour black tea.",
      fitTags: ["coffee", "tea", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-tokyo-tea", name: "Tea tasting counter in Tokyo", area: "Aoyama or Ginza, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6635, lng: 139.712,
      category: "food", durationHours: 1.5, costBand: "$$",
      why: "A seated tasting of Japanese teas with sweets at Sakurai Japanese Tea Experience in Aoyama or Higashiya in Ginza. Book ahead.",
      fitTags: ["tea", "quiet-date"], forWhom: "kathleen", source: "vault",
      vaultNote: "Vault: Kathleen likes tea."
    },
    {
      id: "a-hamarikyu", name: "Hamarikyu garden and its pond teahouse", area: "Shiodome, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6597, lng: 139.7636,
      category: "nature", durationHours: 1.5, costBand: "$",
      why: "A tidal garden ringed by towers, with matcha and a sweet served in a teahouse on the pond.",
      fitTags: ["tea", "gardens", "quiet-date"], forWhom: "kathleen", source: "vault",
      vaultNote: "Vault: Kathleen likes tea and is learning to garden."
    },
    {
      id: "a-shinjuku-gyoen", name: "Shinjuku Gyoen", area: "Shinjuku, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6852, lng: 139.71,
      category: "nature", durationHours: 2, costBand: "$",
      why: "Tokyo's best large garden: Japanese, French and English sections and a greenhouse. Closed Mondays.",
      fitTags: ["gardens", "walks", "quiet-date"], forWhom: "kathleen", source: "vault",
      vaultNote: "Vault: Kathleen is learning to garden."
    },
    {
      id: "a-meiji-jingu", name: "Meiji Jingu forest walk", area: "Harajuku, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6764, lng: 139.6993,
      category: "walk", durationHours: 1.5, costBand: "Free",
      why: "A gravel path through a planted forest to Tokyo's main shrine. Go at opening, straight off the jet lag.",
      fitTags: ["walks", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-nezu-museum", name: "Nezu Museum and garden", area: "Aoyama, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6622, lng: 139.717,
      category: "culture", durationHours: 2, costBand: "$",
      why: "A small museum of Asian art with a hillside garden of teahouses and a glass cafe. Timed tickets; closed Mondays.",
      fitTags: ["gardens", "art", "quiet-date", "tea"], forWhom: "both", source: "research"
    },
    {
      id: "a-yanaka-walk", name: "Yanaka lanes walk", area: "Yanaka, Tokyo", region: "Kanto", destId: "d-yanaka", lat: 35.7278, lng: 139.765,
      category: "walk", durationHours: 2.5, costBand: "Free",
      why: "Temple lanes, the cemetery avenue, the shopping street and Nezu Shrine, with coffee at Kayaba.",
      fitTags: ["walks", "quiet-date", "coffee", "photography"], forWhom: "both", source: "research"
    },
    {
      id: "a-shimokita-vinyl", name: "Record digging in Shimokitazawa", area: "Shimokitazawa, Tokyo", region: "Kanto", destId: "d-shimokitazawa", lat: 35.6617, lng: 139.6675,
      category: "quirky", durationHours: 2.5, costBand: "Free",
      why: "Used vinyl at Flash Disc Ranch, Jet Set and Disk Union, with espresso stops. Disk Union's Shinjuku shops go deeper on metal.",
      fitTags: ["music", "coffee"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: Jon's music runs to TOOL, Gunship and Carpenter Brut."
    },
    {
      id: "a-jimbocho", name: "Jimbocho book town", area: "Jimbocho, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6959, lng: 139.7577,
      category: "walk", durationHours: 2, costBand: "Free",
      why: "Over a hundred used-book shops, a few with English shelves, and Glitch Coffee on a side street.",
      fitTags: ["books", "coffee", "walks"], forWhom: "both", source: "vault",
      vaultNote: "Vault: Kathleen is a Stephen King superfan. Research: the book-town match is an inference."
    },
    {
      id: "a-odaiba-retro-future", name: "Odaiba retro-future loop", area: "Odaiba, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6248, lng: 139.7754,
      category: "quirky", durationHours: 3, costBand: "$",
      why: "The driverless Yurikamome train, the life-size Unicorn Gundam, the Miraikan science museum and Kenzo Tange's Fuji TV building.",
      fitTags: ["retro-futurism", "photography"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: Jon is interested in retro-futurism."
    },
    {
      id: "a-science-museum", name: "National Museum of Nature and Science, Ueno", area: "Ueno, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.7164, lng: 139.7764,
      category: "culture", durationHours: 2, costBand: "$",
      why: "Japan's national science museum, with a meteorite display among its earth-science galleries. Pairs with Yanaka or Akihabara.",
      fitTags: ["meteorites", "retro-futurism"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: Jon collects meteorites."
    },
    {
      id: "a-teamlab-borderless", name: "teamLab Borderless", area: "Azabudai Hills, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6605, lng: 139.7405,
      category: "culture", durationHours: 2.5, costBand: "$$",
      why: "A museum without a map: projected artworks drift between dark rooms and react to you. Permanent since 2024. Timed tickets from about ¥3,600, on sale two months ahead.",
      fitTags: ["art", "retro-futurism", "photography"], forWhom: "both", source: "research"
    },
    {
      id: "a-teamlab-planets", name: "teamLab Planets", area: "Toyosu, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6491, lng: 139.7897,
      category: "culture", durationHours: 2, costBand: "$$",
      why: "The barefoot one: you wade through water and walk through hanging flowers. Advertised to run until the end of 2027. Tickets from about ¥3,800, online only.",
      fitTags: ["art", "photography"], forWhom: "both", source: "research"
    },
    {
      id: "a-mikimoto-ginza", name: "Mikimoto flagship, Ginza", area: "Ginza, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6717, lng: 139.765,
      category: "romantic", durationHours: 1, costBand: "$$$$",
      why: "The founding house of cultured pearls. Choosing a piece together turns the gift into part of the trip.",
      fitTags: ["pearls", "quiet-date"], forWhom: "both", source: "vault",
      vaultNote: "Vault: a May 2026 anniversary chat proposed pearls bought in Japan, naming Mikimoto's Ginza flagship. Open: whether that plan still stands."
    },
    {
      id: "a-shibuya-sky", name: "Sunset from Shibuya Sky", area: "Shibuya, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6585, lng: 139.7022,
      category: "romantic", durationHours: 1.5, costBand: "$$",
      why: "An open rooftop 750 feet above the crossing. Sunset slots sell out weeks ahead.",
      fitTags: ["views", "photography", "retro-futurism"], forWhom: "both", source: "research"
    },
    {
      id: "a-neon-photo-walk", name: "Blue-hour photo walk, Shinjuku", area: "Shinjuku, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6938, lng: 139.7005,
      category: "walk", durationHours: 2, costBand: "Free",
      why: "Omoide Yokocho's lantern alley, Kabukicho's signs and Golden Gai's tiny bars, timed for dusk. The closest thing in real life to a synthwave album cover.",
      fitTags: ["photography", "retro-futurism", "music"], forWhom: "both", source: "research"
    },
    {
      id: "a-izakaya", name: "Izakaya night under the tracks", area: "Yurakucho, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.673, lng: 139.763,
      category: "food", durationHours: 2.5, costBand: "$$",
      why: "Grilled skewers and draft beer in the brick arches beneath the railway. Loud and friendly; pick a smaller side-street place for a quieter table.",
      fitTags: ["food"], forWhom: "both", source: "research"
    },
    {
      id: "a-tsukiji", name: "Tsukiji outer market breakfast", area: "Tsukiji, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6655, lng: 139.7707,
      category: "food", durationHours: 2, costBand: "$$",
      why: "Sushi, grilled seafood and rolled omelette from stalls that open early. A good use of a jet-lagged first morning.",
      fitTags: ["food", "walks"], forWhom: "both", source: "research"
    },
    {
      id: "a-cigar-bar", name: "Cigar bar nightcap, Ginza", area: "Ginza, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6712, lng: 139.7655,
      category: "relax", durationHours: 1.5, costBand: "$$",
      why: "Ginza has several dedicated cigar bars, which are exempt from the indoor smoking ban that covers most restaurants. Japanese whisky is the usual pairing.",
      fitTags: ["cigars", "whisky"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: Jon smokes cigars; the Iceland itinerary included a cigar shop."
    },
    {
      id: "a-kamakura-hike", name: "Kamakura temple hike", area: "Kamakura", region: "Kanto", destId: "d-kamakura", lat: 35.3167, lng: 139.5357,
      category: "walk", durationHours: 5, costBand: "$",
      why: "The wooded Daibutsu trail from Kita-Kamakura to the Great Buddha, then Hasedera and the coast tram. Add matcha in the bamboo at Hokoku-ji.",
      fitTags: ["walks", "tea", "gardens"], forWhom: "both", source: "research"
    },
    {
      id: "a-nikko-toshogu", name: "Nikko: Toshogu and the Kanmangafuchi walk", area: "Nikko", region: "Kanto", destId: "d-nikko", lat: 36.7581, lng: 139.5989,
      category: "culture", durationHours: 6, costBand: "$",
      why: "The shogun's gilded shrine, then a quiet riverside path past a row of mossy stone statues.",
      fitTags: ["history", "walks", "foliage"], forWhom: "both", source: "research"
    },
    {
      id: "a-hakone-onsen", name: "Private onsen in Hakone", area: "Hakone", region: "Kanto", destId: "d-hakone", lat: 35.233, lng: 139.103,
      category: "relax", durationHours: 3, costBand: "$$",
      why: "Public baths are separated by gender, so book a private bath or a ryokan room with its own open-air tub to soak together. Day-use private rooms exist near Hakone-Yumoto.",
      fitTags: ["onsen", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-hakone-open-air", name: "Hakone Open-Air Museum", area: "Hakone", region: "Kanto", destId: "d-hakone", lat: 35.2447, lng: 139.0513,
      category: "culture", durationHours: 2.5, costBand: "$",
      why: "Sculpture on a mountainside lawn, a Picasso pavilion and a hot-spring foot bath.",
      fitTags: ["art", "walks", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-hakone-loop", name: "Hakone ropeway and Lake Ashi", area: "Hakone", region: "Kanto", destId: "d-hakone", lat: 35.2443, lng: 139.0197,
      category: "nature", durationHours: 4, costBand: "$$",
      why: "Switchback train, cable car, ropeway over the sulfur vents of Owakudani and a boat across the lake. Fuji shows on clear days.",
      fitTags: ["views", "nature", "rail"], forWhom: "both", source: "research"
    },
    {
      id: "a-chureito", name: "Chureito Pagoda and Lake Kawaguchi", area: "Fujiyoshida", region: "Chubu", destId: "d-kawaguchiko", lat: 35.5012, lng: 138.8014,
      category: "nature", durationHours: 4, costBand: "$",
      why: "The pagoda-and-Fuji view after 398 steps, then the lake's north shore. Go early; cloud builds by midday.",
      fitTags: ["views", "photography", "walks"], forWhom: "both", source: "research"
    },
    {
      id: "a-shinkansen", name: "The Shinkansen, done properly", area: "Tokyo to Kyoto", region: "Chubu", destId: null, lat: 35.142, lng: 138.663,
      category: "culture", durationHours: 2.25, costBand: "$$$",
      why: "Nozomi from Tokyo to Kyoto in about 2 hours 15 minutes, roughly ¥14,000 each way per person. Buy a station bento, and reserve seats on the right side heading west for Mount Fuji about 45 minutes in.",
      fitTags: ["rail", "retro-futurism", "views"], forWhom: "both", source: "research"
    },
    {
      id: "a-nakasendo", name: "Walk the Nakasendo: Magome to Tsumago", area: "Kiso Valley", region: "Chubu", destId: "d-kiso", lat: 35.5265, lng: 137.568,
      category: "walk", durationHours: 3, costBand: "Free",
      why: "Five miles of forest path and farm hamlets between two Edo post towns. The tourist offices forward bags between the towns for a small fee.",
      fitTags: ["walks", "history", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-matsumoto-castle", name: "Matsumoto Castle", area: "Matsumoto", region: "Chubu", destId: "d-matsumoto", lat: 36.2387, lng: 137.9689,
      category: "culture", durationHours: 2, costBand: "$",
      why: "Climb the steep original stairs of a 400-year-old keep, then walk the moat with the Alps behind it.",
      fitTags: ["history", "photography"], forWhom: "both", source: "research"
    },
    {
      id: "a-takayama-morning", name: "Takayama morning markets and sake", area: "Takayama", region: "Chubu", destId: "d-takayama", lat: 36.142, lng: 137.259,
      category: "food", durationHours: 3, costBand: "$$",
      why: "Riverside stalls at breakfast, cedar-ball sake breweries in the old town, and Hida beef for lunch.",
      fitTags: ["food", "walks", "history"], forWhom: "both", source: "research"
    },
    {
      id: "a-shirakawago", name: "Shirakawa-go farmhouses", area: "Shirakawa-go", region: "Chubu", destId: "d-takayama", lat: 36.2578, lng: 136.906,
      category: "culture", durationHours: 3, costBand: "$",
      why: "A valley of steep thatched houses, seen best from the Shiroyama viewpoint. Fifty minutes by bus from Takayama.",
      fitTags: ["history", "photography", "walks"], forWhom: "both", source: "research"
    },
    {
      id: "a-kenrokuen", name: "Kenroku-en and matcha at its teahouse", area: "Kanazawa", region: "Chubu", destId: "d-kanazawa", lat: 36.5621, lng: 136.6627,
      category: "nature", durationHours: 2.5, costBand: "$",
      why: "One of Japan's three great gardens, with tea and a sweet served at Shigure-tei inside it.",
      fitTags: ["gardens", "tea", "quiet-date"], forWhom: "kathleen", source: "vault",
      vaultNote: "Vault: Kathleen likes tea and is learning to garden."
    },
    {
      id: "a-higashi-chaya", name: "Higashi Chaya teahouse district", area: "Kanazawa", region: "Chubu", destId: "d-kanazawa", lat: 36.5724, lng: 136.6665,
      category: "culture", durationHours: 2, costBand: "$",
      why: "Latticed geisha houses, one preserved as a museum, with gold-leaf workshops and tea rooms between them.",
      fitTags: ["tea", "history", "quiet-date", "photography"], forWhom: "both", source: "research"
    },
    {
      id: "a-fushimi-inari", name: "Fushimi Inari at dawn", area: "Kyoto", region: "Kansai", destId: "d-kyoto", lat: 34.9671, lng: 135.7727,
      category: "walk", durationHours: 2.5, costBand: "Free",
      why: "Thousands of vermilion gates up a wooded hill. Open all night and free; before 7 am you have long stretches to yourselves.",
      fitTags: ["walks", "photography", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-arashiyama", name: "Arashiyama early morning", area: "Arashiyama, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.017, lng: 135.6713,
      category: "walk", durationHours: 4, costBand: "$",
      why: "The bamboo grove before the tour groups, Tenryu-ji's pond garden, and Okochi Sanso villa, where the ticket includes matcha.",
      fitTags: ["walks", "gardens", "tea", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-tea-ceremony", name: "Tea ceremony in a Kyoto townhouse", area: "Higashiyama, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0, lng: 135.78,
      category: "culture", durationHours: 1.5, costBand: "$$",
      why: "A small-group or private ceremony led in English, where you also whisk your own bowl. Camellia and Tea Ceremony En are two long-running hosts.",
      fitTags: ["tea", "quiet-date"], forWhom: "kathleen", source: "vault",
      vaultNote: "Vault: Kathleen likes tea."
    },
    {
      id: "a-ippodo", name: "Ippodo Tea, Kyoto main store", area: "Teramachi, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0146, lng: 135.7672,
      category: "food", durationHours: 1, costBand: "$",
      why: "A tea merchant since 1717. Brew your own gyokuro or matcha in the tearoom, then buy tins to take home.",
      fitTags: ["tea", "buy-it-for-life"], forWhom: "kathleen", source: "vault",
      vaultNote: "Vault: Kathleen likes tea."
    },
    {
      id: "a-uji-matcha", name: "Uji matcha half-day", area: "Uji", region: "Kansai", destId: "d-uji", lat: 34.8893, lng: 135.8077,
      category: "food", durationHours: 4, costBand: "$",
      why: "Byodo-in's Phoenix Hall, then tea shops along the approach and matcha desserts at Nakamura Tokichi. The municipal tea house offers a short ceremony for a few hundred yen.",
      fitTags: ["tea", "gardens", "walks"], forWhom: "kathleen", source: "vault",
      vaultNote: "Vault: Kathleen likes tea."
    },
    {
      id: "a-kyoto-coffee", name: "Kyoto coffee: Weekenders, Kurasu, % Arabica", area: "Central Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0048, lng: 135.765,
      category: "food", durationHours: 2, costBand: "$",
      why: "A tiny roastery at the back of a car park, a pour-over bar near the station, and the Higashiyama home shop of the roaster Jon already knows from New York.",
      fitTags: ["coffee", "walks"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: % Arabica was the pick for Jon near 30 Rock in April 2026."
    },
    {
      id: "a-kaiseki", name: "Kaiseki dinner", area: "Gion, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0037, lng: 135.7751,
      category: "romantic", durationHours: 2.5, costBand: "$$$$",
      why: "Kyoto's seasonal multi-course dinner, served slowly in a private room or at a counter. Roughly ¥15,000 to ¥40,000 a person; lunch costs far less. Book through the hotel.",
      fitTags: ["food", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-gion-evening", name: "Gion and Pontocho evening stroll", area: "Gion, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0056, lng: 135.7748,
      category: "romantic", durationHours: 1.5, costBand: "Free",
      why: "The Shirakawa canal, lantern-lit Pontocho alley and the river bank after dark. Photography is banned in Gion's private lanes.",
      fitTags: ["quiet-date", "walks"], forWhom: "both", source: "research"
    },
    {
      id: "a-philosophers-path", name: "Philosopher's Path to Nanzen-ji", area: "Higashiyama, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0268, lng: 135.7954,
      category: "walk", durationHours: 3, costBand: "$",
      why: "A canal path from the Silver Pavilion to Nanzen-ji's brick aqueduct, with small temples and cafes on the way.",
      fitTags: ["walks", "gardens", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-daitokuji", name: "Zen gardens at Daitoku-ji", area: "North Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0439, lng: 135.7461,
      category: "relax", durationHours: 2, costBand: "$",
      why: "A walled compound of small sub-temples with raked-gravel and moss gardens. Rarely crowded, even in peak weeks.",
      fitTags: ["gardens", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-murin-an", name: "Garden study at Murin-an", area: "Okazaki, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0113, lng: 135.7873,
      category: "nature", durationHours: 1, costBand: "$",
      why: "A compact Meiji-era stroll garden that borrows the eastern hills as its backdrop, with tea in the house. A lesson in how to compose a small garden.",
      fitTags: ["gardens", "tea", "quiet-date"], forWhom: "kathleen", source: "vault",
      vaultNote: "Vault: Kathleen is learning to garden."
    },
    {
      id: "a-nishiki", name: "Nishiki Market and a kitchen knife", area: "Central Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.005, lng: 135.7649,
      category: "food", durationHours: 2, costBand: "$$",
      why: "Five covered blocks of pickles, tofu and skewers, plus Aritsugu, a knife maker since 1560 that engraves your name on the blade.",
      fitTags: ["food", "buy-it-for-life"], forWhom: "both", source: "vault",
      vaultNote: "Vault: Jon holds a buy-it-for-life philosophy."
    },
    {
      id: "a-yamazaki", name: "Suntory Yamazaki Distillery", area: "Between Kyoto and Osaka", region: "Kansai", destId: "d-kyoto", lat: 34.8925, lng: 135.6746,
      category: "quirky", durationHours: 2.5, costBand: "$$",
      why: "Japan's first malt whisky distillery, 15 minutes from Kyoto by train. Tours and even museum visits need an advance reservation, and tour places are allotted by lottery.",
      fitTags: ["whisky"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: the Iceland itinerary included a distillery tour."
    },
    {
      id: "a-nara-deer", name: "Nara Park, Todai-ji and Kasuga", area: "Nara", region: "Kansai", destId: "d-nara", lat: 34.689, lng: 135.8398,
      category: "walk", durationHours: 5, costBand: "$",
      why: "Deer that bow for crackers, the Great Buddha, and a forest path lined with stone lanterns.",
      fitTags: ["walks", "history", "disney-classics"], forWhom: "both", source: "research"
    },
    {
      id: "a-dotonbori", name: "Osaka street-food crawl", area: "Dotonbori, Osaka", region: "Kansai", destId: "d-osaka", lat: 34.6687, lng: 135.5013,
      category: "food", durationHours: 3, costBand: "$$",
      why: "Takoyaki, okonomiyaki and kushikatsu under the neon, from Dotonbori down to Shinsekai.",
      fitTags: ["food", "photography", "retro-futurism"], forWhom: "both", source: "research"
    },
    {
      id: "a-koyasan-shukubo", name: "Temple night on Koyasan", area: "Koyasan", region: "Kansai", destId: "d-koyasan", lat: 34.2147, lng: 135.605,
      category: "relax", durationHours: 18, costBand: "$$$",
      why: "Dinner of monks' cuisine in your room, a lantern-lit walk through Okunoin cemetery, and morning prayers with a fire ritual.",
      fitTags: ["quiet-date", "walks", "history"], forWhom: "both", source: "research"
    },
    {
      id: "a-pearl-island", name: "Mikimoto Pearl Island, Toba", area: "Toba", region: "Kansai", destId: "d-ise-toba", lat: 34.4827, lng: 136.8458,
      category: "romantic", durationHours: 3, costBand: "$",
      why: "The island where cultured pearls were first made: a museum, a shop and demonstrations by women divers. About two hours from Kyoto or Osaka by Kintetsu express.",
      fitTags: ["pearls", "history"], forWhom: "both", source: "vault",
      vaultNote: "Vault: named in the May 2026 anniversary chat as a way to tie pearls to the trip."
    },
    {
      id: "a-peace-park", name: "Hiroshima Peace Memorial Museum and Park", area: "Hiroshima", region: "Hiroshima & Setouchi", destId: "d-hiroshima", lat: 34.3955, lng: 132.4536,
      category: "culture", durationHours: 3, costBand: "$",
      why: "Sober, direct and worth the journey. Go in the morning and leave the afternoon open.",
      fitTags: ["history"], forWhom: "both", source: "research"
    },
    {
      id: "a-okonomiyaki", name: "Hiroshima okonomiyaki", area: "Hiroshima", region: "Hiroshima & Setouchi", destId: "d-hiroshima", lat: 34.3915, lng: 132.4614,
      category: "food", durationHours: 1.5, costBand: "$",
      why: "Layered with noodles and cooked on a griddle in front of you, at one of the counters in Okonomimura.",
      fitTags: ["food"], forWhom: "both", source: "research"
    },
    {
      id: "a-miyajima-torii", name: "Miyajima: the torii and Mount Misen", area: "Miyajima", region: "Hiroshima & Setouchi", destId: "d-miyajima", lat: 34.2959, lng: 132.3199,
      category: "nature", durationHours: 6, costBand: "$$",
      why: "The gate stands in water at high tide and on sand at low tide, so check the tide table. Take the ropeway up Mount Misen and walk down.",
      fitTags: ["views", "walks", "photography", "quiet-date"], forWhom: "both", source: "research"
    },
    {
      id: "a-naoshima-art", name: "Naoshima museum day", area: "Naoshima", region: "Hiroshima & Setouchi", destId: "d-naoshima", lat: 34.449, lng: 133.987,
      category: "culture", durationHours: 7, costBand: "$$",
      why: "Chichu Art Museum's Monet room and Turrell skyspace, Benesse House, and the village art houses, by bus and on foot. Reserve Chichu online; most sites close on Mondays.",
      fitTags: ["art", "quiet-date", "retro-futurism"], forWhom: "both", source: "research"
    },
    {
      id: "a-shimanami", name: "E-bike the first bridges of the Shimanami Kaido", area: "Onomichi", region: "Hiroshima & Setouchi", destId: "d-onomichi", lat: 34.354, lng: 133.173,
      category: "nature", durationHours: 5, costBand: "$$",
      why: "A marked cycling route over the Inland Sea. Rent in Onomichi, ride two or three islands, and return by ferry.",
      fitTags: ["nature", "views"], forWhom: "both", source: "research"
    },
    {
      id: "a-ufo-hall", name: "UFO Interactive Hall, Iino", area: "Iino, Fukushima", region: "Tohoku", destId: "d-iino", lat: 37.6593, lng: 140.5465,
      category: "quirky", durationHours: 3, costBand: "$",
      why: "Sighting files, models and a 3D theater in a saucer-themed hall, with a panoramic bath upstairs and a trail up Mount Senganmori outside. ¥400, cash only, 9:00 to 17:00, closed Mondays. About 30 minutes by bus from Fukushima Station, which is about 90 minutes from Tokyo by Shinkansen.",
      fitTags: ["ufo", "quirky", "retro-futurism", "onsen"], forWhom: "jon", source: "vault",
      vaultNote: "Vault: Jon asked for this town by name ('Lena') in March 2026. Research: hours and access read from the Fukushima City and UFO no Sato pages."
    },
    {
      id: "a-yamadera", name: "Yamadera's thousand steps", area: "Yamagata", region: "Tohoku", destId: "d-tohoku", lat: 38.3126, lng: 140.4373,
      category: "walk", durationHours: 3, costBand: "$",
      why: "A temple built up a cliff through cedar forest, with a wooden lookout over the valley at the top.",
      fitTags: ["walks", "views", "foliage"], forWhom: "both", source: "research"
    },
    {
      id: "a-ginzan", name: "Ginzan Onsen by gaslight", area: "Yamagata", region: "Tohoku", destId: "d-tohoku", lat: 38.5706, lng: 140.5303,
      category: "romantic", durationHours: 16, costBand: "$$$$",
      why: "A single street of century-old wooden inns over a river, lit by gas lamps at night. Rooms are few and book out early; day visits are restricted in winter.",
      fitTags: ["onsen", "quiet-date", "photography"], forWhom: "both", source: "research"
    },
    {
      id: "a-yatai", name: "Fukuoka yatai stalls", area: "Fukuoka", region: "Kyushu", destId: "d-fukuoka", lat: 33.5916, lng: 130.4066,
      category: "food", durationHours: 2, costBand: "$$",
      why: "Eight-seat open-air stalls serving ramen, skewers and oden beside the river.",
      fitTags: ["food"], forWhom: "both", source: "research"
    },
    {
      id: "a-beppu-hells", name: "Beppu's hells and a sand bath", area: "Beppu", region: "Kyushu", destId: "d-beppu", lat: 33.3157, lng: 131.477,
      category: "relax", durationHours: 4, costBand: "$$",
      why: "A circuit of boiling, colored pools you look at but do not enter, then a burial in naturally heated sand.",
      fitTags: ["onsen", "quirky"], forWhom: "both", source: "research"
    }
  ],

  stays: [
    {
      id: "s-tokyo-edition", name: "The Tokyo EDITION, Toranomon", area: "Toranomon, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.666, lng: 139.744,
      style: "design-hotel", priceBand: "$$$$", marriott: true,
      why: "A Kengo Kuma interior high above the city, a short walk from teamLab Borderless.",
      notes: "Marriott Bonvoy (EDITION). Research: a second EDITION is in Ginza."
    },
    {
      id: "s-mesm-tokyo", name: "mesm Tokyo, Autograph Collection", area: "Takeshiba, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.654, lng: 139.762,
      style: "design-hotel", priceBand: "$$$", marriott: true,
      why: "Waterfront rooms that look over Hamarikyu garden, where Kathleen can take tea on the pond.",
      notes: "Marriott Bonvoy (Autograph Collection)."
    },
    {
      id: "s-westin-tokyo", name: "The Westin Tokyo", area: "Ebisu, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.642, lng: 139.715,
      style: "business", priceBand: "$$$", marriott: true,
      why: "A calm, classic base on the west side, close to the Nakameguro and Tomigaya coffee walks.",
      notes: "Marriott Bonvoy (Westin)."
    },
    {
      id: "s-tokyo-marriott", name: "Tokyo Marriott Hotel", area: "Shinagawa, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.623, lng: 139.737,
      style: "business", priceBand: "$$$", marriott: true,
      why: "Quiet garden setting near Shinagawa, the Shinkansen stop closest to Haneda. Good for a first or last night.",
      notes: "Marriott Bonvoy (Marriott). Research: a newer JW Marriott is also in this part of the city."
    },
    {
      id: "s-aloft-ginza", name: "Aloft Tokyo Ginza", area: "Ginza, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.669, lng: 139.764,
      style: "design-hotel", priceBand: "$$", marriott: true,
      why: "A mid-priced, central room within walking distance of Mikimoto, Tsukiji and the Yurakucho izakaya.",
      notes: "Marriott Bonvoy (Aloft). Research: AC Hotel and two Courtyards are nearby alternatives."
    },
    {
      id: "s-moxy-kinshicho", name: "Moxy Tokyo Kinshicho", area: "Kinshicho, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.697, lng: 139.815,
      style: "business", priceBand: "$", marriott: true,
      why: "The cheapest sensible way to use Marriott points in Tokyo, on the east side near Kiyosumi-Shirakawa's roasteries.",
      notes: "Marriott Bonvoy (Moxy). Small rooms."
    },
    {
      id: "s-k5", name: "K5", area: "Nihonbashi Kabutocho, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.68, lng: 139.779,
      style: "design-hotel", priceBand: "$$$", marriott: false,
      why: "A converted 1920s bank with a coffee bar and a library bar downstairs. The independent pick for design and coffee.",
      notes: "Not Marriott."
    },
    {
      id: "s-sawanoya", name: "Sawanoya Ryokan", area: "Yanaka, Tokyo", region: "Kanto", destId: "d-yanaka", lat: 35.7225, lng: 139.7655,
      style: "ryokan", priceBand: "$", marriott: false,
      why: "A family-run inn in old Tokyo with tatami rooms and small private-use baths. Simple, warm and very inexpensive.",
      notes: "Not Marriott. Some rooms share bathrooms."
    },
    {
      id: "s-capsule", name: "Capsule hotels", area: "Shinjuku, Tokyo", region: "Kanto", destId: "d-tokyo", lat: 35.6905, lng: 139.705,
      style: "capsule-avoid", priceBand: "$", marriott: false,
      why: "Listed so it can be ruled out. Capsules are single-occupancy and usually on single-gender floors, so they do not work for a couple.",
      notes: "Research: avoid for this trip."
    },
    {
      id: "s-ritz-nikko", name: "The Ritz-Carlton, Nikko", area: "Lake Chuzenji, Nikko", region: "Kanto", destId: "d-nikko", lat: 36.739, lng: 139.49,
      style: "design-hotel", priceBand: "$$$$", marriott: true,
      why: "A lakeside hotel with its own hot-spring baths, if Nikko becomes an overnight in autumn color.",
      notes: "Marriott Bonvoy (Ritz-Carlton). A Fairfield is the budget Marriott option in Nikko."
    },
    {
      id: "s-hakone-ryokan", name: "Hakone ryokan with a private open-air bath", area: "Gora, Hakone", region: "Kanto", destId: "d-hakone", lat: 35.248, lng: 139.048,
      style: "ryokan", priceBand: "$$$$", marriott: false,
      why: "The one splurge that changes the trip: a tatami suite, dinner served in courses, and your own outdoor tub. Gora Kadan and Hakone Ginyu are the well-known names; many smaller inns offer the same idea for less.",
      notes: "Research: Marriott has no hotel in Hakone. Rates include dinner and breakfast."
    },
    {
      id: "s-fuji-marriott", name: "Fuji Marriott Hotel Lake Yamanaka", area: "Lake Yamanaka", region: "Chubu", destId: "d-kawaguchiko", lat: 35.429, lng: 138.848,
      style: "business", priceBand: "$$", marriott: true,
      why: "A points-friendly way to get a hot-spring bath near Mount Fuji, on the next lake over from Kawaguchiko.",
      notes: "Marriott Bonvoy (Marriott). Needs a bus or taxi from the station."
    },
    {
      id: "s-takayama-ryokan", name: "Takayama old-town ryokan", area: "Takayama", region: "Chubu", destId: "d-takayama", lat: 36.141, lng: 137.256,
      style: "ryokan", priceBand: "$$$", marriott: false,
      why: "A traditional inn within walking distance of the morning markets, with Hida beef at dinner.",
      notes: "Research: the only Marriott-family option is a roadside Fairfield between Takayama and Shirakawa-go, which needs a car."
    },
    {
      id: "s-kanazawa", name: "Kanazawa station-area hotel", area: "Kanazawa", region: "Chubu", destId: "d-kanazawa", lat: 36.578, lng: 136.648,
      style: "business", priceBand: "$$", marriott: false,
      why: "A modern hotel near the station and the bus loop to the garden and teahouse districts.",
      notes: "Research: the only Marriott-family hotel in Kanazawa is a budget Four Points Flex. The Hyatt Centric by the station is the stronger room and is not Marriott."
    },
    {
      id: "s-westin-miyako-kyoto", name: "The Westin Miyako Kyoto", area: "Keage, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.009, lng: 135.788,
      style: "business", priceBand: "$$$", marriott: true,
      why: "A hillside hotel with a hot-spring spa, five minutes' walk from Nanzen-ji and Murin-an. The best balance of points, quiet and location.",
      notes: "Marriott Bonvoy (Westin). Marriott's site showed about ¥45,000 a night in November 2026."
    },
    {
      id: "s-mitsui-kyoto", name: "Hotel The Mitsui Kyoto", area: "Nijo Castle, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0125, lng: 135.752,
      style: "design-hotel", priceBand: "$$$$", marriott: true,
      why: "A garden courtyard and a thermal spring spa on the old Mitsui family estate, facing Nijo Castle.",
      notes: "Marriott Bonvoy (Luxury Collection). Among the most expensive rooms in the city."
    },
    {
      id: "s-ritz-kyoto", name: "The Ritz-Carlton, Kyoto", area: "Kamo River, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0135, lng: 135.7715,
      style: "design-hotel", priceBand: "$$$$", marriott: true,
      why: "On the river, walking distance to Gion, Pontocho and Ippodo.",
      notes: "Marriott Bonvoy (Ritz-Carlton). Marriott's site showed about ¥265,000 a night in November 2026."
    },
    {
      id: "s-suiran", name: "Suiran, a Luxury Collection Hotel", area: "Arashiyama, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.014, lng: 135.674,
      style: "design-hotel", priceBand: "$$$$", marriott: true,
      why: "On the river in Arashiyama, so the bamboo grove and Tenryu-ji are yours at dawn.",
      notes: "Marriott Bonvoy (Luxury Collection). Far from central Kyoto in the evening."
    },
    {
      id: "s-chapter-kyoto", name: "The Chapter Kyoto", area: "Kyoto City Hall, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.0115, lng: 135.7665,
      style: "design-hotel", priceBand: "$$", marriott: true,
      why: "A mid-priced design hotel with a large shared bath, central for coffee, Nishiki and Pontocho.",
      notes: "Marriott Bonvoy (Tribute Portfolio). About ¥21,000 a night on Marriott's site in November 2026."
    },
    {
      id: "s-moxy-kyoto", name: "Moxy Kyoto", area: "Nijo, Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.011, lng: 135.742,
      style: "business", priceBand: "$", marriott: true,
      why: "The low-cost points option, two minutes from Nijo Station.",
      notes: "Marriott Bonvoy (Moxy). About ¥14,000 a night on Marriott's site in November 2026."
    },
    {
      id: "s-kyoto-machiya", name: "A Kyoto machiya townhouse", area: "Central Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.003, lng: 135.762,
      style: "machiya", priceBand: "$$$", marriott: false,
      why: "A restored wooden townhouse to yourselves: a small garden, a cypress bath and a quiet lane. The closest thing to living in Kyoto.",
      notes: "Not Marriott. Research: licensed machiya are rented by several local operators; check for stairs and thin walls."
    },
    {
      id: "s-kyoto-ryokan", name: "A classic Kyoto ryokan", area: "Central Kyoto", region: "Kansai", destId: "d-kyoto", lat: 35.01, lng: 135.766,
      style: "ryokan", priceBand: "$$$$", marriott: false,
      why: "One night of full ryokan service with kaiseki in the room. Tawaraya and Hiiragiya are the famous houses; smaller inns cost far less.",
      notes: "Not Marriott. One night is enough; the dinner replaces a restaurant booking."
    },
    {
      id: "s-jw-nara", name: "JW Marriott Hotel Nara", area: "Nara", region: "Kansai", destId: "d-nara", lat: 34.6846, lng: 135.7975,
      style: "business", priceBand: "$$$", marriott: true,
      why: "Turns Nara into an overnight, with the park empty at dawn.",
      notes: "Marriott Bonvoy (JW Marriott). A short taxi or bus ride from the park."
    },
    {
      id: "s-osaka-marriott", name: "Osaka Marriott Miyako Hotel", area: "Tennoji, Osaka", region: "Kansai", destId: "d-osaka", lat: 34.646, lng: 135.5135,
      style: "business", priceBand: "$$$", marriott: true,
      why: "High-floor rooms in the Abeno Harukas tower, directly above a major station.",
      notes: "Marriott Bonvoy (Marriott)."
    },
    {
      id: "s-w-osaka", name: "W Osaka", area: "Shinsaibashi, Osaka", region: "Kansai", destId: "d-osaka", lat: 34.677, lng: 135.5005,
      style: "design-hotel", priceBand: "$$$", marriott: true,
      why: "A black monolith outside and neon inside, on the main boulevard near Mandarake Grand Chaos and Dotonbori.",
      notes: "Marriott Bonvoy (W). Research: The St. Regis is a few blocks north."
    },
    {
      id: "s-koyasan-shukubo", name: "Koyasan temple lodging", area: "Koyasan", region: "Kansai", destId: "d-koyasan", lat: 34.2125, lng: 135.589,
      style: "ryokan", priceBand: "$$$", marriott: false,
      why: "Tatami rooms inside a working temple, with vegetarian dinner and morning prayers. Eko-in is the most used to foreign guests.",
      notes: "Not Marriott. Shared baths at most temples."
    },
    {
      id: "s-sheraton-hiroshima", name: "Sheraton Grand Hiroshima", area: "Hiroshima Station", region: "Hiroshima & Setouchi", destId: "d-hiroshima", lat: 34.3985, lng: 132.477,
      style: "business", priceBand: "$$", marriott: true,
      why: "Attached to the Shinkansen station, which makes a one- or two-night stop effortless.",
      notes: "Marriott Bonvoy (Sheraton)."
    },
    {
      id: "s-iwaso", name: "Iwaso, Miyajima", area: "Miyajima", region: "Hiroshima & Setouchi", destId: "d-miyajima", lat: 34.2935, lng: 132.3225,
      style: "ryokan", priceBand: "$$$$", marriott: false,
      why: "A ryokan in the maple valley behind the shrine. You get the torii at night and at dawn, after the ferries stop bringing day visitors.",
      notes: "Not Marriott."
    },
    {
      id: "s-benesse-house", name: "Benesse House, Naoshima", area: "Naoshima", region: "Hiroshima & Setouchi", destId: "d-naoshima", lat: 34.446, lng: 133.99,
      style: "design-hotel", priceBand: "$$$$", marriott: false,
      why: "Sleep inside a Tadao Ando museum, with the galleries open to guests after hours.",
      notes: "Not Marriott. Books out months ahead."
    },
    {
      id: "s-yoruya", name: "Yoruya, Kurashiki", area: "Kurashiki", region: "Hiroshima & Setouchi", destId: "d-kurashiki", lat: 34.5955, lng: 133.7715,
      style: "design-hotel", priceBand: "$$$", marriott: true,
      why: "A small design inn in the canal quarter, and the rare case where points reach a quiet historic town.",
      notes: "Marriott Bonvoy (Design Hotels member). Research: confirm that points can be earned and used before booking."
    },
    {
      id: "s-fukushima", name: "Fukushima base for the UFO day", area: "Fukushima City", region: "Tohoku", destId: "d-iino", lat: 37.754, lng: 140.459,
      style: "business", priceBand: "$", marriott: false,
      why: "Only needed if the UFO hall becomes an overnight. A station business hotel, or a ryokan at Iizaka Onsen 25 minutes away by local train.",
      notes: "Research: no Marriott in Fukushima. The nearest is The Westin Sendai. As a day trip from Tokyo this stay is unnecessary."
    }
  ],

  sampleItineraries: [
    {
      id: "i-classic",
      name: "Classic: Tokyo and Kyoto",
      tagline: "Two bases, one train ride, the least friction.",
      pace: "mixed",
      bases: [{ place: "Tokyo", nights: 3 }, { place: "Kyoto", nights: 3 }, { place: "Tokyo", nights: 1 }],
      bestSeasons: ["w-mid-may", "w-october", "w-november", "w-winter"],
      destinationIds: ["d-tokyo", "d-yanaka", "d-shimokitazawa", "d-kyoto", "d-uji", "d-nara"],
      highlightIds: ["a-nakano-broadway", "a-coffee-crawl", "a-meiji-jingu", "a-shinkansen", "a-fushimi-inari", "a-arashiyama", "a-tea-ceremony", "a-kaiseki", "a-uji-matcha"],
      days: [
        { day: 1, title: "Fly", plan: "Saturday midday nonstop from Dulles." },
        { day: 2, title: "Land in Tokyo", plan: "Arrive Haneda mid-afternoon. Check in, walk, eat early, sleep." },
        { day: 3, title: "Tokyo west", plan: "Meiji Jingu at opening, west-side coffee, Nezu Museum garden, Shibuya Sky at dusk." },
        { day: 4, title: "Tokyo for each of you", plan: "Nakano Broadway for cels when it opens at noon; a tea counter or Shinjuku Gyoen for Kathleen; izakaya together." },
        { day: 5, title: "Shinkansen to Kyoto", plan: "Morning Nozomi with Fuji on the right. Nishiki, Ippodo, Gion at night." },
        { day: 6, title: "Kyoto east", plan: "Fushimi Inari at dawn, Philosopher's Path, Murin-an, kaiseki dinner." },
        { day: 7, title: "Arashiyama and tea", plan: "Bamboo grove and Okochi Sanso early, tea ceremony in the afternoon, Kyoto coffee in between." },
        { day: 8, title: "Uji or Nara, then Tokyo", plan: "Half day in Uji for matcha or Nara for the deer, then the Shinkansen back for a last night in Tokyo." },
        { day: 9, title: "Fly home", plan: "Sunday flight from Haneda. Land at Dulles the same day." }
      ],
      fridayBonus: "Leave Friday and the extra night goes to Tokyo: add Kamakura, Yanaka or the UFO day trip.",
      tradeoffs: "Research: skips Hakone and everything west of Kyoto. If you take United's afternoon flight home, the last night can stay in Kyoto."
    },
    {
      id: "i-hakone",
      name: "Tokyo, Hakone and Kyoto",
      tagline: "The classic with a ryokan night in the middle.",
      pace: "mixed",
      bases: [{ place: "Tokyo", nights: 2 }, { place: "Hakone", nights: 1 }, { place: "Kyoto", nights: 3 }, { place: "Tokyo", nights: 1 }],
      bestSeasons: ["w-october", "w-november", "w-winter", "w-early-december", "w-mid-may"],
      destinationIds: ["d-tokyo", "d-hakone", "d-kyoto", "d-uji", "d-nara"],
      highlightIds: ["a-nakano-broadway", "a-coffee-west", "a-hakone-onsen", "a-hakone-open-air", "a-hakone-loop", "a-shinkansen", "a-fushimi-inari", "a-tea-ceremony", "a-kaiseki"],
      days: [
        { day: 1, title: "Fly", plan: "Saturday midday nonstop from Dulles." },
        { day: 2, title: "Land in Tokyo", plan: "Arrive Haneda mid-afternoon. Stay on the west side." },
        { day: 3, title: "Tokyo in one day", plan: "Meiji Jingu, coffee, Nakano Broadway from noon, tea or a garden for Kathleen, dinner under the tracks." },
        { day: 4, title: "To Hakone", plan: "Forward the big bags to Kyoto. Open-Air Museum, then check in early and use the private bath before dinner." },
        { day: 5, title: "Hakone loop, then Kyoto", plan: "Ropeway and lake in the morning, Shinkansen from Odawara, evening stroll in Gion." },
        { day: 6, title: "Kyoto east", plan: "Fushimi Inari at dawn, Philosopher's Path, tea ceremony, kaiseki." },
        { day: 7, title: "Arashiyama and central Kyoto", plan: "Bamboo grove early, Nishiki and Ippodo, Daitoku-ji's gardens late in the day." },
        { day: 8, title: "Uji, then Tokyo", plan: "Morning in Uji, afternoon Shinkansen, last night near Shinagawa or Ginza." },
        { day: 9, title: "Fly home", plan: "Sunday flight from Haneda." }
      ],
      fridayBonus: "Leave Friday and the extra night goes to Tokyo at the start, which takes the pressure off the single Tokyo day.",
      tradeoffs: "Research: three hotel moves in seven nights. That is gentler than the Iceland plan in the vault, but Tokyo gets short measure unless you leave Friday."
    },
    {
      id: "i-tokyo-deep",
      name: "Tokyo deep: cels, coffee and day trips",
      tagline: "One base, no packing, and room for the UFO town.",
      pace: "mixed",
      bases: [{ place: "Tokyo", nights: 5 }, { place: "Hakone", nights: 1 }, { place: "Tokyo", nights: 1 }],
      bestSeasons: ["w-winter", "w-early-december", "w-october", "w-september", "w-mid-may"],
      destinationIds: ["d-tokyo", "d-yanaka", "d-shimokitazawa", "d-kamakura", "d-nikko", "d-hakone", "d-iino", "d-kawaguchiko"],
      highlightIds: ["a-nakano-broadway", "a-akihabara", "a-coffee-crawl", "a-coffee-west", "a-shimokita-vinyl", "a-ghibli-museum", "a-ufo-hall", "a-kamakura-hike", "a-hakone-onsen", "a-tokyo-tea"],
      days: [
        { day: 1, title: "Fly", plan: "Saturday midday nonstop from Dulles." },
        { day: 2, title: "Land in Tokyo", plan: "Arrive Haneda mid-afternoon. One hotel for the next five nights." },
        { day: 3, title: "West side", plan: "Meiji Jingu, Koffee Mameya to Fuglen, Shimokitazawa records, Shibuya Sky." },
        { day: 4, title: "Cel day", plan: "Nakano Broadway from noon, then Akihabara. Kathleen: tea counter, Hamarikyu and Ginza, meeting for dinner." },
        { day: 5, title: "The UFO town", plan: "Shinkansen to Fukushima, bus to Iino, the hall, the hill and the bath. Back in Tokyo by evening. Not on a Monday." },
        { day: 6, title: "Kamakura", plan: "Temple hike, matcha in the bamboo, the coast tram." },
        { day: 7, title: "East side, then Hakone", plan: "Kiyosumi-Shirakawa roasteries and garden in the morning, then the afternoon train to a Hakone ryokan." },
        { day: 8, title: "Hakone, then Tokyo", plan: "Open-Air Museum or the ropeway loop, then back for a last evening: Ghibli Museum if tickets came through, or teamLab." },
        { day: 9, title: "Fly home", plan: "Sunday flight from Haneda." }
      ],
      fridayBonus: "Leave Friday and add Nikko, or a night at Kawaguchiko for Fuji.",
      tradeoffs: "Research: no Kyoto, which is the strongest tea-and-garden city for Kathleen. Tokyo's tea rooms and gardens carry that load here."
    },
    {
      id: "i-west",
      name: "West Japan: Hiroshima, Kyoto and Osaka",
      tagline: "Less Tokyo, more history, food and the Inland Sea.",
      pace: "intense",
      bases: [{ place: "Tokyo", nights: 1 }, { place: "Hiroshima", nights: 2 }, { place: "Kyoto", nights: 2 }, { place: "Osaka", nights: 1 }, { place: "Tokyo", nights: 1 }],
      bestSeasons: ["w-october", "w-november", "w-mid-may", "w-early-december"],
      destinationIds: ["d-tokyo", "d-hiroshima", "d-miyajima", "d-himeji", "d-kyoto", "d-uji", "d-nara", "d-osaka", "d-kurashiki", "d-naoshima"],
      highlightIds: ["a-shinkansen", "a-peace-park", "a-okonomiyaki", "a-miyajima-torii", "a-fushimi-inari", "a-tea-ceremony", "a-kaiseki", "a-dotonbori", "a-osaka-mandarake"],
      days: [
        { day: 1, title: "Fly", plan: "Saturday midday nonstop from Dulles." },
        { day: 2, title: "Land, sleep near Shinagawa", plan: "Arrive Haneda mid-afternoon. Stay by the Shinkansen station." },
        { day: 3, title: "Shinkansen to Hiroshima", plan: "Four hours west with Fuji on the way. Peace Park and museum, okonomiyaki for dinner." },
        { day: 4, title: "Miyajima", plan: "Torii at high tide, Mount Misen, oysters. Back to Hiroshima for the night." },
        { day: 5, title: "Himeji, then Kyoto", plan: "Stop at Himeji Castle on the way east. Evening in Gion." },
        { day: 6, title: "Kyoto", plan: "Fushimi Inari at dawn, tea ceremony, Arashiyama or the Philosopher's Path, kaiseki." },
        { day: 7, title: "Uji or Nara, then Osaka", plan: "Half day for matcha or deer, then 15 minutes to Osaka: Mandarake Grand Chaos and a Dotonbori food crawl." },
        { day: 8, title: "Back to Tokyo", plan: "Morning Shinkansen. A last afternoon for Nakano Broadway and coffee." },
        { day: 9, title: "Fly home", plan: "Sunday flight from Haneda." }
      ],
      fridayBonus: "Leave Friday and add a night in Kurashiki or on Naoshima between Hiroshima and Kyoto.",
      tradeoffs: "Research: four hotel moves and about ten hours on trains. Tokyo's cel and coffee time shrinks to one afternoon."
    }
  ],

  researchReport: [
    {
      id: "r-vault",
      title: "What the vault already says",
      lede: "The trip is a real intention with no dates. The useful part of the record is who you are as travelers.",
      bullets: [
        { tag: "Vault", text: "In March 2026 Jon asked for a Japan brainstorm page for the two of you, clustered by region, with a reason to go for each place. It covered eight regions: Kanto, Kansai, Chubu, Hiroshima and Miyajima, Tohoku, Kyushu, Hokkaido and Okinawa." },
        { tag: "Vault", text: "Jon added one place by name: a UFO town he called 'Lena'. It is Iino, now part of Fukushima City, with the UFO Interactive Hall and Mount Senganmori." },
        { tag: "Vault", text: "The travel page still lists Japan as 'in brainstorming' with no dates, and notes that the Notion page may never have been created." },
        { tag: "Vault", text: "Jon drinks specialty coffee. Kathleen drinks tea. An anniversary plan in May 2026 put it as 'coffee for him, tea for her'." },
        { tag: "Vault", text: "Jon collects hand-painted production cels, mainly The Big O and Outlaw Star, and already buys from Mandarake and Yahoo Auctions Japan. He wants production cels only." },
        { tag: "Vault", text: "Jon's other recorded interests are retro-futurism, synthwave and heavy music, meteorites, cigars and things built to last." },
        { tag: "Vault", text: "Kathleen's favorite animated films are Bambi, The Lion King and Cinderella. She is a Stephen King fan and is new to gardening." },
        { tag: "Vault", text: "The September 2025 Iceland plan used four lodgings in five nights with full sightseeing days. A dense itinerary has worked before." },
        { tag: "Vault", text: "For a date night Jon asked for somewhere quiet and shaded. Evenings on this trip should lean that way." },
        { tag: "Vault", text: "Recent hotel nights were booked with Marriott points." },
        { tag: "Research", text: "Nothing in the vault records what Kathleen herself wants from Japan. Every Kathleen match in this app is an inference from tea, gardens and films." }
      ]
    },
    {
      id: "r-frame",
      title: "The frame: nine days, two weekends",
      lede: "Leave Friday or Saturday, come home the following Sunday. The date line does the rest.",
      bullets: [
        { tag: "Research", text: "Westbound, you land the afternoon after you leave. Leave Saturday and you get seven nights and six full days. Leave Friday and you get eight nights and seven full days." },
        { tag: "Research", text: "Eastbound, you land in Washington on the same Sunday you leave Tokyo, in the morning on ANA or mid-afternoon on United." },
        { tag: "Research", text: "Jet lag runs 13 or 14 hours. Expect to wake at 4 am for the first days, which suits dawn visits to Meiji Jingu, Tsukiji and Fushimi Inari." },
        { tag: "Research", text: "Six or seven full days supports two bases comfortably, three with care. Each hotel change costs about half a day." },
        { tag: "Open", text: "Friday or Saturday? Friday costs one more day of leave and childcare and buys a full extra day in Japan." }
      ]
    },
    {
      id: "r-season",
      title: "When to go",
      lede: "Three windows stand out. Three should be avoided. The rest are trade-offs you can score in the Planning Engine.",
      bullets: [
        { tag: "Research", text: "Best all-round: mid to late October. Dry, clear, comfortable, with autumn color in Nikko and Tohoku and shoulder-season fares." },
        { tag: "Research", text: "Best for comfort and meaning: mid to late May. The mildest weather of the year and a lull after Golden Week." },
        { tag: "Vault", text: "Your wedding anniversary is May 25. A May 21 or 22 departure puts it mid-trip." },
        { tag: "Research", text: "Most beautiful: mid to late November in Kyoto, at the price of Kyoto crowds and a clash with Thanksgiving week if you chase peak color." },
        { tag: "Research", text: "Best value: mid-January to February, and September. February is the cheapest month for the Dulles nonstop; September is cheapest across all routes but carries typhoon risk." },
        { tag: "Research", text: "Avoid Golden Week (April 29 to May 5, 2027), Obon (about August 11 to 16) and New Year (December 28 to January 4)." },
        { tag: "Research", text: "Cherry blossom is the famous choice and the hardest to do well: peak prices, peak crowds, and a bloom date that moves by a week." },
        { tag: "Vault", text: "June has gone to a family week at Tyler Place two years running, and it is one of the two most expensive months to fly." }
      ]
    },
    {
      id: "r-flights",
      title: "Flights: the DCA question",
      lede: "National cannot get you to Tokyo in one flight. Dulles can, twice a day.",
      bullets: [
        { tag: "Research", text: "DCA has no nonstop to Tokyo and its perimeter rule rules one out. ANA and United each fly Dulles to Haneda daily, about 14 and a half hours out." },
        { tag: "Research", text: "There is no flight from DCA to IAD. The choice is to start at Dulles and fly nonstop, or to start at DCA and change planes at a US hub." },
        { tag: "Research", text: "Recommendation: the Dulles nonstop. It saves three to six hours each way and removes the missed-connection risk from a short trip." },
        { tag: "Estimate", text: "KAYAK's typical range for the nonstop is $1,284 to $1,861 a person round trip, so about $2,570 to $3,720 for two in economy." },
        { tag: "Estimate", text: "Cheapest months are February and September, near $1,200 to $1,260 a person. June and December are the most expensive, near $1,650 to $1,700." },
        { tag: "Research", text: "The cheapest fares on a search page usually stop in Seoul, Taipei or Canada. The brief excludes those." },
        { tag: "Research", text: "Haneda is 20 to 30 minutes from central Tokyo; Narita is 60 to 90. Both nonstops use Haneda." },
        { tag: "Vault", text: "Jon has Global Entry for the return. Kathleen's status and both passport expiry dates are not on record." }
      ]
    },
    {
      id: "r-destinations",
      title: "The destination universe",
      lede: "Thirty-one places are on the map. Nine days holds two or three of them properly.",
      bullets: [
        { tag: "Vault", text: "The March brainstorm named Tokyo, Kamakura, Nikko, Hakone, Kyoto, Osaka, Nara, Takayama and Shirakawa-go, Kanazawa, Hiroshima, Miyajima, Iino, Fukuoka, Beppu, Hokkaido and Okinawa." },
        { tag: "Research", text: "Added here without constraint: Yanaka, Shimokitazawa, Kawaguchiko, Matsumoto, the Kiso Valley, Uji, Himeji, Koyasan, Ine, Toba and Ise, Naoshima, Kurashiki, Onomichi, Nagasaki and wider Tohoku." },
        { tag: "Research", text: "Tokyo and Kyoto carry most of what the vault says you like. Tokyo holds the cels, the coffee and the retro-future; Kyoto holds the tea, the gardens and the quiet evenings." },
        { tag: "Research", text: "Iino works as a long day trip from Tokyo: about 90 minutes by Shinkansen to Fukushima and 30 minutes by bus. The hall is closed on Mondays and takes cash only." },
        { tag: "Research", text: "Hokkaido and Okinawa each need a domestic flight and most of a trip. Treat them as a different holiday." },
        { tag: "Research", text: "Quiet alternatives to the busiest places: Kanazawa for Kyoto, Uji for central Kyoto tea shops, Yanaka for Asakusa, Miyajima overnight instead of by day." }
      ]
    },
    {
      id: "r-stays",
      title: "Where to stay",
      lede: "Use points where Marriott is good, and pay cash for the one night that should be a ryokan.",
      bullets: [
        { tag: "Vault", text: "Recent stays were paid with Marriott points, so the app marks every Marriott-family hotel." },
        { tag: "Research", text: "Marriott is well represented in Tokyo, Kyoto and Osaka at every price, from Moxy to Ritz-Carlton. It also has hotels in Nara, Hiroshima, Nikko and near Fuji." },
        { tag: "Research", text: "Marriott has nothing in Hakone, Kamakura, Koyasan, Miyajima, Naoshima or Fukushima, and only budget properties in Kanazawa and near Takayama." },
        { tag: "Research", text: "The experiences Japan does best are not chain hotels: a ryokan with a private bath, a Kyoto townhouse, a temple on Koyasan. Plan one such night and use points around it." },
        { tag: "Research", text: "In Tokyo, choose the side of the city by interest. West (Shibuya, Ebisu) for coffee and Nakano; east (Ginza, Nihonbashi) for tea counters, Tsukiji and the roasteries." },
        { tag: "Research", text: "Forward large bags between hotels with a courier service (takkyubin), usually overnight, and travel with a day pack. Hotels arrange it at the front desk." },
        { tag: "Research", text: "Kyoto raised its lodging tax in 2026; it scales with the room rate and is paid at the hotel." },
        { tag: "Open", text: "The Marriott points balance is not on record, so the app cannot say how many nights points would cover." }
      ]
    },
    {
      id: "r-activities",
      title: "What to do",
      lede: "Plan mornings together, split one afternoon each, and keep the evenings quiet.",
      bullets: [
        { tag: "Research", text: "Jon's days: Nakano Broadway and Akihabara for cels, the coffee districts, record shops, the UFO hall and Odaiba's retro-future." },
        { tag: "Research", text: "Kathleen's days, inferred: tea counters and a ceremony, Uji, Kyoto and Kanazawa gardens, Hamarikyu and Shinjuku Gyoen." },
        { tag: "Research", text: "Shared: dawn shrines, the Shinkansen, a private onsen, a kaiseki dinner, Ghibli Museum, teamLab, long walks in Kamakura or Arashiyama." },
        { tag: "Research", text: "Cel shops open around noon. Put gardens, shrines and coffee in the morning and cels after lunch." },
        { tag: "Research", text: "Book ahead: Ghibli Museum (10th of the prior month), teamLab (two months), Shibuya Sky at sunset, Chichu Art Museum, kaiseki, any tea ceremony, Yamazaki distillery." },
        { tag: "Vault", text: "A May 2026 anniversary chat proposed buying pearls in Japan, at Mikimoto in Ginza or on Pearl Island near Toba." },
        { tag: "Open", text: "Tokyo DisneySea or Disneyland is listed as optional. The film favorites are on record; whether Kathleen wants a park day is not." },
        { tag: "Research", text: "For cels bought in person, carry them flat between boards in hand luggage. Japan's tax-free shopping rules changed in late 2026, so keep receipts and check the current refund process." }
      ]
    },
    {
      id: "r-logistics",
      title: "Logistics that change the plan",
      lede: "A short list of things that are different in Japan and easy to get right.",
      bullets: [
        { tag: "Research", text: "Trains: buy Shinkansen tickets as you go. The seven-day Japan Rail Pass costs ¥50,000 and does not pay for itself on a Tokyo to Kyoto round trip." },
        { tag: "Research", text: "Add a Suica transit card to an iPhone wallet before you fly. It works on trains, buses and in convenience stores nationwide." },
        { tag: "Research", text: "Cash still matters at small temples, markets and rural sights, including the UFO hall. Seven-Eleven ATMs take US cards." },
        { tag: "Research", text: "Onsen: wash before entering, no swimwear, and public baths are separate for men and women. Many refuse visible tattoos; private baths avoid the question." },
        { tag: "Research", text: "Tipping is not expected anywhere." },
        { tag: "Research", text: "Many museums and gardens close on Mondays. Check before fixing each day." }
      ]
    },
    {
      id: "r-open",
      title: "Open questions",
      lede: "These need an answer from one of you before anything is booked.",
      bullets: [
        { tag: "Open", text: "Kids or no kids? The app assumes a couple's trip. The vault shows grandparents covering weekends and one four-day trip covered at home, not nine or ten days." },
        { tag: "Open", text: "Which year and which window? Example dates assume 2027." },
        { tag: "Open", text: "What is the budget, and is it cash, points or both?" },
        { tag: "Open", text: "Are both passports valid through the trip dates? No expiry date is on record." },
        { tag: "Open", text: "What does Kathleen want from Japan? Tea, gardens and the film favorites are inferences, not answers." },
        { tag: "Open", text: "Does cel hunting get a dedicated half day or two, and is there a purchase budget?" },
        { tag: "Open", text: "Is the UFO town worth a full day of a six-day trip?" },
        { tag: "Open", text: "Economy, premium economy or business for a 14-hour flight?" },
        { tag: "Open", text: "Is the pearls idea from the anniversary chat still wanted?" },
        { tag: "Vault", text: "A friend flew to Japan in mid-October 2026 (wiki/topics/friends.md). Fresh notes may be one text away." }
      ]
    }
  ]
};
