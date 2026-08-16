# Legacy GovCon — User Guide

A detailed, section-by-section walkthrough of how the system actually works —
written from a full live walkthrough of the app, not from the feature list.
Read `PORTFOLIO.md` for the pitch; this is the manual.

## The big picture

Everything flows through one pipeline, no matter where it came from — a
federal RFP, an IMLS grant, or a freelance gig off ArchiveGig:

**Discover it → decide if it's worth pursuing → track it while pursuing →
win or lose it → if won, run it as a project → log it as award history.**

Along the way, every opportunity can be linked to an **Institution** (the
organization) and a **Contact** (a person there) — that's what makes the
Institutions/Contacts/Projects pages actually useful instead of separate
disconnected lists.

## 0. Before you start: one-time setup

All configuration lives in Settings. Work top to bottom.

- **Company Profile** — business name, owner, years in business, website,
  CAGE code, UEI, certifications, logo. This feeds every AI draft and fit
  evaluation.
- **Capability Statement** — paste or edit your statement directly, or use
  Upload & Suggest Keywords/NAICS (.txt, .pdf, .docx). Uploading replaces
  the existing text and proposes keywords/NAICS codes from what it reads.
  This is the single most important field in the system: it's what Claude
  reads for every fit score, proposal draft, and outreach email.
- **Keywords** — tiered High / Medium / Low. High-tier terms should be your
  core services (archival, digitization, digital preservation, HBCU, Black
  history); Medium are technical/adjacent terms (DACS, EAD, finding aid,
  metadata, oral history).
- **NAICS Codes** — mark the ones that apply to your work as Primary;
  Primary status affects scoring. Toggle from the table anytime.
- **Scoring & Filters** — points per keyword tier, points per NAICS match,
  region match, WOSB/EDWOSB set-aside match, plus a minimum score (1–10)
  and minimum dollar amount for digest inclusion.
- **API Keys** — Claude API key. Required for Claude Assistant, Draft
  Proposal, Draft Outreach Email, and email classification.
- **Data Sources** — SAM.gov API, USASpending API, Email Inbox, and web
  scrapes for AAM, ALA, SAA job boards, ArchiveGig, IMLS Grants, NEH
  Grants. Each can be disabled individually.
- **Automations** — SAM.gov Daily Digest, Grants.gov Daily Pull, and Daily
  Opportunity Digest. Manual triggers: Run SAM.gov Now, Run Grants.gov Now,
  Send Digest Now, Recalculate Scores, View Digest Log.
- **Backup** — download or email a full `.sql` inside a `.zip`. Daily /
  Weekly / Never. Restore instructions (Hostinger → phpMyAdmin → Import)
  are printed on the page. Restoring **replaces**, it does not merge.

> **Set backups to Daily.** Whether this host reliably keeps the database
> persisted across every restart is an open question (see `CLAUDE.md`) —
> until that's confirmed, a daily backup is the cheapest insurance you have.

## 1. Finding opportunities

Five sourcing surfaces. Each saves into a different table with different
semantics — this is deliberate and worth learning.

| Surface | What it searches | Save button | Lands in |
|---|---|---|---|
| SAM.gov Search | Live federal contract notices | Save | Opportunities |
| Grants.gov Search | Live open/forecasted federal grants | Save as Grant | Opportunities (Grant type) |
| IMLS Awards | Past IMLS grant recipients | Save as Target | Institutions |
| USASpending | Past federal awards | Save as Teaming Partner | Institutions |
| Email Inbox | Parsed bid-alert emails | Convert | Opportunities |

### SAM.gov Search
Filters: Keywords, NAICS Code, Set-Aside (9 options including WOSB and
EDWOSB), Posted Within (30/60/90 days, 6 months).

**Non-obvious:** SAM.gov searches do not go directly to `api.sam.gov`.
Hostinger blocks that outbound connection, so every search routes through a
Cloudflare Worker relay (see `RELAY.md`). If SAM search ever breaks, check
the relay row on Network Diagnostics first — not your API key.

### Grants.gov Search
Filters: Keywords, CFDA/Listing #, Status (Open & Forecasted / Open /
Forecasted / Closed), Eligibility (14 categories). No API key needed.

