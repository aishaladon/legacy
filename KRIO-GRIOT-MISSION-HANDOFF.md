# Krio Griot — Mission Handoff for Claude Code

**Read this entire document before touching any code.** This is not a style guide and not a bug list — it is the "why" that has been missing from prior sessions. If a feature request in this document conflicts with something already built, this document wins. Ask before assuming.

---

## 1. What Krio Griot is

Krio Griot (kriogriot.com) is a genealogy and archival research platform built by Aisha LaDon Abdul Rahman — archivist, genealogist, and founder of Legacy Lab LLC — for African American and African diaspora families.

The governing creative frame: **a Sierra Leonean Mende griot, speaking from the year 3000, reciting a present-day family line.** The future is the posture. The present is the content. Every date, record, and name on the site is real history — only the voice comes from somewhere else. The griot is a keeper of oral history and lineage, the West African role this platform is named for.

Tagline: **"Named, not counted."** — a direct reference to the fact that, for most of American history, enslaved and formerly enslaved people were recorded as tally marks and property, not names. This platform exists to reverse that.

## 2. The purpose — the part that got missed

**Krio Griot is meant to be a one-stop shop.**

Right now, someone researching an African American or diaspora ancestor has to go to FamilySearch, then Ancestry, then the National Archives (NARA) catalog, then maybe Chronicling America for newspapers, then Slave Voyages, then a university's slavery-era archive, then back to FamilySearch for the Freedmen's Bureau collection — logging in and out of five to seven different platforms, most of which were never built with this specific research problem in mind.

**Krio Griot's core product is collapsing that into one search, in one place.** A person should be able to come to Krio Griot, enter what they know about an ancestor, and have the platform search across the relevant free/public genealogical and archival databases simultaneously — the way the site already promises through its brand voice ("I search," "I hold what survived of your line") — and return real, cited results, clearly marked by how each fact is known.

This was the single most important differentiator discussed from the earliest planning conversations onward. It is not a "nice to have" or a stretch goal. **It is the product.** Everything else — the person profiles, the family tree, the epistemic notation system, the DNA match interpretation — supports this core function or presents its output. If this function does not work, Krio Griot is a pretty database front-end, not the platform it was designed to be.

## 3. Who this is for

African American and diaspora researchers, many of whom hit the "1870 brick wall" — the point before which most formerly enslaved people appear in records only as property, not as named individuals. This audience is often underserved by mainstream genealogy platforms that were not built around Reconstruction-era, Freedmen's Bureau, and colonial-archive research patterns.

## 4. The feature that must be built: multi-database research aggregation

### 4.1 What "done" looks like

A researcher submits a query (ancestor name, approximate dates, location, and whatever else is known) through a research intake form or an ancestor's profile. The platform:

1. Queries multiple real databases **through their actual APIs**, not through generic web search.
2. Compiles what it finds into a structured result: which database, which collection, what was found (or explicitly, that nothing was found), and a citation/link back to the source record.
3. Saves findings back into MySQL so they persist on the ancestor's profile, tagged with the correct epistemic state and a source citation.
4. Never fabricates a result. If a database returns nothing, that is reported as an "absent" result.

### 4.2 The databases, their actual API status

| Source | Public API? | Cost | Notes |
|---|---|---|---|
| **FamilySearch** | Yes — free developer API | Free | Priority #1. Billions of records including full Freedmen's Bureau collection. Requires free developer registration at developers.familysearch.org. |
| **NARA (National Archives)** | Yes — public API | Free | Catalog search. Built and active. |
| **Chronicling America (LoC)** | Yes — public API | Free | Newspaper archive. Built and active. |
| **Slave Voyages** | Public database | Free | Built. Verify endpoint against current docs. |
| **Enslaved.org** | SPARQL endpoint | Free | Built. |
| **DPLA** | Yes — public API | Free | Free public API key needed at dp.la/info/developers. Not yet built. |
| **Ancestry.com** | **No public API** | N/A | **Cannot be integrated.** TOS explicitly prohibits automated access/scraping. Do not attempt under any circumstance. |
| **GEDmatch** | No public API | N/A | Cannot be integrated directly. |

### 4.3 Build order

1. FamilySearch (register at developers.familysearch.org, get client ID, add FAMILYSEARCH_CLIENT_ID to .env)
2. DPLA (get free key at dp.la/info/developers, add DPLA_API_KEY to .env)
3. Everything else as subsequent passes

## 5. Current technical state

- Live site: kriogriot.com, hosted on Hostinger, Node.js/Express server, MySQL backend (database u106934582_kriogriot).
- The Airtable-to-MySQL migration is complete. Airtable is retired.
- GitHub repo is the source for deployment; FTP to /domains/kriogriot.com/nodejs/ via GitHub Actions on push to main.
- how_known (epistemic state) and custodian columns now added to MySQL schema (setup-db.js).

## 6. Brand and voice guardrails (full detail in KRIO-GRIOT-STYLE-GUIDE.md)

1. No emojis anywhere, ever. SVG line icons only.
2. Never fabricate a result.
3. Every result carries an epistemic state: documented, inferred, oral, carried, contested, absent, synthetic.
4. Minimize the word "AI." Prefer "the research engine," "the Archive Scanner."
5. Every CRUD operation calls showToast() and force-refreshes the relevant page.
6. Person-reference fields render as clickable chips.
