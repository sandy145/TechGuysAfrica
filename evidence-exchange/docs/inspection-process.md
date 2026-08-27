# How a state adult family home inspection actually works

Written to ground the design of this system. Washington is used as the worked
example because it is the programme the scenario came from, but the shape —
unannounced inspection, findings, a window to produce documentation, a
statement of deficiencies, a plan of correction, a dispute path — is common
across states that license adult family / adult foster homes.

**A note on sourcing.** The authoritative documents are the state's standard
operating procedures (DSHS/ALTSA Residential Care Services SOP Chapter 12 —
Adult Family Homes) and chapter 388-76 WAC. The network this was researched
from blocks `dshs.wa.gov`, `app.leg.wa.gov`, and most secondary sources, so the
process below is assembled from search-result summaries of those documents
rather than read end to end. Everything marked ⚠ needs confirming against the
primary source before it is quoted to an agency. Nothing in the code depends on
an unverified number: every deadline is a configurable field on the `Agency`
record.

---

## 1. Before the visit

The licensor prepares from the home's history: previous statements of
deficiency and enforcement actions since the last full inspection, uncorrected
citations, current exemptions and exceptions, bed count, and any complaint
investigations or follow-up visits in between.

Inspections are unannounced, and are planned for a time when care is actually
being delivered — ideally so the licensor can observe a meal and a medication
pass. ⚠ Reported frequency varies by source between roughly 9 and 18 months,
with a longer cycle available to homes with a clean record; treat the exact
cycle as programme policy, not as a fixed rule.

## 2. Onsite

A full inspection is a sequence of information-gathering tasks:

1. Entrance — the licensor arrives and explains the process.
2. Inspection tour of the home.
3. Medication review and observation of a medication pass.
4. Sample selection — a subset of residents and staff.
5. Resident record review for the sample.
6. Staff record review for the sample (training, credentials, background checks).
7. Observation of care.
8. Interviews — provider, staff, residents, and resident representatives.
9. Exit conference.

Two decision rules matter for the software:

- **Two sources.** A potential failed provider practice must be supported by at
  least two sources of evidence — some combination of observation, interview,
  and record review.
- **Outcome.** The licensor must decide whether the failure caused a negative
  resident outcome or had the potential to.

Both are modelled directly: `EvidenceSource` rows on a finding, and a
scope/harm pair on every finding.

## 3. The exit conference — and the gap this system exists to close

At the exit conference the licensor explains the preliminary decisions about
each potential failed provider practice, and asks the provider to begin
correcting. In practice this is also where the provider says *"I have that —
it's in the binder in the back office."*

What happens next is the problem. The provider sends the document **by email**.
It arrives in a thread, possibly among several, possibly as an attachment to a
message about something else. Nothing in that thread knows which finding the
document answers. Nothing records whether it was opened. Nothing distinguishes
"the provider sent nothing" from "the provider sent it and it was not seen".

When a document is missed, the finding is cited instead of resolved or handled
as a consultation. The provider's only remedy is to notice and object — and if
they do not, a citation stands on the public record of a home that met the
requirement.

That is the failure this system is built to make structurally impossible, not
merely less likely.

## 4. Statement of deficiencies and plan of correction

Deficiencies are written up on a statement of deficiencies: citation on one
side of the page, the provider's plan of correction on the other.

⚠ Commonly reported deadlines, and the defaults shipped in
`prisma/schema.prisma`:

| Step | Default | Field |
| --- | --- | --- |
| Provider evidence window after the exit conference | 10 working days | `Agency.evidenceWindowDays` |
| Plan of correction after receipt of the statement | 10 working days | `Agency.pocDueDays` |
| Request informal dispute resolution after receipt | 10 working days | `Agency.idrRequestDays` |
| Completing the correction | up to 45 calendar days, shortened at the field manager's discretion | `Agency.correctionDays` |

A plan of correction has to answer four questions: how each deficiency was or
will be corrected; what monitoring prevents recurrence; who is responsible; and
when it will be complete. Those are the four required fields on
`PlanOfCorrection`.

