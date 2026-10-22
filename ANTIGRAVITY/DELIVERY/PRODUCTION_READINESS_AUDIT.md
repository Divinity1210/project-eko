# Project Eko — Production Readiness Audit and Delivery Phases

**Audit date:** 22 October 2026  
**Scope:** Repository implementation reviewed against `EKO_REAL_ECONOMY_OPEN_WORLD_MASTER_BLUEPRINT.docx`, the Blueprint Execution Roadmap, the Master Vision phased roadmap, ADRs, and current service code.  
**Purpose:** Establish what exists, what is still required for production, and the evidence needed to pass each phase.

## Executive assessment

**Current verdict: not production-ready.** The project has a substantial playable browser prototype and a growing server-side domain implementation. The most recent execution roadmap reports successful build, identity-boundary, durability, and automated acceptance checks. Those checks are recorded evidence from that roadmap; they were not rerun as part of this audit. Several high-risk systems remain prototypes, and the current runtime is not backed by PostgreSQL or production operations infrastructure.

The biggest blockers are:

1. **Reward-bearing gameplay is not authoritative end to end.** The realtime worker accepts client-supplied vehicle transforms and speed. Reward evidence is not yet built from trusted server-sampled trajectories.
2. **Durability is not production-database durability.** Current account/domain snapshots are JSON. The SQL schema exists, but the runtime does not use a PostgreSQL adapter.
3. **Payout code is a mock.** The payouts service generates a fake provider reference and marks an item paid in memory; this is not a payment-provider integration.
4. **Production security and operations are incomplete.** Wildcard CORS remains, endpoints are configured around localhost, and no production deployment, monitoring, backup, alerting, or recovery setup was found in the reviewed infrastructure.
5. **The blueprint contains broader playable-content claims than the production evidence supports.** Treat those as feature breadth/prototype status until world, ownership, multiplayer, mobile, and operational acceptance is demonstrated.

The recommended first public release should keep **fiat rewards disabled**. A real-reward pilot is a separate release gate requiring written legal and provider approvals in addition to engineering completion.

## Status language

- **Implemented — prototype:** A code path or content model exists, but production behavior, resilience, and operational evidence are not established.
- **Partial:** Meaningful implementation exists; one or more required capabilities or acceptance proofs remain.
- **Not evidenced:** The reviewed repository did not provide convincing implementation or production evidence.
- **External gate:** Depends on a written decision or approval from counsel, a licensed provider, a sponsor, or another external party.

“Implemented” in a roadmap is not automatically equivalent to production-ready. This audit is a repository review, not a live security assessment, legal opinion, load test, or deployment certification.

## Current project position

| Area | Current position | Production implication |
|---|---|---|
| Browser game and Lagos content | **Implemented — prototype.** The repo contains a WebGL/browser game, HUD, mobile touch controls, world/career/economy content, and acceptance artifacts. | Demonstrate a stable, accessible vertical slice on target devices; verify world continuity, assets, and actual interaction flows. |
| Session identity | **Partial / reported phase complete.** The execution roadmap reports session-bound API and realtime actions, forged-identity rejection, and `verify:phase1` evidence. | Add production-grade account recovery, rate limits, token lifecycle, secure transport/storage, consent, and abuse controls. |
| Domain persistence | **Partial.** Account-scoped JSON snapshots, atomic replacement, restart recovery, and broad server-priced actions are reported by the execution roadmap. | Replace snapshot source of truth with a transactional database; prove consistency under concurrency, crashes, and multiple instances. |
| Ledger and Game Naira | **Partial.** Double-entry posting and journal persistence are reported; the initial PostgreSQL schema is present. | Enforce accounting invariants in the production DB, reconcile continuously, cover every mutation, and prove idempotency. |
| Multiplayer/realtime | **Prototype.** Session binding is present, but zone state is in process memory and vehicle updates trust client transforms/speed. | Authoritative simulation, durable/recoverable zone state, scaling, and target-concurrency evidence are needed. |
| Rewards and payout | **No-go for real value.** Reward code is in-memory and evaluates client-supplied values; payout code simulates provider success. | Keep disabled. Replace with reviewed evidence and state machines, then integrate only after external approvals. |
| Deployment/operations | **Not evidenced.** Reviewed app server is a local static server; no deployment pipeline or operational configuration was found in `infra/`. | Build secure environments, delivery and rollback, observability, support, incident and recovery procedures. |
| Acceptance evidence | **Mixed and potentially inconsistent.** Execution roadmap reports 21 suites / 685 assertions. Master Vision claims 40/40 across 16 suites. | Reconcile suite counts, map tests to requirements, and make CI-generated, versioned evidence the source of truth. |