**Quirk:** Grants.gov keyword matching is loose — a term like "preservation"
will surface things like dam-safety or wildlife-monitoring grants alongside
real matches. Treat the result count as a starting pool, not a filtered
list. Result titles are decoded before display, so accented characters and
punctuation from the raw feed render correctly instead of as literal HTML
entities.

### IMLS Awards
The sharpest BD idea in the system. Searches organizations that have
already won IMLS money — proven federal-funding pursuers. Filters: Keyword,
State, Program Area (Museum Services / Library Services), Award Year range.
Shows award amount, ID, abstract, and period. **Save as Target** adds them
to Institutions.

**Data quality note:** IMLS/USASpending abstract text sometimes has a
character genuinely lost upstream in the source agency's original data
entry (long before it reaches this app) — most often an em-dash or curly
quote replaced by a stray character. The app cleans up the obvious case
(a stray mark wedged directly between two words, with no real question
mark ever looking like that) but can't reconstruct exactly what the
original character was, since it's gone before the data ever reaches here.

### USASpending Research
Same engine, different purpose: find who's already winning the work you
want. Filters: Keyword, NAICS, Awarding Agency, Award Type (Contracts /
Grants / IDVs), Year range. **Save as Teaming Partner** adds them to
Institutions.

**Quirk:** the year range filters on award activity, not start date. A
2023–2026 search can return awards that started in 2013 but were still
active in that window — that's correct behavior, just not obvious.

### Email Inbox
A live mailbox, filtered to opportunity-related mail by default. Each email
carries a Claude-generated relevance mark:
- `$` — plausibly relevant, worth opening
- `#` — safe to archive unread

