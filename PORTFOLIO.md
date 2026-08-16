# Legacy GovCon

*A self-hosted business development and pipeline intelligence system for a
specialist archival firm.*

> **Note before publishing this anywhere:** replace this note with real
> screenshots of the Dashboard, an Opportunity detail page (showing the AI
> fit score), and the Institutions/Contacts cross-linking. The writeup
> below is accurate; it just needs visuals.

## The problem

Legacy Planning & Preservation Ltd. does archival management, digitization,
records management, and preservation work for museums, libraries, and
cultural institutions. Winning that work means tracking opportunities
across a fragmented landscape: federal contract solicitations on SAM.gov,
federal grants on Grants.gov, foundation and state funders, subcontracting
opportunities with primes, and freelance archival postings on niche job
boards.

The commercial answer was a subscription BD platform at $1,199 to set up
and $199/month thereafter. That pricing model has a structural problem
beyond cost: the data lives on someone else's server, the feature set is
tuned for generalist government contractors rather than cultural-heritage
specialists, and the entire relationship history walks out the door the
moment the subscription lapses. Retention is the product.

## The solution

Legacy GovCon is a purpose-built replacement — self-hosted, owned outright,
and tuned to one firm's actual market. It unifies five distinct sourcing
channels and five opportunity types into a single pipeline, on
infrastructure the business controls, with a full database export
available on demand.

## What it does

- **One pipeline, five kinds of work.** Most BD tools assume you're
  chasing federal contracts. This one treats government contracts, grants,
  freelance/gig archival work, subcontracts, and one-off consulting as
  first-class citizens of the same funnel. That's a deliberate
  architectural decision, not a compromise — a specialist firm's revenue
  genuinely arrives through all five doors, and forcing them into separate
  systems means none of them gets managed properly. Every type moves
  through the same stages, scores against the same criteria, and rolls
  into the same forecast.
- **Nine live data sources.** SAM.gov and USASpending APIs, Grants.gov, an
  IMLS grant-award index, parsed bid-alert email, and web-scraped postings
  from the American Alliance of Museums, American Library Association,
  Society of American Archivists, ArchiveGig, and NEH — each independently
  toggleable, with automated daily pulls and an emailed digest.
- **A full relationship graph.** Institutions — federal agencies, HBCUs,
  museums, historical societies, prime contractors — each carry
  relationship status, contacts, a communication log, linked proposals,
  and awarded projects. Funders carry giving priorities and eligibility
  rules. Bid-writing playbooks cover government contracts, grants and
  NOFOs, subcontracting and teaming, plus segment-specific outreach
  templates.
- **Real cross-entity search.** A single header search box queries
  Opportunities, Institutions, Contacts, and Funders at once — so looking
  up a person or an organization doesn't require knowing which specific
  list page they live on.

## Four things worth looking at

### 1. Explainable opportunity scoring

Every opportunity is scored 1–10 the moment it's saved, against a
configurable rubric: tiered keyword matches, NAICS codes with
primary/secondary weighting, preferred-region matching, and WOSB/EDWOSB
set-aside detection. Point values for each factor are user-editable, and a
minimum score threshold gates what reaches the daily digest.

The part that matters is that the score shows its work. It doesn't return
a bare number — it returns the number *and* the reasoning: which keywords
matched, at which tier, and which factors (NAICS, region, set-aside) hit or
missed. When nothing matches, it says so plainly instead of guessing. A
black-box relevance score teaches you nothing; a score that names its
evidence tells you whether to trust it, and tells you exactly which
keyword to add when it's wrong.

### 2. A Cloudflare Worker relay solving a real infrastructure constraint

The production host blocks outbound connections to `api.sam.gov` at the
firewall. Rather than migrating hosts or abandoning the integration,
SAM.gov traffic routes through a purpose-built Cloudflare Worker acting as
a relay.

