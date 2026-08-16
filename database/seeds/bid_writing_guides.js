// Starter Bid Writing Guides for Legacy Planning & Preservation Ltd.
// Grounded in current public guidance (NARA digitization regulations, GSA
// Multiple Award Schedule SIN structure, IMLS/NEH grant review practice,
// and standard federal source-selection practice under FAR 15.305) as of
// August 2026 — verify specifics against the actual solicitation or NOFO
// before every submission, since program-level requirements change.

const GOV_CONTRACT_GUIDE = `HOW TO USE THIS GUIDE
Read this alongside the actual solicitation, not instead of it. Nothing here overrides what's explicitly required in a specific RFP/RFQ — always follow that document's exact instructions over anything generic below.

STEP 1 — TRIAGE THE NOTICE
Quick Product/Service Code (PSC) reference for the notices in your MyBidMatch/SAM.gov digest — the single letter prefixing each bullet (e.g. "D --", "R --"):
  R -- Professional & support services (records management, archival consulting, project management) — direct fit for NAICS 541990 / 541611
  D -- IT & telecommunications (digitization platforms, data hosting/migration) — fits NAICS 518210 / 541511 / 541512
  T -- Photographic, mapping & printing services — fits NAICS 541922, our core digitization NAICS
  U -- Education & training services — fits NAICS 611610 / 611420 if training delivery is in scope
  Other letters (A, B, C, J, etc.) rarely fit our services — skim past these unless the title clearly matches archives/library/preservation work.

Then check:
  - Notice type — a "Sources Sought" or "RFI" has no bid to submit yet; it's market research. Respond anyway with a tailored capability statement (see the Template guide) even if you won't pursue the eventual award — contracting officers use qualified small-business responses to justify a set-aside under the Rule of Two, and a competitive full-and-open procurement can become a much easier set-aside because you responded.
  - Set-aside status (WOSB / EDWOSB / 8(a) / SDVOSB / full-and-open). We hold WOSB, EDWOSB, and MBE — confirm before investing time.
  - NAICS code and size standard on the notice against our primary codes (519120, 541990, 561410, 541922).

STEP 2 — READ THE FULL PACKAGE
  - Pull the actual Statement of Work / Performance Work Statement from SAM.gov or the issuing site — never rely on the digest email summary alone.
  - Build a compliance checklist directly from Section L (Instructions to Offerors) and Section M (Evaluation Criteria) if this is a formal RFP. Simpler RFQs usually fold both into a short paragraph near the top or bottom of the notice.
  - Note the response deadline (with time zone), submission method, and page/format limits exactly as stated — noncompliant submissions are routinely rejected without evaluation regardless of quality.
  - Note required forms (SF-33, SF-1449, reps & certs, wage determinations) early — these take longer to assemble than the technical narrative.

STEP 3 — GO/NO-GO
Score against: fit to our capabilities, realistic turnaround given the deadline, level of competition (full-and-open vs. small-business set-aside), and value versus effort — a $15K DIBBS-style RFQ needs a two-page quote, not a 20-page proposal. Identify early if we need a teaming partner for any scope outside our core capability (see the Subcontract & Teaming Playbook).

STEP 4 — WRITE THE RESPONSE
Standard structure for a Technical/Management proposal (adjust to what Section L actually requires):
  1. Cover letter / transmittal — company name, UEI, CAGE, point of contact, statement of compliance with all terms
  2. Technical approach — address every task in the SOW/PWS in the order it's written; evaluators score by finding your response to each requirement, not by narrative flow
  3. Management approach — staffing plan, key personnel, quality control approach, schedule
  4. Past performance — 2-3 relevant projects: client, contract value, period of performance, scope, outcome (pull detail from the Institutions module)
  5. Price/cost proposal — build from labor categories and hours; confirm whether the solicitation wants firm-fixed-price, T&M, or cost-reimbursement
  6. Required reps & certs / forms

TYPICAL EVALUATION WEIGHTING (FAR 15.305 practice — always confirm the actual weights published in that solicitation's Section M, this varies by RFP)
  Technical approach:  40-60%
  Past performance:    20-30%
  Management approach: 15-25%
  Price:                20-40% (evaluated for realism/reasonableness, not always separately scored)

NARA DIGITIZATION COMPLIANCE — KNOW THIS COLD FOR OUR SECTOR
Federal digitization requirements are now codified in 36 CFR Part 1236: Subpart D covers temporary records, Subpart E covers permanent records (effective June 2023). Since July 1, 2024, agencies must digitize permanent analog records according to these regulations before transferring them to NARA. The regulations are organized around four success-criteria areas — cite these by name in technical proposals, evaluators who know this space will notice if you don't:
  1. Policies — documented digitization policy and procedures
  2. Access — the digitized records must be as accessible/usable as the originals
  3. Systems — quality management, imaging systems meeting NARA specs
  4. Disposition — intellectual and physical control of source records, a records inventory identifying completeness and gaps, and preserved relationships between source records through the digitization process

STRATEGIC OPPORTUNITY — GSA SCHEDULE SIN 518210DC
GSA's Multiple Award Schedule created a subgroup under SIN 518210DC (Document Conversion & Digitization Services) specifically for "NARA-Compliant Digitization Services for Federal Records," tied directly to the 36 CFR 1236 regulations above. As of the most recent public reporting only a small number of contractors nationally hold this subgroup designation — for a specialized archives/digitization firm like ours, pursuing GSA Schedule with this subgroup is a real differentiator worth investing in; it opens a stream of task-order competitions limited to a much smaller competitive field than open-market SAM.gov postings.

WHAT EVALUATORS ACTUALLY LOOK FOR IN OUR SECTOR
  - Direct evidence of experience with archival/records standards (36 CFR 1236, ISO 15489, DoD 5015.2 where relevant) — cite a project where you applied it, don't just claim expertise
  - Realistic production-rate claims for digitization volume — evaluators who've run these programs can tell an inflated rate from a credible one
  - A clear chain-of-custody / data-security approach for handling original or sensitive records
  - Small-business/socio-economic status documented correctly — certification numbers, not just a claim

COMPLIANCE CHECKLIST (copy into each pursuit)
  [ ] Responded before the exact deadline (note time zone)
  [ ] Submission method matches instructions exactly (portal vs. email vs. mail)
  [ ] Every Section L requirement has a corresponding section in the response
  [ ] Every Section M evaluation factor is addressed somewhere in the response
  [ ] Page/format limits respected
  [ ] Required forms attached and signed
  [ ] UEI, CAGE, and SAM.gov registration current (check expiration before submitting)
  [ ] Price proposal ties back to the technical approach

FURTHER READING (verify current details before each pursuit — these change)
  https://www.archives.gov/records-mgmt/policy/digitization
  https://gormgroup.com/2023/12/15/gsa-introduces-new-sin-subgroup-for-518210dc-nara-compliant-digitization-services-for-federal-records/
  https://samsearch.co/guides/sources-sought
  https://www.acquisition.gov/far/15.305`;

