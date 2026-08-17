# Krio Griot — Persistent Project Instructions

**Read this file in full at the start of every session, before doing anything else.** This file exists specifically so the mission, constraints, and verification rules survive between sessions — do not treat it as optional background reading.

---

## 1. What this project is (read `KRIO-GRIOT-MISSION-HANDOFF.md` for full detail)

Krio Griot (kriogriot.com) is a genealogy and archival research platform for African American and diaspora families, built by Aisha LaDon Abdul Rahman / Legacy Lab LLC.

**The core product is a one-stop-shop research aggregator.** A researcher should be able to submit an ancestor's known details once, on this platform, and have it search across real genealogical/archival databases (FamilySearch, NARA, Chronicling America, and others — see the mission handoff for the full list and their actual API status) through their real APIs, and return real, cited, honestly-reported results. This is not one feature among many — it is the reason the platform exists. Treat any work on this feature as top priority unless explicitly told otherwise.

If `KRIO-GRIOT-MISSION-HANDOFF.md` exists in this repo, read it now. If it does not exist in this repo, tell the user immediately — it should have been placed here and its absence means context is missing.

## 2. Non-negotiable rule: no completion claims without verification

**Never say a feature is "done," "working," "fixed," or "ready to test" without having just run it and read real output.**

Before any statement like that:
1. State what command or action would prove the claim.
2. Actually run it.
3. Read the full, real output — not an assumption of what it should say.
4. Only then report status, and report it with the evidence shown, not just asserted.

If a feature involves an external API (FamilySearch, NARA, etc.), "done" requires showing an actual API response from a real query — not a description of what the integration is supposed to do, not "the code compiles," not "the button doesn't throw an error."

If you did not just verify something, say so plainly: "I have not tested this yet" is always an acceptable and preferred answer over an unverified "it works."

## 3. Before writing new code

- State your plan in plain language and get explicit approval before implementing — especially for anything touching the research-aggregation feature, the database schema, or the live site's design.
- Do not redesign, restyle, or rebuild anything that wasn't asked for. Surgical, minimal changes only. This has been stated repeatedly — treat unsolicited rebuilds as a mistake, not initiative.
- Check what already exists (in code and on the live server) before assuming something needs to be built from scratch. Prior sessions have claimed things were built when they weren't — verify independently rather than trusting old commit messages or prior summaries.

## 4. Where things actually live

- Live site: kriogriot.com, hosted on Hostinger, Node.js/Express, MySQL (`u106934582_kriogriot`).
- **The GitHub repo may be behind the live deployed site.** If there's a mismatch, the live server's files are the source of truth for current behavior — flag the mismatch rather than silently trusting either one.
- `.env` values (API keys) live on the live server and are not committed to git. Before claiming an integration is wired up, confirm the actual key exists and is populated on the live server — not just referenced in code.
- Airtable is retired. The MySQL migration is complete. Do not reference or rebuild against Airtable.

## 5. Brand and voice (full detail in `KRIO-GRIOT-STYLE-GUIDE.md`)

- No emojis, anywhere, ever. SVG line icons only.
- Never fabricate a genealogical result. An empty search result is reported honestly, not glossed over.
- Every result/fact carries one of seven epistemic states: documented, inferred, oral, carried, contested, absent, synthetic.
- Every CRUD action calls `showToast()` and force-refreshes the affected view.
- Person-reference fields render as clickable chips linking to that person's profile.

## 6. If something in this file conflicts with an instruction in a chat message

Say so and ask, rather than silently picking one. This file reflects standing project rules; a chat message may be a one-off exception, but it should be confirmed as intentional, not assumed.