## Immediate production stop items

These items block production use of affected functionality and should be addressed before an external launch:

| Priority | Finding | Required action |
|---|---|---|
| P0 | Realtime vehicle state accepts client-provided position and speed without the server plausibility validation required by the approved gameplay ADR. | Implement server-authoritative movement/checkpoints for reward-bearing and economy-affecting play; reject impossible or replayed updates. |
| P0 | Reward evaluation is not backed by trustworthy telemetry. The reward service uses in-memory state and client-reported run information; telemetry signing uses a prototype hardcoded key. | Keep real rewards hard-disabled; design server-origin evidence, canonical serialization, nonce/replay protection, key management, review, and durable evidence storage. |
| P0 | Payout code fakes provider settlement and reports `PAID` without a PSP transaction. | Do not expose as live payout. Integrate a licensed provider’s sandbox first, then production webhooks, idempotency, reconciliation, failures, refunds/reversals, and audit logs. |
| P0 | The runtime domain source of truth is not PostgreSQL; current snapshots and process memory do not provide safe horizontal scaling or transactional multi-service consistency. | Implement database adapter/migrations and move each authoritative domain to it before production. |
| P1 | API/realtime CORS is wildcard; browser and services use localhost-oriented configuration. | Use environment-specific origins, TLS, explicit security headers, secret management, deployment configuration, and security review. |
| P1 | No production operations evidence was found for service orchestration, alerting, backups, restore tests, incident response, or release rollback. | Establish and rehearse operations before inviting external players. |
| P1 | Identity and account controls remain below production requirements. Password hashing and session expiry exist, but rate limiting, recovery hardening, token exposure controls, and account-security operations need review. | Complete a threat-model-led identity/security pass and privacy/consent lifecycle. |

## End-to-end delivery phases

Phases are sequenced by dependency. The team can deliver small increments within a phase, but a phase is not complete until its exit evidence is reviewed. Track every task with an owner, status, evidence link, and decision date.

### Phase 0 — Freeze release scope and define launch boundaries

**Status: Partial; product and external decisions remain open.** The master blueprint and execution roadmap define the intended product and identify legal/PSP gates. The team still needs a specific first-release contract.

**Work to complete**

- Select launch audience, supported devices/browsers, geography, language, and whether launch is invitation-only or public.
- Define the minimum production vertical slice: districts, activities, multiplayer capacity, account flows, support coverage, and service hours.
- Decide explicitly whether launch is GN-only. Keep fiat rewards, cashout, and prize campaigns disabled unless a later gated pilot is approved.
- Convert blueprint requirements into a traceable acceptance matrix; distinguish prototype content breadth from launch acceptance.
- Assign product, engineering, security, operations, content/rights, privacy, support, and compliance owners.
- Maintain a risk register and record product decisions that change economy, age, identity, or rewards behavior.

**Exit criteria**

- Approved launch scope and release exclusions.
- Requirements map to tests or manual evidence, with named owners.
- Real-money feature state is documented and defaults to disabled.

### Phase 1 — Reproducible builds, environments, and secure delivery

**Status: Not evidenced for production.** Workspace build scripts exist; reviewed deployment configuration is insufficient for an operated release.

**Work to complete**

- Create development, test/staging, and production environments with separated data, credentials, and provider accounts.
- Add a repeatable CI pipeline: dependency installation, lint/type checks, build, unit/integration/acceptance tests, artifact generation, and security/dependency scanning.
- Reconcile the roadmap’s test count discrepancy and publish CI results per commit/release.
- Add environment-based API, realtime, and asset URLs; remove localhost assumptions from production builds.
- Replace wildcard CORS with an allowlist; configure HTTPS, secure headers/CSP, request size/time limits, and cache policy.
- Manage secrets through a secret manager; document rotation and access. Remove prototype secrets from release paths.
- Package and deploy API, realtime, and web client reproducibly; define health/readiness checks, migrations, staged rollout, rollback, and artifact provenance.
- Add dependency/license and software supply-chain checks; pin and review production dependencies.