const GRANT_GUIDE = `HOW TO USE THIS GUIDE
Written around our primary funders — IMLS (Institute of Museum and Library Services) and NEH (National Endowment for the Humanities) — plus state and foundation funders (California Humanities, California Arts Council, Mellon Foundation, Kresge Foundation, CLIR, HathiTrust). Read the actual NOFO for the specific program before writing — federal grant review criteria are published per-program and can differ meaningfully even within the same agency.

STEP 1 — CONFIRM ELIGIBILITY AND FIT
  - Confirm our institution type matches what the funder lists as eligible (see the Funders module for eligible_institution_types per funder).
  - Confirm SAM.gov registration and Grants.gov Workspace access are current — federal applications route through Grants.gov and require an active SAM.gov UEI (same UEI as our contracting profile: W9MNGXEFKBS9).
  - Read the NOFO's required priority areas closely. Programs like IMLS National Leadership Grants for Libraries (NLG-L) fund projects that "develop, enhance, or adapt replicable practices, programs, models, or tools to strengthen library and archival services" — an application that doesn't clearly map to that replicable/national-impact framing is a weak fit regardless of narrative quality. Note: cost sharing isn't scored in NLG-L review, but it is an eligibility requirement for certain project types — check the specific NOFO.

STEP 2 — BUILD THE APPLICATION PACKAGE
Standard components across most federal humanities/library grant programs:
  1. Abstract / Project Summary — one paragraph, written last: what will be done, why it matters, the outcome
  2. Statement of Need / Significance — grounded in evidence (condition assessments, usage data, community need), not assertion
  3. Project Design / Work Plan — tasks, timeline, deliverables, and who's responsible; reviewers score feasibility here more than ambition
  4. Diversity, Equity, Accessibility, Inclusion — increasingly scored or required across IMLS and NEH programs; address concretely (who benefits, how access expands) rather than as boilerplate
  5. National/Regional Impact — how results will be shared or reused beyond our organization (open licensing, published methodology, replicable tools)
  6. Organizational Capacity — our track record on similar work; pull directly from past performance / prior institution relationships
  7. Budget and Budget Narrative — every line item justified in the narrative; indirect cost rate must match our federally negotiated rate (or the de minimis rate) if applicable
  8. Letters of Support / Commitment — request early from any partner institutions; these take the longest to collect

STEP 3 — WRITE FOR THE REVIEW PANEL, NOT JUST THE PROGRAM OFFICER
NEH peer reviewers rate each application section using a defined scale — Excellent, Very Good, Good, Some Merit, Not Competitive — against published criteria that typically include: humanities significance, the applicant's abilities and qualifications, clarity of expression, and feasibility of design/cost/work plan. Reviewers are often generalists, not specialists in archives — write the narrative free of jargon and technical shorthand so a non-specialist panelist can follow and score it on first read.

STEP 4 — REVIEW BEFORE SUBMISSION
  - Read the narrative against the NOFO's stated review criteria section by section — score against those criteria specifically, not against "is this well written"
  - Confirm formatting matches exactly (font, margin, page limit) — federal grant portals will sometimes reject, or the panel will simply stop reading past the limit
  - Confirm every required attachment is included (budget, budget narrative, letters, resumes/CVs, indirect cost rate agreement)
  - Submit with buffer before the deadline — Grants.gov and IMLS's application portal have had submission-day outages with zero grace period

COMPLIANCE CHECKLIST (copy into each pursuit)
  [ ] Eligibility confirmed against this specific NOFO (not just the funder generally)
  [ ] SAM.gov / Grants.gov registration current
  [ ] Every required NOFO section present and in the NOFO's required order
  [ ] Page limit and formatting exactly matched
  [ ] Budget narrative justifies every line item
  [ ] Letters of support/commitment collected and attached
  [ ] Submitted with time buffer before the deadline

FURTHER READING (verify current details before each pursuit — programs change year to year)
  https://www.imls.gov/find-funding/funding-opportunities/grant-programs/national-leadership-grants-for-libraries
  https://www.neh.gov/grants/application-process
  https://www.neh.gov/blog/tips-applying-preservation-access-award`;

