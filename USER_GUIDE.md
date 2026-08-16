# Legacy GovCon — How I Actually Use This

A plain-language walkthrough of the day-to-day workflow, for whenever I need
a refresher after being away from it for a while.

## The big picture

Everything flows through one pipeline, no matter where it came from —
a federal RFP, an IMLS grant, or a freelance gig off ArchiveGig:

**Discover it → decide if it's worth pursuing → track it while pursuing →
win or lose it → if won, run it as a project → log it as award history.**

Along the way, every opportunity can be linked to an **Institution** (the
organization) and a **Contact** (a person there) — that's what makes the
Institutions/Contacts/Projects pages actually useful instead of separate
disconnected lists.

## A normal week

**Check the Dashboard first.** It's built to answer "what needs me today,"
not to be browsed — the KPI tiles are clickable and jump straight into the
filtered list behind each number (New Opportunities, Pursuing, Due in 14
Days, etc.).

**Check Email Inbox.** Bid-alert digests (BidMatch, GovExpert, ArchiveGig)
land here automatically, pre-filtered to opportunity-relevant mail, with a
`$`/`#` mark next to each one showing whether it's worth opening. A single
opportunity email gets a **Convert** button that pre-fills an opportunity
form; a digest email with many listings gets **Parse & Import All**, which
splits it into individual opportunity cards you check off and import in
bulk.

**Review new opportunities.** Everything lands with status **New**. Open one,
read the AI fit score and reasoning, and decide: pursue it, or mark it Not
Pursuing and move on. Star (★) the ones worth revisiting first.

**Move what you're pursuing into Pipeline.** From an opportunity's detail
page, **Add to Pipeline** starts tracking it through stages (Identified →
Qualified → Pursuing → Proposal In Progress → Submitted → Negotiating →
Awarded/Lost/Withdrawn), with a win-probability estimate and a next-action
date so nothing quietly goes stale.

**Log every real-world touch.** Call, emailed, met with someone — log it
right on that person's Contact page (or the Institution's page; either one
works, and it shows up on both automatically if the contact belongs to that
institution). This is the actual CRM half of the system — the pipeline
tracks the deal, the Communication Log tracks the relationship.

**When something's won**, add it as a **Project** and link it to the
institution. That's what later becomes a **past-performance reference** —
Award History and the "Past Performance" section of the capability-statement
Bid Guide both pull from real project data instead of you having to
remember and re-type it into every new proposal.

## Building relationships, not just chasing bids

- **New institution you want to target?** Add it (Target status), even
  before you've made contact. Move it through Target → Prospect → Partner →
  Client as the relationship develops.
- **No contact there yet?** That's fine — Institutions and Projects don't
  require one. Add a contact the moment you have a name; every contact does
  require an institution, since a contact floating with no organization
  isn't useful later.
- **Cold outreach?** Bid Guides has three ready-to-use email templates
  (government/city/county agencies, small museums & HBCUs, and a short
  cold-outreach version) — copy, personalize the bracketed parts, attach the
  current capability statement from Settings, send.
- **Quick-add an institution mid-form** — on the Add Contact page, "+ New"
  next to the Institution field creates one inline without losing what
  you've already typed.

## Keeping the system itself healthy

- **Settings → Company Profile** is the one place your business identity
  lives (name, CAGE, UEI, certifications, capability statement, logo) — it
  feeds every AI draft and evaluation, so keep it current.
- **Settings → NAICS Codes / Keywords** drive what SAM.gov/Grants.gov
  searches match and how the AI fit score is weighted — revisit these if the
  scores start feeling off.
- **Settings → Backup** — download a database backup anytime, or set a
  schedule to have one emailed. Worth doing before any big changes.
- **Bid Guides** aren't just references — the playbooks encode the actual
  evaluation criteria and process for contracts, grants, and subcontracts;
  read the relevant one before writing a real proposal, not just when
  curious.

## When something looks broken

Check whether the site's actually running the latest version first —
deploys on this host require a manual step, so "it's not working" is very
often "the fix hasn't been deployed yet" rather than a new bug. If it really
is broken, that's a normal part of using software day-to-day — note what you
were doing and report it like any other bug.