**Exit criteria**

- A clean CI run produces versioned deployable artifacts from a tagged commit.
- Staging deploy and rollback are repeatable without manual source edits.
- Production configuration contains no localhost endpoints, wildcard CORS, or hardcoded secrets.

### Phase 2 — Identity, account security, privacy, and consent

**Status: Partial.** Session-bound identity is reported as implemented and verified; production account lifecycle and controls are not established.

**Work to complete**

- Threat-model signup, login, session, recovery, profile, social, payments/rewards, admin, and support access.
- Add login/signup/recovery rate limits, abuse detection, safe recovery challenges, session revocation, rotation, device/session management, and audit trails.
- Prevent tokens from appearing in URLs or logs; use secure transport and appropriate browser storage/cookie protections.
- Decide age policy and implement age/guardian/consent flows appropriate to the selected launch territory and features.
- Publish privacy notices and implement data access, correction, deletion, retention, and consent withdrawal workflows.
- Define administrator/support permissions, least privilege, staff MFA, break-glass logging, and access reviews.
- Complete independent application security review and remediate critical/high findings.

**Exit criteria**

- Auth/account abuse scenarios are tested and operationally monitored.
- Privacy and consent behaviors are implemented, documented, and reviewed for launch scope.
- No unresolved critical/high security findings in agreed scope.

### Phase 3 — PostgreSQL, transactional domain state, and ledger integrity

**Status: In progress at prototype persistence level.** Current roadmap reports account-scoped JSON snapshots and restart recovery; schema/runtime integration and comprehensive consistency are outstanding.

**Work to complete**

- Implement PostgreSQL runtime adapter, migrations, connection pooling, schema versioning, and safe migration/rollback procedures.
- Migrate profiles, inventory, vehicles/ownership, household/property, businesses, careers, labour, cargo, social permissions, mission state, and shared-world state to the appropriate durable stores.
- Model ownership and tenancy explicitly across players, households, crews, businesses, vehicles, properties, districts, and shared stock.
- Make every GN mutation an atomic transaction across domain state, double-entry journal, idempotency key, and audit record.
- Define unique constraints and replay semantics for every action, including concurrent duplicate requests.
- Enforce ledger invariants, immutable journal entries, balance reconciliation, corrections/reversals, and separate GN and fiat accounting boundaries.
- Establish backup retention, encryption, point-in-time recovery, restore drills, and data migration validation.
- Remove process-local maps as authoritative business state or define their cache/rebuild behavior.

**Exit criteria**

- Production-like services use PostgreSQL as source of truth, not JSON snapshots or process memory.
- Concurrent/replayed requests cannot duplicate balances, items, ownership, or settlements.
- Reconciliation is clean after restart, failover, and restore exercises.
- Recovery objectives are defined and demonstrated.

### Phase 4 — Authoritative gameplay, missions, and realtime zones

**Status: Partial/prototype; critical production gap.** The approved ADR specifies server validation of timestamps, checkpoints, kinematics, collision evidence, and signed telemetry. Current realtime vehicle updates accept supplied transforms/speed.

**Work to complete**

- Define zone ownership, tick/update model, player and vehicle lifecycle, reconnect behavior, and service boundaries.
- Validate movement server-side with bounded input deltas, acceleration/velocity limits, world collision and lane rules, timestamps, sequence numbers, and replay rejection.
- Make reward-bearing mission checkpoints server-issued and server-observed; clients may request actions but cannot claim completed evidence.
- Persist authoritative mission/run state and evidence before settlement; make results reproducible and auditable.
- Implement reliable disconnect/reconnect, worker restart recovery, handoff, timeout, and partial-session handling.
- Add zone sharding, backpressure, rate limits, message schemas/versioning, abuse controls, and graceful degradation.
- Instrument latency, tick health, dropped messages, movement corrections, disconnects, and settlement outcomes.
- Load test the blueprint target of 32–64 players per zone and document device/network conditions, latency, and recovery results.