const SUBCONTRACT_GUIDE = `HOW TO USE THIS GUIDE
Use this when we're pursuing work as a subcontractor to a prime, or bringing in a subcontractor/teaming partner to cover a scope gap — e.g. a prime needs archival expertise on a larger IT modernization contract, or we need an IT integrator to complement our digitization/records management scope.

STEP 1 — DECIDE: PRIME OR SUB ON THIS ONE?
  - If the requirement is mostly outside our core NAICS (519120, 541990, 561410, 541922) but includes an archives/records/digitization component, we're likely a strong subcontractor candidate to a larger IT or facilities prime.
  - If we're prime and the requirement includes work outside our core scope, identify a teaming partner rather than declining the pursuit or overstating our own capability.
  - Primes holding small-business set-aside contracts often have their own subcontracting-plan goals to meet (FAR 52.219-9) — a specialized small business like ours can be genuinely useful to them for that reason alone, independent of our technical fit.

STEP 2 — FINDING AND VETTING A TEAMING PARTNER
  - Check the Institutions module for prior relationships before cold outreach — a warm past-performance relationship is worth more than a larger but unfamiliar partner.
  - Confirm the partner's certifications and past performance are current and relevant to this specific solicitation, not just generally reputable.
  - For subcontracts under a small-business set-aside prime contract, confirm the prime is genuinely meeting its own limitation-on-subcontracting requirements — this affects how much of the total contract value can legitimately flow to us.

STEP 3 — THE TEAMING AGREEMENT
Get a signed Teaming Agreement before investing real proposal-writing time — a verbal commitment isn't enough. Cover:
  1. Scope of work we're responsible for if the team wins
  2. Estimated share of contract value / labor hours
  3. Exclusivity — is the prime teaming with us exclusively for this bid, or hedging with multiple subs?
  4. Flow-down clauses — which prime-contract terms (FAR clauses, security requirements, reporting) apply to us
  5. Data rights and confidentiality — especially important given the sensitive nature of archival/records material we may handle
  6. What happens if the team doesn't win, and what happens to the subcontract if awarded

STEP 4 — WRITING OUR PORTION OF A TEAMED PROPOSAL
  - Write our resume/capability section to the same standard as if we were prime — evaluators read subcontractor sections closely on any requirement where a sub carries a meaningful share of the technical work
  - Confirm with the prime how our past performance and staffing will be presented (named separately, or blended into the prime's overall response) and make sure it's accurate
  - Provide realistic, defensible pricing for our scope only — don't pad or lowball to make the total bid competitive; that's the prime's problem to solve, not ours to solve by misquoting

COMPLIANCE CHECKLIST (copy into each pursuit)
  [ ] Signed Teaming Agreement in place before significant proposal effort
  [ ] Our scope, hours, and price are clearly and separately defined
  [ ] Flow-down clauses reviewed — do we meet all of them (clearances, certifications, insurance)?
  [ ] Our past performance references are accurate as presented in the prime's proposal
  [ ] Confirmed which of us (prime or sub) handles specific compliance items (invoicing, reporting, security)`;

