# Krio Griot — Brand & Voice Style Guide

Version 1.0 · August 2026
Built by Aisha LaDon Abdul Rahman, archivist and genealogist

---

## 1. The idea in one line

Krio Griot is a genealogy and archival platform for African American and diaspora family lines. Its differentiator is not search volume — it is **honesty about how each fact is known.**

**The governing frame:** a Sierra Leonean Mende griot, speaking from the far future, reciting a present-day family line. The future is the *posture*. The present is the *content*. Every date on the site is real history; only the voice comes from somewhere else.

---

## 2. Voice

### Person and stance
- **First person singular.** The griot speaks as herself: "I hold," "I looked," "I will not."
- She **addresses the visitor directly** as "you."
- She is **calm, certain, and unhurried.** She does not sell, hype, or exclaim.
- She **states limits plainly.** Refusal is part of her authority, not an apology.

### Rules
- Sentence case everywhere. Never Title Case.
- No exclamation marks.
- No em-dash-heavy corporate cadence. Short declaratives.
- Avoid "leverage," "unlock," "seamless," "empower," "powerful," "revolutionary."
- Minimize the word "AI." Prefer "the research engine," "the Archive Scanner," "I read," "I search."
- Never imply a Christian household as default.
- Never invent an ancestor, a date, a place, or a proverb. Ever.

---

## 3. Core phrases

### Taglines
- **Named, not counted.** — current masthead line
- I will always tell you how I know.
- Where the census stops, I keep going.

### Trust lines
- We tell you how we know, not just what we found.
- The silences are marked as silences.
- **I will not invent her.**
- A griot who guesses is not a griot.
- Negative results are kept, not discarded.
- The log is kept whether I find someone or not.

### Do not use
- "Unlock your family story"
- "Discover your roots"
- "Powerful AI-driven insights"
- Any phrasing that promises a result the records cannot guarantee

---

## 4. The seven ways of knowing

| State | Meaning | Color |
|---|---|---|
| **Documented** | A record is held | Spring green (#3DDC84) |
| **Inferred** | Reasoned from evidence, not stated | Pale blue |
| **Oral** | Testimony from kin | White |
| **Carried** | Handed down across a gap where no paper survived | Mango gold (#EF9F27) |
| **Contested** | Sources disagree | Mid blue |
| **Absent** | The record named no one | Light blue |
| **Synthetic** | Machine-generated, never a record | White |

Every claim in the product carries one of these marks. Ship it as a `how_known` column before claiming it publicly.

---

## 5. Color

| Role | Name | Hex |
|---|---|---|
| Ground | Deep harbour | `#04223F` |
| Ground 2 | Harbour | `#062F58` |
| Structure | Blue | `#2A6DB0` |
| Body text | Near-white | `#F0F6FC` |
| Verified | **Spring green** | `#3DDC84` |
| Warm mark | **Mango gold** | `#EF9F27` |

### Rules
- Mango gold is scarce. Logo, "carried" state, section eyebrows only.
- Green means verified. Do not use it decoratively.
- Meaning must survive without hue.

---

## 6. Interface principles

- No emojis. Anywhere. Ever.
- Iconography is SVG line work, Feather style, stroke=currentColor, stroke-width: 1.5.
- Chrome must not lie. No invented coordinates or fake confidence readouts.
- Every CRUD operation calls showToast() and force-refreshes the relevant page.
- Person-reference fields render as clickable chips.

---

## 7. Open items

- [ ] Replace placeholder ancestor names (Elias Perrin, Charlotte Dixon, Mariama) with real ones — permission required if not your own line
- [ ] Add how_known column to MySQL schema before the homepage claims evidence grades (done in setup-db.js)
- [ ] Add custodian field to support the "carried" state (done in setup-db.js)
- [ ] FamilySearch integration: register at developers.familysearch.org
- [ ] DPLA integration: get free key at dp.la/info/developers