**Exit criteria**

- Two or more independent authenticated clients interact in a server-owned zone without client-chosen identity or authoritative state.
- Reward-bearing activity has no client-only completion or payout path.
- Target player concurrency, latency, disconnect, and worker-recovery SLOs are met with repeatable evidence.

### Phase 5 — Production vertical slice and mobile/browser quality

**Status: Implemented — prototype with incomplete acceptance evidence.** The browser game and mobile controls/HUD exist; previous roadmap records some acceptance artifacts, but they do not establish broad device readiness.

**Work to complete**

- Select a complete slice (onboarding → travel → activity/job → GN outcome → return/progression) and verify it on supported desktop and mobile devices.
- Resolve mobile screen density: preserve immediate navigation, movement, and context action; collapse secondary status, social, wardrobe, and tools into progressive panels. Check touch target sizes, safe areas, landscape/portrait behavior, keyboard overlap, and panel stacking.
- Define and measure startup, frame rate, memory, download size, network use, thermal/battery, and low-end device budgets.
- Test real mobile browsers and constrained networks, including reload, background/resume, reconnect, and low-memory behavior.
- Complete accessibility checks for contrast, text scaling, focus, keyboard/gamepad alternatives where supported, motion, and readable UI.
- Confirm collision, camera, interaction, tutorial, and HUD behavior in the actual browser build, not only VM/unit tests or screenshots.
- Establish asset provenance and licenses for models, textures, audio, fonts, maps, imagery, trademarks, and location data; replace any uncleared assets.

**Exit criteria**

- The vertical slice passes an agreed device/browser matrix and documented usability checks.
- Performance budgets are met on the minimum supported device and network.
- All shipped content has a provenance/license record and approval.

### Phase 6 — World, careers, business loops, and economy completion

**Status: Partial.** Many systems and data models are present. The roadmap identifies remaining state-ownership, minigame evidence, creator evidence, and economic consistency work. The larger vision’s “playable” labels need end-to-end acceptance.

**Work to complete**

- Choose the launch districts and validate that they form a coherent, navigable and performant connected world; don’t count registry entries or stream flags as playable acceptance.
- Complete at least one worker-to-owner progression path and validate prerequisites, skills, licences, household needs, and progression feedback.
- Exercise jobs, transit, fleet, shops, businesses, labour, supply chain, property, creator activities, and minigames from player entry through persisted outcome.
- Ensure every source/sink and ownership rule is server-priced, account-scoped, replay-safe, and journaled.
- Replace client-reported minigame scores and creator submissions with verifiable evidence proportionate to their value and abuse risk.
- Simulate economy behavior under active/inactive players, price changes, scarcity, exploit attempts, and multiple accounts; tune inflation, affordability, and sinks.
- Ensure world and district asset/geodata use is rights-cleared and recognizable representation is handled responsibly.

**Exit criteria**

- Launch loops pass integration acceptance against durable state and ledger reconciliation.
- Economy health metrics, thresholds, and rollback/tuning procedures exist.
- Every district/content item counted for launch is accessible and verified in the shipped client.

### Phase 7 — Trust, safety, moderation, support, and analytics

**Status: Partial / not production-operated.** Social and moderation-related models exist in the roadmap, but operating procedures and measured outcomes are not evidenced.

**Work to complete**

- Define code of conduct, reporting, blocking, mute, sanctions, appeals, escalation, and evidence retention.
- Build staff moderation tools with least-privilege roles, audit logs, queueing, evidence controls, and urgent escalation.
- Protect chat, crews, home visits, names, user-created content, and location/social data from harassment and exposure.
- Define support channels, response coverage, account recovery escalation, player-facing incident communication, and refund/compensation policy where applicable.
- Instrument privacy-conscious funnels, crashes, performance, retention, economy health, abuse reports, and moderation response time.
- Set retention periods, consent boundaries, data minimization, analytics access, and deletion behavior.
- Run tabletop exercises for account takeover, exploit/fraud, harassment, data exposure, outage, and harmful content incidents.

**Exit criteria**