const CAPABILITY_TEMPLATE = `HOW TO USE THIS GUIDE
Copy the sections below directly into proposals, Sources Sought / capability-statement responses, and grant "organizational capacity" sections. Sources Sought responses should NOT be a generic brochure — tailor the capability paragraph point-by-point to the specific requirement in that notice, then paste the standing identifiers and past-performance blocks below as-is. Update anything in [brackets] with pursuit-specific detail.

COMPANY OVERVIEW (boilerplate paragraph)
Legacy Planning & Preservation Ltd. provides archival management, records management, historic preservation consulting, and digitization services to museums, libraries, archives, and government agencies. [Insert 1-2 sentences on years in business / founding focus / geographic reach.]

CORE COMPETENCIES
  - Archival processing, arrangement, and description
  - Records management program design and implementation
  - Digitization and photographic reproduction of archival and historic materials
  - Historic preservation planning and consulting
  - [Add or remove to match this pursuit's stated needs — point-by-point, not generic]

COMPANY IDENTIFIERS (keep current — verify against SAM.gov before every submission)
  CAGE Code: 9XVN3
  UEI: W9MNGXEFKBS9
  SAM.gov registration: Active — [confirm expiration date before each submission]
  Certifications: Women-Owned Small Business (WOSB), Economically Disadvantaged Women-Owned Small Business (EDWOSB), Minority Business Enterprise (MBE)
  Primary NAICS Codes: 519120 (Libraries & Archives), 541990 (Other Professional & Technical Services), 561410 (Document Preparation Services), 541922 (Photographic Services / Digitization)
  Secondary NAICS Codes: 712110 (Museums), 611610 (Fine Arts Schools/Training), 518210 (Computing Infrastructure & Hosting), 541511/541512 (Computer Programming/Systems Design), 541611 (Administrative Management Consulting), 561990 (All Other Support Services), 611420 (Computer Training)

PAST PERFORMANCE TEMPLATE (repeat this block per project — pull real detail from the Institutions module for each pursuit)
  Client: [Institution name]
  Contract/Project value: [$ amount]
  Period of performance: [Start - End]
  Scope: [1-2 sentence description]
  Outcome/Result: [Quantified result where possible — volume digitized, records processed, timeline met or beat]
  Reference contact: [Name, title, phone/email — confirm they're willing to be contacted before listing]

DIFFERENTIATORS (adapt per pursuit — don't reuse verbatim every time, evaluators notice generic language)
  - [Specific technical differentiator relevant to this NAICS/PSC]
  - Digitization workflow aligned to 36 CFR Part 1236 (NARA's digitization regulations for temporary and permanent federal records)
  - [Small business status advantage if this is a set-aside]

STANDARD CLOSING / TRANSMITTAL LANGUAGE
"Legacy Planning & Preservation Ltd. appreciates the opportunity to respond to [solicitation number/title]. We are prepared to begin performance within [X] days of award and welcome the opportunity to discuss our approach further. Please direct questions to [name, title, phone, email]."`;

