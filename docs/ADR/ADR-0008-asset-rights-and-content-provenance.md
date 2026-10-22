# ADR-0008: Asset Rights, Licensing & Content Provenance Policy

## Status
Approved

## Context
Video game startups frequently face cease-and-desist orders or trademark litigation by including unlicensed real-world automotive badges (Toyota, Volkswagen), corporate retail logos, proprietary architectural models, or pirated music in public releases.

## Decision
We enforce a strict **Three-Tier Intellectual Property Provenance Policy**:
1. **Tier 1 (Public Geography)**: Real district names, public highways, and landmark silhouettes (e.g. Tafawa Balewa Square under Section 20 Nigerian Copyright Act 2022) are permitted as factual references.
2. **Tier 2 (Fictionalized Equivalents - Default)**: All consumer retail brands, fuel stations, supermarkets, and vehicle models are in-house fictional designs (e.g., Danfo minibus is *"Eko Cruiser 14"*, fuel station is *"Oandoil"*, ride-hail sedan is *"Kano Motors Arrow 1.8"*).
3. **Tier 3 (Licensed Commercial Partnerships)**: Real commercial logos and branded experiences are included **only** under signed commercial sponsorship contracts.
4. **Zero Pirated Audio**: In-game radio stations use 100% original commissioned music compositions or officially licensed Afrobeats/Fuji tracks with signed publishing clearance.

## Alternatives Considered
* *Fair Use Parody / Unlicensed Real Names*: Rejected as an unacceptable legal liability risk.
* *Completely Abstract Fantasy City*: Rejected because cultural familiarity and authentic Lagos grounding are the product's primary market differentiators.

## Consequences
* **Positive**: Absolute legal defensibility, pristine asset ownership for company valuation, and readiness for institutional brand sponsorship.
* **Negative**: Requires custom 3D modeling and fictional brand graphic design instead of downloading stock models off the web.

## Rollback / Reversal Strategy
All asset metadata in `packages/assets` links to an ID in `ANTIGRAVITY/09_IP_AND_ASSETS/IP_CLEARANCE_REGISTER.md`. Any flagged asset can be swapped out immediately via configuration.