- Staff can detect, investigate, respond, appeal, and audit safety incidents.
- Support/moderation coverage matches the intended launch hours and player population.
- Analytics and retention targets are defined, privacy-reviewed, and available to release owners.

### Phase 8 — Production reliability, security, and operational readiness

**Status: Not evidenced.** This work underpins both closed alpha and public launch.

**Work to complete**

- Establish service dashboards, structured logs, distributed traces, actionable alerts, error budgets, and SLOs for API, realtime, database, assets, and critical gameplay flows.
- Add DDoS/rate protection, secrets management, vulnerability response, dependency updates, access logging, and security incident procedures.
- Define capacity and scaling model, queue behavior, database limits, deploy windows, maintenance communication, and graceful degradation.
- Test backup restoration, regional/service outage, bad release rollback, database migration failure, and data corruption recovery.
- Create runbooks for deployment, incident triage, reward lock switch, account/security issue, support escalation, and service restoration.
- Conduct threat modeling, penetration testing, privacy review, and operational readiness review before public exposure.

**Exit criteria**

- On-call ownership and escalation are clear; critical alerts are tested.
- Recovery and rollback drills meet approved objectives.
- No unresolved critical/high security, reliability, or privacy findings for launch scope.

### Phase 9 — Closed alpha and staged launch (GN-only baseline)

**Status: Not started as production operations.** The blueprint’s closed alpha/launch work needs real cohort evidence.

**Work to complete**

- Run internal test, invited closed alpha, and limited staged cohort with feature flags and kill switches.
- Measure onboarding completion, crashes, session stability, latency, retention, progression, economy balance, safety reports, and support load.
- Test real-world devices and networks in the launch market; gather accessibility and comprehension feedback.
- Resolve critical usability, stability, exploit, safety, and economy issues before increasing cohort size.
- Prepare release notes, support messaging, status page/incident communication, rollback plan, and launch owner checklist.
- Keep real rewards/cashout disabled in configuration, API authorization, admin tooling, and deployment secrets.

**Exit criteria**

- Cohort gates and target metrics are met for an agreed observation period.
- Kill switches and staged rollback are exercised successfully.
- Release owner signs off each technical, product, safety, privacy, and operations gate.

### Phase 10 — Optional real-reward / sponsor-funded pilot

**Status: No-go until all external and technical gates pass.** The current reward and payout services are not live money systems.

**External gates**

- Written Nigerian legal advice classifying the exact prize/reward model and confirming required licenses, terms, eligibility, advertising, tax, consumer, and data-protection obligations.
- Written approval/operational agreement from an appropriately licensed payment provider for the exact funds flow, escrow/settlement, KYC, chargebacks, sanctions/AML, and geographic eligibility.
- Signed sponsor funding, campaign rules, budget, liability, eligibility, dispute, and end-of-campaign terms.
- Approved age and identity controls, self-exclusion/caps if required, participant support, and complaint process.

**Engineering and operational work**

- Keep GN and fiat strictly separate; no GN conversion, withdrawal, purchase, wager, or stake path unless separately reviewed and approved.
- Build server-origin signed evidence, deterministic validation/replay, fraud review, durable reward state machine, budget reservations, and immutable audit evidence.
- Integrate provider sandbox, authenticated callbacks/webhooks, idempotency, retries, reconciliation, reversals, failed/returned payments, and operator tooling.
- Use managed signing keys/secrets with rotation and access audit; remove prototype HMAC key and mock payment success path.
- Add campaign pause/kill switches, per-user/overall limits, manual review, support/dispute handling, and daily financial reconciliation.
- Run a closed, capped pilot and reconcile every payable from eligibility through provider settlement.

**Exit criteria**

- All written approvals are current and match deployed feature behavior.
- No mock settlement path can report paid; every payout matches provider and ledger records.
- Independent security/compliance review and a successful capped pilot reconciliation are signed off.

### Phase 11 — Public launch, expansion, and ongoing governance

**Status: Future.** Public launch and additional districts/cohorts follow successful gated release, not feature checklist completion alone.

**Work to complete**

