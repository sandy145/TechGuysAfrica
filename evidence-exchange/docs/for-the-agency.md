# Notes for the agency

A one-pager for the conversation about running a pilot.

## What problem this solves for you, not for providers

The provider-facing benefit is obvious and is not the argument. The argument is
about the agency's own exposure.

Every citation a provider disputes on the grounds "I sent you that document"
costs the programme an informal dispute resolution, sometimes a hearing, and
occasionally a deleted citation that took a licensor two days to write. Today
the agency cannot cheaply answer the question at the centre of that dispute —
*what did the decision-maker actually have in front of them?* — because the
answer lives in a mailbox.

This system answers it on the face of the packet. Every document, when it
arrived, when it was first opened, by whom, and its content digest. A
determination carries a frozen snapshot of the evidence that existed when it was
made. The record is the defence.

It also makes the reverse case cleanly: when a provider genuinely sent nothing,
"no documentation was submitted before the deadline of [date]" is a recorded
fact on the determination rather than a recollection.

## What it changes in a licensor's day

Very little, deliberately.

- Findings are drafted in the tool instead of a document, with the citation, the
  failed practice, and the evidence sources in fields rather than prose.
- The exit conference ends with one action that shares the findings, creates the
  provider's account, and starts the working-day clock.
- Instead of an inbox, there is a queue ordered by how long a provider has been
  waiting.
- A citation is refused while evidence on that finding sits unread. This is the
  only place the tool tells a licensor "no", and it is the point of it.

## What it changes for a field manager

An oversight view the programme does not have today: how long evidence waits
before it is read, how often determinations are recorded below the evidence
standard and on whose authority, and how the citation / consultation / no
deficiency mix varies between licensors on comparable work. Variation is not
misconduct, but it is the question a manager should be able to ask from data.

## Pilot shape

**One field office, one inspection type, ninety days.** Full inspections only;
complaint investigations stay on the current process until the evidence window
behaves.

Success is measured against the current process on three numbers, all of which
the system produces itself:

1. Median working days from provider submission to agency review.
2. Number of findings resolved during the evidence window that would previously
   have been cited and later corrected.
3. Informal dispute resolution requests per hundred citations, and how many turn
   on evidence handling.

## Integration and procurement questions you will ask

| Question | Answer today |
| --- | --- |
| Identity | Replace one function to sit behind the state IdP; no user-managed passwords in production. |
| Licensing system of record | Homes and licences import; determinations export. No live integration is built — it is the first real engineering task after a pilot. |
| Hosting | Standard Node application plus Postgres plus an object store. Runs in the state's own cloud tenancy. |
| Records retention | Every record is append-only or versioned; retention schedules are not yet automated. |
| Public disclosure | The evidence index and audit log are agency records. What becomes public, and when, is a policy decision the system does not make for you. |
| Accessibility | Semantic HTML, keyboard-navigable, high contrast. A formal WCAG 2.1 AA audit has not been run. |
| PHI | Uploads contain resident records. Encryption at rest and virus scanning are procurement requirements and are not implemented in this prototype. |

## What we would need from you

- The programme's authoritative rule table, so the citation catalog stops being
  illustrative.
- The real deadline numbers and their statutory basis, to replace the defaults.
- One field manager and two licensors willing to run their next several
  inspections in it and be blunt about what is worse.
