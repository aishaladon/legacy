# Legacy GovCon

*A purpose-built business development system for a government contracting
and grants consultancy — built to replace a legacy database and a patchwork
of spreadsheets with one place to find, evaluate, pursue, and win work.*

> **Note before publishing this anywhere:** replace this note with real
> screenshots of the Dashboard, an Opportunity detail page (showing the AI
> fit score), and the Institutions/Contacts cross-linking once the app is in
> a state worth showing off. The writeup below is accurate; it just needs
> visuals.

## The problem

Legacy Planning & Preservation Ltd. pursues government contracts, grants,
and freelance archival work — three very different sourcing channels (SAM.gov
solicitations, Grants.gov/IMLS NOFOs, gig postings on sites like ArchiveGig)
that all needed to funnel into one decision process: *is this worth
pursuing, and if we win it, who do we know there and what have we done for
them before?* Before this system, that lived across email inboxes, a legacy
ASP.NET database, and memory. Nothing connected a won contract back to the
relationship that led to it, or forward to the next proposal that needed it
as a past-performance reference.

## What it does

- **Aggregates opportunities** from SAM.gov, Grants.gov, IMLS, USASpending,
  and an email inbox that automatically parses bid-alert digest emails
  (single listings or bulk digests) into structured, importable opportunity
  records — no manual re-typing from an email.
- **Scores fit automatically** — a deterministic weighted score (NAICS match,
  keyword relevance, set-aside eligibility, region) plus an AI-generated
  narrative explanation, so triage takes seconds instead of a full read of
  every notice.
- **Tracks the pipeline** from first discovery through award — stages, win
  probability, next-action dates — so nothing pursued quietly goes stale.
- **Links every record together**, Airtable-style: an Institution shows its
  Contacts, active Projects, Opportunities, and full Communication Log in
  one place; a Contact shows their Institution's Projects; a Project shows
  its Pipeline stage. Deliberately *not* merged into a single view, since
  real relationships are often partial — an institution with no contact yet
  is still a valid, trackable target.
- **Drafts with AI, grounded in real data** — proposal drafts, capability
  statement suggestions, and personalized outreach emails are generated
  using the company's actual NAICS codes, certifications, and capability
  statement, not generic boilerplate.
- **Automates what should be automatic** — a daily opportunity digest email,
  scheduled SAM.gov/Grants.gov pulls, and scheduled database backups, all
  running inside the app itself with no external cron infrastructure.
- **Records past performance as a byproduct of doing the work**, not a
  separate chore — a won opportunity becomes a Project, which becomes an
  Award History entry, which future proposals pull real detail from instead
  of re-writing it from memory.

## Notable engineering decisions

- **Server-rendered Express/EJS over a SPA framework** — a deliberate choice
  for a single-admin internal tool: simpler deployment, no client-side
  state-management overhead, and every page is a real URL.
- **Resilient by default against a constrained hosting environment.**
  Deployed on shared Node.js hosting with no reliable outbound access to
  some government APIs (solved with a Cloudflare Worker relay for SAM.gov),
  no persistent local disk across deploys (the company logo is stored as a
  database blob, not a file, for exactly this reason), and no automatic
  schema migrations (new tables self-provision via `CREATE TABLE IF NOT
  EXISTS` at startup rather than depending on a manual step).
- **Global error handling that fails loud, not silent** — `express-async-errors`
  plus process-level safety nets mean one bad request can't take the whole
  app down for every user, and a real error message surfaces instead of an
  indefinite spinner.
- **A deliberate two-tier design system** — a branded navy/gold sidebar
  distinct from a dense, editorial-styled ("Broadsheet") content area built
  around a real design token system (type scale, a cyan/magenta accent
  pairing with defined semantic roles, tabular numerals for financial
  figures) rather than an off-the-shelf admin theme.

## Stack

Node.js · Express · EJS · MySQL · Anthropic Claude API (fit scoring, proposal
drafting, outreach email generation, capability-statement parsing) · IMAP/
SMTP for the email inbox and digest · Cloudflare Workers (API relay).