What elevates this from a workaround to good engineering is the
diagnostics page built around it. It tests general internet reachability,
the direct SAM.gov connection, Grants.gov, USASpending, and the relay — as
five separate live checks on every page load, nothing cached. The
known-blocked direct connection is labeled "Blocked (expected)" rather than
shown as a failure, with an inline explanation of why it will always time
out and why that's fine. That's a developer building an on-call runbook
into the product for their future self.

### 3. Per-message AI triage with visible reasoning

The system ingests bid-alert digests from multiple aggregators — some
carrying dozens of listings a day, most irrelevant to a cultural-heritage
specialist. Each incoming email is classified by Claude against the firm's
capability statement and marked `$` (worth opening) or `#` (safe to
archive unread), with the reasoning attached on hover — e.g. `#` *"Generic
bid digest; defense/pharma/IT unrelated to archives"* vs. `$` *"Contract
research archivist position directly matches core expertise."*

Digest emails split into individually reviewable opportunity cards, all
pre-checked, editable before import. The design respects a genuine
constraint: automated triage is only trustworthy when you can audit it, so
every judgment is shown alongside its justification.

### 4. Sourcing surfaces that write to the right table

The four research modules aren't four copies of one search box. Each
writes into the data model with correct semantics. SAM.gov results save as
opportunities. Grants.gov results save as grants. IMLS award recipients
save as institution *targets* — the underlying insight being that an
organization that has already won federal funding is a warmer prospect
than one that hasn't, so a grant-award database doubles as a qualified
lead list. USASpending results save as teaming *partners*, because the
firms already winning this work are prime contractors worth approaching,
not competitors to avoid.

Same query engine underneath; four different strategic uses, each landing
where it belongs.

## Notable engineering decisions

- **Server-rendered Express/EJS over a SPA framework** — a deliberate
  choice for a single-admin internal tool: simpler deployment, no
  client-side state-management overhead, and every page is a real URL.
- **Resilient by default against a constrained hosting environment.**
  Deployed on shared Node.js hosting with no reliable outbound access to
  some government APIs (solved with the Cloudflare Worker relay above), no
  persistent local disk across deploys (the company logo is stored as a
  database blob, not a file, for exactly this reason), and no fragile
  schema migrations (new tables self-provision via `CREATE TABLE IF NOT
  EXISTS` at startup rather than depending on a manual step someone has to
  remember).
- **Global error handling that fails loud, not silent** —
  `express-async-errors` plus process-level safety nets mean one bad
  request can't take the whole app down for every user, and a real error
  message surfaces instead of an indefinite spinner.
- **Two independent state fields, on purpose.** Opportunity Status and
  Pipeline Stage track different things (top-level triage vs. fine-grained
  BD process) and are deliberately not auto-synced — a design decision
  documented directly in the product, not just left for the user to
  discover the hard way.
- **A deliberate two-tier design system** — a branded navy/gold sidebar
  distinct from a dense, editorial-styled ("Broadsheet") content area built
  around a real design token system (type scale, a cyan/magenta accent
  pairing with defined semantic roles, tabular numerals for financial
  figures) rather than an off-the-shelf admin theme.

## Stack

Node.js · Express · EJS · MySQL (`mysql2`) · Anthropic Claude API (fit
scoring, proposal drafting, outreach email generation, capability-statement
parsing) · IMAP/SMTP for the email inbox and digest · Cloudflare Workers
(SAM.gov API relay) · `node-cron` for scheduled pulls and digests.
Self-contained backup and restore via a single archived database export.
CSV import across institutions, contacts, and funders, with name- and
normalized-name matching so imports and re-imports are safely repeatable.

## Summary line

*For a portfolio header or LinkedIn post:*

> I replaced a $1,199-setup, $199/month government contracting platform
> with a self-hosted BD system built for how my business actually finds
> work — federal contracts, grants, subcontracts, and freelance archival
> gigs in one pipeline, scored against my own capability statement, on
> infrastructure I own and data I can export any time.

*Alternate, shorter:*

> Built my own government contracting pipeline system to replace a
> $199/month subscription — nine live data sources, explainable AI
> opportunity scoring, and a database I actually own.