Severity drives urgency. **Immediate jeopardy** — a situation that has caused or
is likely to cause serious harm, impairment, or death — is the top of the scale
and triggers rapid corrective action. This system requires a second signature
before an immediate jeopardy citation can be issued.

## 5. Follow-up

The agency may revisit to verify correction. ⚠ Reported practice is that if the
first follow-up itself results in a deficiency, a compliance specialist is
consulted. `Citation.status` carries the correction lifecycle through to
`CORRECTION_VERIFIED`.

## 6. Disputing a citation

A provider has two routes: informal dispute resolution (IDR) and, separately, an
administrative hearing.

⚠ For Washington's adult family homes, IDR is requested within 10 working days
of receiving the statement of deficiencies, and comes in two forms:

- **Traditional** — a one-to-one review, available regardless of how many items
  are disputed.
- **Panel** — a panel of one provider representative, one Residential Care
  Services staff member, one consumer advocate, and a chair; available only when
  three or fewer citations or enforcement actions are disputed.

Requests are submitted **to a shared email inbox or by fax**. That detail is
worth sitting with: the appeal path for "my evidence was not considered" runs
through the same medium that lost the evidence.

## 7. Enforcement

Beyond the citation itself, remedies available to the department include civil
fines, stop placement, conditions on the licence, and suspension or revocation.
Washington's technical assistance statute (chapter 43.05 RCW) also limits when a
civil penalty may be issued for a first-time violation found during a technical
assistance visit — broadly, only where there is a prior enforcement action or
notice for the same or similar violation, or where the violation carries a
probability of death or bodily harm. This is the statutory backdrop to the
consultation-instead-of-citation choice a licensor makes in the field.

`Citation.enforcementJson` holds remedies as a list so that a state's own
remedy vocabulary can be dropped in without a schema change.

---

## Where the software sits

| Stage of the real process | What the system does |
| --- | --- |
| Pre-inspection preparation | Home record with full inspection, finding, and determination history |
| Onsite information gathering | Findings drafted with citation, requirement, failed practice, scope, harm, and evidence sources |
| Exit conference | One action shares every finding, creates the accounts, computes the working-day deadline, and notifies the provider |
| The evidence window | Provider uploads against the specific finding; receipts, digests, and open-tracking on every file |
| Decision | Determination of citation / consultation / no deficiency, blocked while evidence is unread, with a frozen snapshot of what was considered |
| Statement of deficiencies | Printable packet including an evidence index and the full activity record |
| Plan of correction | Four-field plan, agency review, correction verification |
| Informal dispute resolution | A structured request bound to the disputed citations, with the deadline computed and panel limits enforced |
| Enforcement | Recorded against the citation |

## Sources

Assembled from search-result summaries of the following. The first two are the
primary sources and should be read directly before any of the ⚠ items above are
relied on.

- [DSHS/ALTSA Residential Care Services SOP, Chapter 12 — Adult Family Homes](https://www.dshs.wa.gov/sites/default/files/ALTSA/rcs/documents/SOP/Chapter%2012%20-%20AFH.pdf)
- [Chapter 388-76 WAC — Adult Family Home Minimum Licensing Requirements](https://app.leg.wa.gov/wac/default.aspx?cite=388-76&full=true)
- [Adult Family Home Administrator Training — timeframe chart](https://www.dshs.wa.gov/sites/default/files/ALTSA/training/AFHAdmin/Timeframe%20Chart.pdf)
- [Adult Family Home Council — annual inspections](https://adultfamilyhomecouncil.org/library/inspections-investigations/annual-inspections/)
- [RCW 43.05.050 — issuance of penalty during a technical assistance visit](https://app.leg.wa.gov/rcw/default.aspx?cite=43.05.050)
- [RCW 43.05.100 — notice of correction](https://app.leg.wa.gov/rcw/default.aspx?cite=43.05.100)
- [Washington DOH — in-home services survey program (plan of correction timeframes)](https://doh.wa.gov/licenses-permits-and-certificates/facilities-z/home-care-agencies/survey-program)