- Launch gradually by cohort/region with staffed operations, staged feature flags, support coverage, and rollback capacity.
- Review SLOs, retention, safety, economy, accessibility, and cost after each cohort; publish internal go/no-go decisions.
- Add districts and systems only after their asset rights, server authority, load/performance, moderation, and economic impacts pass acceptance.
- Revalidate legal/provider/sponsor approvals whenever geography, rewards, eligibility, funds flow, or campaign mechanics change.
- Schedule recurring access, security, privacy, content provenance, backup restore, and incident-response reviews.

**Exit criteria**

- Each expansion has evidence and named approvals; operational capacity remains within SLOs.
- Ongoing governance owners and review cadence are funded and assigned.

## Recommended sequencing and gates

1. **Now:** Close Phase 0 scope; keep cash rewards off. Fix environment/config/security basics while implementing the PostgreSQL adapter and transaction boundaries.
2. **Before external alpha:** Finish identity/privacy controls, authoritative movement and mission evidence, durable zone recovery, and core vertical slice acceptance.
3. **Before public GN-only launch:** Finish world/economy acceptance, moderation/support, observability, restore/rollback drills, security review, mobile/performance matrix, and closed-alpha metrics.
4. **Only if separately approved:** Start Phase 10 as an isolated gated pilot. A legal/provider approval does not replace the technical evidence, and code completion does not replace written approvals.
5. **After launch:** Expand through measured cohorts, preserving kill switches and repeating rights, security, safety, and economy acceptance for material changes.

## Definition of “production-ready” for this project

Production readiness requires all of the following for the selected release scope:

- Reproducible, reviewed, secure deployments with environment separation and rollback.
- Durable, transactionally correct account/world state and reconciled GN ledger.
- Server-authoritative gameplay for any action affecting ownership, progression, or value.
- Tested identity, privacy, consent, moderation, support, and staff access controls.
- Mobile/browser performance and usability evidence on the minimum supported device/network.
- Monitoring, on-call, backups, restore drills, incident response, and recovery objectives.
- Rights/provenance clearance for shipped assets and data.
- Closed-alpha evidence that the actual target cohort can play safely and reliably.
- For any fiat reward: all Phase 10 external approvals and payout/evidence reconciliation gates.

## Audit limitations and evidence notes

- This audit did not rerun the build, test suites, browser verifiers, load tests, or security scans. The execution roadmap’s build/verifier/test results are reported as existing project evidence, not independently revalidated here.
- The project documents disagree on automated test counts: the execution roadmap reports 21 suites / 685 assertions; the Master Vision reports 40/40 across Suites 1–16. Reconcile the harness outputs and make CI the canonical record.
- Master Vision uses labels such as “100% playable” for large feature groups. This audit treats them as implementation claims until each shipped loop passes durable-state, browser/device, security, and operational acceptance.
- Legal, payment-provider, privacy-law, and asset-rights status must be confirmed by qualified parties and written evidence. This audit records gates; it does not provide legal advice or establish that approvals exist.

## Repository references reviewed

- `EKO_REAL_ECONOMY_OPEN_WORLD_MASTER_BLUEPRINT.docx`
- `ANTIGRAVITY/DELIVERY/BLUEPRINT_EXECUTION_ROADMAP.md`
- `ANTIGRAVITY/DELIVERY/MASTER_VISION_PHASED_ROADMAP_AND_BIBLE_DELIVERY.md`
- `docs/ADR/ADR-0002-two-economy-isolation.md`
- `docs/ADR/ADR-0003-server-authoritative-gameplay.md`
- `docs/ADR/ADR-0004-double-entry-economy-ledger.md`
- `docs/ADR/ADR-0005-real-reward-accounts-payable-boundary.md`
- `docs/ADR/ADR-0007-vehicle-physics-authority.md`
- `docs/ADR/ADR-0008-asset-rights-and-content-provenance.md`
- `docs/ADR/ADR-0009-anti-cheat-and-reward-evidence.md`
- `services/api/src/server.ts`, `services/api/src/m47Engine.ts`
- `services/realtime/src/server.ts`
- `services/rewards/src/index.ts`, `services/payouts/src/index.ts`
- `packages/telemetry/src/index.ts`, `packages/anti-cheat/src/index.ts`
- `infra/database/001_initial_schema.sql`, `infra/observability/metrics.ts`, `apps/game/server.js`