const OUTREACH_GOV_TEMPLATE = `HOW TO USE THIS TEMPLATE
For federal, state, city, and county agency contacts — procurement officers, small-business liaisons, or program staff at an agency we want on our bidder's list. Personalize [Contact Name / Procurement Officer] and attach the current capability statement (Settings -> Company Profile) before sending.

SUBJECT: Archival & Digitization Services — Introducing Legacy Planning & Preservation Ltd.

Dear [Contact Name / Procurement Officer],

My name is Aisha LaDon Abdul Rahman, and I am the founder and principal consultant of Legacy Planning & Preservation Ltd., a certified small business based in Roseville, California, specializing in archival management, digitization, metadata creation, and collection management for public institutions.

I am writing to introduce our firm and share our capability statement for your review, in the event that upcoming procurement needs align with our services. Legacy P&P holds the following certifications and registrations: Woman-Owned Small Business (WOSB), Economically Disadvantaged Woman-Owned Small Business (EDWOSB), and Minority Business Enterprise (MBE), with an active SAM.gov registration (CAGE 9XVN3, UEI W9MNGXEFKBS9).

Our core services include:
  - Archival management and processing
  - Digitization of physical and audiovisual materials
  - Collection management system implementation (CollectiveAccess, ArchivesSpace, Omeka)
  - Metadata creation and finding aid development
  - Records management consulting
  - Training and capacity building for library, archive, and museum staff

I hold a Master's in Library and Information Science from San Jose State University, over twenty years of hands-on archival and genealogical research experience, and have completed digitization projects including a multi-thousand-document project for the Lewis Latimer House Museum in New York City.

I would welcome the opportunity to be added to your bidder's list or vendor database, and I have attached our capability statement for your records. Please let me know if there is a specific process for small business vendor registration with your agency, or if a brief call would be helpful to discuss upcoming needs.

Thank you for your time and consideration.

Warm regards,
Aisha LaDon Abdul Rahman, MLIS
Founder & Principal Consultant
Legacy Planning & Preservation Ltd.
info@legacypnp.ltd
(916) 934-2273
legacypnp.ltd`;