Hover the mark to see the reason (e.g. `#` *"Generic bid digest; defense/
pharma/IT unrelated to archives"* vs. `$` *"Contract research archivist
position directly matches core expertise"*).

To convert an email to an opportunity:
1. **Single-opportunity email** → click **Convert** → a pre-filled
   opportunity form opens → review, edit, Save.
2. **Digest email** (BidMatch, GovExpert, 20+ listings) → click **Convert**
   → a blue banner appears → click **Parse & Import All** → all
   opportunities are checked by default → uncheck what you don't want, edit
   titles/dates → **Save Selected Opportunities**.

Converted emails show a green **Converted** badge. **Hide** removes from
view; **Archive** dismisses without converting. **Show All Emails** (top
right) reveals mail that was filtered out.

## 2. Logging an opportunity manually

**Opportunities → + Add**, or **+ New record** in the header.

Fields: Title (the only required field), Institution/Organization,
**Contact**, Type, Status, Region, Source, Source URL, Posted Date, Due
Date, Amount Min, Amount Max, Description/Notes, Star.

- **Type:** Government Contract · Grant · Freelance/Gig · Subcontract ·
  Other
- **Status:** New · Reviewing · Pursuing · Submitted · Awarded · Not
  Pursuing · Closed

**Important:** only Title is enforced. You can save a record with nothing
else filled in — nothing will stop you, and the record will score a bare
minimum and sit invisible in your funnel. Discipline on Type, Status, and
Due Date is on you.

### What happens on save
The alignment engine runs immediately, scoring 1–10 against your configured
keywords, NAICS codes, region, and set-aside rules — and it shows its work.
A generic description with no service language scores near-zero with a note
like *"No keyword, NAICS, region, or set-aside matches."* A description that
actually uses your service language (digitization, archival, preservation,
metadata, finding aid, etc.) scores much higher, with every matched term and
its tier listed out.

**Practical takeaway:** paste the actual solicitation text into
Description/Notes. The score is only as good as the text you give it — if
you summarize in your own words, you'll suppress your own score.

Use **Recalculate Scores** in Settings after changing keywords or NAICS
codes — existing records don't rescore themselves.

## 3. Moving it through the pipeline

⚠️ **Read this section carefully — it's the most confusing part of the
system, by design.**

There are two independent state fields on every opportunity, and they are
**intentionally** not synced to each other:

- **Status** (on the opportunity record): New → Reviewing → Pursuing →
  Submitted → Awarded / Not Pursuing / Closed. A simple top-level flag used
  for opportunity list filtering.
- **Stage** (on the pipeline record): Identified → Qualified → Pursuing →
  Proposal In Progress → Submitted → Negotiating → Awarded / Lost /
  Withdrawn. The finer-grained BD process tracker.

Why keep them separate instead of syncing automatically? Status is meant to
answer "where does this sit in my top-level triage," while Stage answers
"where exactly am I in actually pursuing and writing this." An opportunity
can sit at Status "Pursuing" for weeks while its Stage moves through several
steps of proposal work — collapsing them into one field would lose that
resolution. The trade-off: **you have to update both yourself.** This is
also explained directly on the Pipeline page (and in Getting Started) so
it's not a surprise mid-use.

### Adding to pipeline
1. Open the opportunity → **Add to Pipeline**.
2. Set **Stage**, **Probability** (%), **Expected Value** ($), **Next
   Action**, **Next Action Date**, **Go / No-Go Notes**.
3. Save. The opportunity detail page now shows an inline Pipeline panel
   with an **Update Stage** link.

Update from either the Pipeline table's **Edit** link or the opportunity's
**Update Stage** link. **Remove from Pipeline** is on the edit form.

**Behavior note:** Expected Value is a manually entered number, not
calculated — it is **not** probability-weighted. The Pipeline header total
is the raw sum of Expected Value across active items. If you want a
probability-weighted forecast (Probability × Expected Value), do that math
yourself; the system deliberately doesn't do it for you, since a manually
entered "expected value" and a calculated one are easy to conflate and the
raw sum is more honest about what was actually typed in.

**Weekly habit:** filter Pipeline by stage, confirm every active item has a
Next Action Date in the future.

## 4. Institutions, contacts, and communications

### Institutions
Relationship statuses: Target · Prospect · Partner · Client · Vendor. The
list sorts Client → Prospect → Target, then alphabetically, so your warmest
relationships surface first without filtering.

An institution detail page is the real hub of the system. It shows:
- Overview — status, type, address, region, phone, website
- Primary Contact — auto-surfaced from linked contacts
- Relationship notes
- Contacts (n) — with inline **+ Add**
- Communication Log (n) — inline logging form
- Proposals & Opportunities (n) — every opportunity linked to this org
- Contracts & Projects (n) — awarded work
- **✉️ Draft Outreach Email** — AI-generated, using your capability
  statement

Linking an opportunity to an institution immediately populates its
Proposals & Opportunities table; deleting the opportunity cleanly removes
it from there too.

### Logging a communication
1. Open the institution (or the contact — either page works).
2. In the Communication Log block, set Type (Email / Call / Meeting /
   Other), Direction (Outbound / Inbound), Date, Contact (dropdown of that
   institution's contacts), Subject/Summary, Notes.
3. Click **Log Communication**.

### Contacts
Filterable by institution. Every contact must belong to an institution —
CSV rows with a blank or non-matching institution are silently skipped.

### Funders
Types: Federal · State · Foundation · Corporate · Other. Tracks eligible
institution types, website, and giving notes. The Grants page filters by
funder. Funder names are deduplicated by normalized name (stripping an
"ABBREV — " prefix before comparing), so a Grants.gov save and a seeded
record for the same funder collapse into one row instead of creating a
near-duplicate.

### Bulk import
Institutions, Contacts, and Funders each have CSV import at the bottom of
their list page (upload file or paste text, 5 MB max, **Show CSV template**
button). Existing records matched by name are skipped, so re-running an
import is safe.

Settings also has one-click loaders: **Load Starter Institutions** (~55
orgs) and **Load African American Museums & Cultural Institutions** (~120
orgs). Both safe to run more than once.

## 5. Winning work: Projects and Award History

⚠️ **This is the one place the system is deliberately manual, not
automatic.**

Setting an opportunity's Status to Awarded does **not** create a Project or
an Award History entry by itself. That's on purpose — it keeps you in
control of exactly what becomes a permanent past-performance record instead
of the system silently generating one from every Awarded opportunity,
including ones you decide not to actually run as a tracked project.

**The process:**
1. Set the opportunity **Status** to Awarded.
2. Set the pipeline **Stage** to Awarded (separately — see §3).
3. Go to **Projects → + Add** and create the project by hand. Statuses:
   Active · On Hold · Complete · Cancelled.
4. Go to **Award History → + Add** and log the outcome by hand. Types:
   Government Contract · Grant · Subcontract · Other.

Award History is meant to become your past-performance record for future
proposals — including losses, so you can see your real win rate over time.
Backfilling it for past work is one of the highest-value data-entry tasks
in the system.

## 6. AI features

### Draft Proposal
On any opportunity: **Draft Proposal → Generate Draft with AI**. Takes
roughly 45–60 seconds — a "Claude is drafting your response…" message
appears, and the button doesn't visibly change state while it works, so it
can look frozen. Wait it out.

Output is a fully editable textarea, exportable via **📄 Download as Word**
or **📋 Copy to Clipboard**. The draft is context-aware: a record with no
stated requirements gets a reusable shell with bracketed placeholders and an
explicit "do not submit with placeholder text intact" warning, rather than
invented specifics.

### Draft Outreach Email
On any institution page. Uses your capability statement and the
institution's profile.

### Claude Assistant
Full-page chat at **Claude Assistant** in the sidebar. It has your company
profile, capability statement, and active pipeline as context. Supports
file attachment (📎) and **↻ Clear**. Use it to paste an RFP for a fit
read, request a proposal outline, or research an agency.

### Email classification
Runs automatically the first time an email loads in the inbox, using your
keyword list and capability statement.

## 7. Search, filters, and navigation

- Every list page has a filter bar with a **Filter** and **Clear** button.
  Filters are URL-driven (e.g. `/opportunities?status=New`), so you can
  bookmark saved views.
- Dashboard tiles are clickable and deep-link to filtered lists.
- **Bulk delete:** the Opportunities table shows checkboxes and a **Delete
  Selected** button when rows are present.
- Star any opportunity to flag it (★ toggle on the detail page).
- Deletes are guarded by a browser confirm dialog. Deleting an opportunity
  cascades correctly — its pipeline entry goes with it.
- Every module page has a collapsible **"How to use…"** panel — read them;
  they're kept in sync with the actual stage/field names now.
- **Global search** — the header search box searches across Opportunities,
  Institutions, Contacts, and Funders at once (`/search?q=`), not just
  Opportunities. Searching a contact's or institution's name returns that
  record directly instead of a false "no results."
- Sidebar count badges show **total** record counts for each section
  (not just open/active ones) — a completed Project still counts, so the
  badge never reads misleadingly as "empty."

## 8. Network Diagnostics

**System → Network Diagnostics.** Runs a genuinely live check on every page
load — nothing cached. Rows:
- General internet (Google) — should be Reachable
- SAM.gov API (direct) — **Blocked (expected)** — Hostinger blocks this at
  the firewall; it will always time out, and that's fine
- Grants.gov API, USASpending API — should be Reachable
- SAM.gov Relay (Cloudflare Worker) — should be Reachable

**How to read it:** the Relay row is what actually matters for SAM.gov.
The direct SAM.gov API row is expected to fail forever. A 403 or 400
response on some rows is healthy here — it means the host answered at all.

## Building relationships, not just chasing bids

- **New institution you want to target?** Add it (Target status), even
  before you've made contact. Move it through Target → Prospect → Partner
  → Client as the relationship develops.
- **No contact there yet?** That's fine — Institutions and Projects don't
  require one. Add a contact the moment you have a name; every contact does
  require an institution, since a contact floating with no organization
  isn't useful later.
- **Cold outreach?** Bid Guides has ready-to-use email templates — copy,
  personalize the bracketed parts, attach the current capability statement
  from Settings, send.
- **Quick-add an institution mid-form** — on the Add Contact page, "+ New"
  next to the Institution field creates one inline without losing what
  you've already typed.

## Keeping the system itself healthy

- **Settings → Company Profile** is the one place your business identity
  lives — it feeds every AI draft and evaluation, so keep it current.
- **Settings → NAICS Codes / Keywords** drive what SAM.gov/Grants.gov
  searches match and how the AI fit score is weighted — revisit these if
  the scores start feeling off.
- **Settings → Backup** — download a database backup anytime, or set a
  schedule to have one emailed. Worth doing before any big changes, and
  worth setting to Daily given the open question about restart persistence
  (see `CLAUDE.md`).
- **Bid Guides** encode the actual evaluation criteria and process for
  contracts, grants, and subcontracts — read the relevant one before
  writing a real proposal, not just when curious.

## When something looks broken

Check whether the site's actually running the latest version first —
deploys on this host require a manual fresh-ZIP upload and restart, so
"it's not working" is very often "the fix hasn't been deployed yet" rather
than a new bug (see `CLAUDE.md`). If it really is broken, that's a normal
part of using software day-to-day — note what you were doing and report it
like any other bug.