const OUTREACH_SMALL_INST_TEMPLATE = `HOW TO USE THIS TEMPLATE
For smaller museums, historical societies, HBCUs, and academic institutions — organizations that need archival support but may not have the budget or capacity for a large firm. Personalize [Contact Name] and attach the current capability statement before sending.

SUBJECT: Personalized Archival & Digitization Support — Legacy Planning & Preservation Ltd.

Dear [Contact Name],

My name is Aisha LaDon Abdul Rahman, and I am the founder of Legacy Planning & Preservation Ltd., an archival and heritage preservation consultancy based in Roseville, California. I focus on working closely with smaller museums, historical societies, and academic institutions that often need high-quality archival support but may not have the budget or capacity for a large firm.

As a solo consultant, I bring the same level of expertise as larger organizations, including a Master's in Library and Information Science, over twenty years of archival and genealogical research experience, and hands-on project work such as a large-scale digitization project for the Lewis Latimer House Museum in New York City, but with a personalized, flexible approach tailored to smaller institutions and budgets.

My services include:
  - Digitization of documents, photographs, and audiovisual materials
  - Archival processing and collection management
  - Metadata creation and finding aid development
  - Collection management system setup and training (CollectiveAccess, ArchivesSpace, Omeka)
  - Consulting on long-term preservation strategy
  - Staff training and capacity building

I have a particular interest and specialization in African American heritage and culture, including genealogical research and descendant community connections, though I work across all collection types and institutional histories.

I have attached our capability statement, which outlines our services, certifications, and past project work in more detail. I would love the opportunity to learn more about your collection needs and discuss how we might be able to help, whether through a small project, an ongoing consulting relationship, or a one-time assessment.

Please feel free to reach out by email or phone, or let me know a convenient time for a brief call.

Warm regards,
Aisha LaDon Abdul Rahman, MLIS
Founder & Principal Consultant
Legacy Planning & Preservation Ltd.
info@legacypnp.ltd
(916) 934-2273
legacypnp.ltd`;

const OUTREACH_SHORT_TEMPLATE = `HOW TO USE THIS TEMPLATE
Short, universal version for cold outreach or a quick follow-up when a longer introduction isn't warranted yet. Personalize [Contact Name] and attach the current capability statement before sending.

SUBJECT: Introducing Legacy Planning & Preservation Ltd.

Hello [Contact Name],

I wanted to briefly introduce myself and my consultancy, Legacy Planning & Preservation Ltd. I specialize in archival management, digitization, and collection preservation, with a focus on supporting smaller museums, historical societies, and cultural institutions.

I have attached my capability statement for your reference. If you ever have digitization, cataloging, or archival project needs, I would love to be considered as a resource, no obligation, just an open door for future collaboration.

Thank you for your time, and please don't hesitate to reach out.

Best,
Aisha LaDon Abdul Rahman, MLIS
Legacy Planning & Preservation Ltd.
info@legacypnp.ltd | (916) 934-2273 | legacypnp.ltd`;

const guides = [
  {
    title: 'Capability Statement & Reusable Boilerplate',
    opportunity_type: 'Government Contract',
    is_template: 1,
    sort_order: 5,
    content: CAPABILITY_TEMPLATE
  },
  {
    title: 'Outreach Email — Government, City & County Agencies',
    opportunity_type: 'Other',
    is_template: 0,
    sort_order: 40,
    content: OUTREACH_GOV_TEMPLATE
  },
  {
    title: 'Outreach Email — Small Museums, Historical Societies & HBCUs',
    opportunity_type: 'Other',
    is_template: 0,
    sort_order: 41,
    content: OUTREACH_SMALL_INST_TEMPLATE
  },
  {
    title: 'Outreach Email — Short Follow-Up / Cold Outreach',
    opportunity_type: 'Other',
    is_template: 0,
    sort_order: 42,
    content: OUTREACH_SHORT_TEMPLATE
  },
  {
    title: 'Government Contract Response Playbook',
    opportunity_type: 'Government Contract',
    is_template: 0,
    sort_order: 10,
    content: GOV_CONTRACT_GUIDE
  },
  {
    title: 'Grant & NOFO Proposal Playbook',
    opportunity_type: 'Grant',
    is_template: 0,
    sort_order: 20,
    content: GRANT_GUIDE
  },
  {
    title: 'Subcontract & Teaming Playbook',
    opportunity_type: 'Subcontract',
    is_template: 0,
    sort_order: 30,
    content: SUBCONTRACT_GUIDE
  }
];

async function seedBidWritingGuides(conn) {
  let added = 0;
  for (const g of guides) {
    const [result] = await conn.query(
      'INSERT IGNORE INTO bid_writing_guides (title, opportunity_type, content, is_template, sort_order) VALUES (?,?,?,?,?)',
      [g.title, g.opportunity_type, g.content, g.is_template, g.sort_order]
    );
    if (result.affectedRows > 0) added++;
  }
  return added;
}

module.exports = { seedBidWritingGuides };
