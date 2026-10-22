# REGULATORY QUESTIONS FOR NIGERIAN LEGAL COUNSEL
## Real-Reward Architecture, Promotional Competitions, Payments & Compliance

> **STATUS: REGULATORY ASSUMPTION — REQUIRES PROFESSIONAL VALIDATION**  
> **Mandate**: This document details the exact statutory, regulatory, and licensing questions that Nigerian legal counsel and compliance advisors must resolve in writing before any real-money reward flows, cashout endpoints, or sponsor challenge pools are unlocked in production.

---

## 1. Gaming, Betting & Promotional Competition Classification

### Applicable Authorities:
* **Lagos State Lotteries and Gaming Authority (LSLGA)** under the Lagos State Lotteries and Gaming Law 2021.
* **National Lottery Regulatory Commission (NLRC)** under the National Lottery Act 2005.

### Questions for Counsel:
1. **Interactive Gaming vs. Pure Skill**:
   * Does a browser-based driving or dispatch simulation where players pay **zero entry fee**, stake **no money**, and receive fixed monetary rewards funded entirely by a corporate third-party sponsor (e.g., Zenith Bank or MTN) fall under LSLGA's statutory definition of *"Interactive Games"*, *"Online Gaming"*, or *"Promotional Competitions"*?
2. **Promotional Competition Registration**:
   * If a sponsor funds a ₦5,000,000 marketing pool for a 14-day "Safe Driver Challenge" where payouts are distributed based on server-verified driving safety scores:
     * Does Project Eko or the sponsoring corporate entity require a formal **Promotional Competition Permit** from LSLGA or NLRC?
     * What are the statutory processing timelines, fees, and post-campaign reconciliation filing requirements?
3. **Federal vs. State Jurisdiction**:
   * Given the ongoing constitutional jurisprudence regarding state gaming authorities (LSLGA) versus federal regulation (NLRC) for online platforms accessible across state lines:
     * What is the safest dual-licensing or compliance posture for a digital platform operating in Lagos but accessible to players across Nigeria?

---

## 2. Central Bank of Nigeria (CBN) & Payment Rails

### Applicable Framework:
* CBN Guidelines on Operations of Electronic Payment Channels in Nigeria.
* CBN Regulatory Framework for the Sandbox Operations and Payment Service Providers (PSPs).

### Questions for Counsel:
1. **Stored-Value vs. Accounts Payable (AP)**:
   * The platform deliberately avoids operating an in-game "deposit wallet" (players cannot deposit real Naira, cannot transfer Naira to other players, and cannot withdraw Game Naira).
   * Payouts are structured strictly as corporate disbursements (Accounts Payable) for verified services/promotions directly to the player's external NIP bank account via licensed PSPs (Paystack, Flutterwave, Monnify).
   * **Question**: Does this AP disbursement structure conclusively exempt Project Eko from requiring a CBN Payment Service Solution Provider (PSSP), Mobile Money Operator (MMO), or Stored-Value Facility license?
2. **PSP Terms of Service Constraints**:
   * Many licensed Nigerian PSPs have strict acceptable-use policies prohibiting payment processing for "gaming, gambling, or skill competitions" without pre-approved regulatory licenses.
   * **Question**: How should the service agreement and API onboarding application with Paystack/Flutterwave be structured to ensure accounts are not abruptly suspended during reward disbursements?

---

## 3. AML / CFT & KYC Compliance

### Applicable Framework:
* Money Laundering (Prevention and Prohibition) Act 2022.
* Special Control Unit Against Money Laundering (SCUML) / EFCC / NFIU guidelines.

### Questions for Counsel:
1. **SCUML Registration**:
   * Is Project Eko classified as a Designated Non-Financial Business and Profession (DNFBP) requiring SCUML certification, or is it treated purely as a software technology platform?
2. **KYC Tiers for Real Payouts**:
   * What is the minimum threshold of identity verification required under Nigerian law before disbursing cash rewards?
     * Tier 1 (₦1,000 – ₦25,000): Is a verified Nigerian bank account (which has underlying BVN verification by the commercial bank) legally sufficient?
     * Tier 2 (> ₦25,000): Is direct BVN / NIN API verification and liveness check mandatory for our platform, and what data storage liabilities does this trigger?

---

## 4. Taxation & Withholding Liabilities

### Applicable Framework:
* Federal Inland Revenue Service (FIRS) / Lagos State Internal Revenue Service (LIRS).
* Companies Income Tax Act (CITA) and Personal Income Tax Act (PITA).

### Questions for Counsel:
1. **Withholding Tax (WHT) on Player Rewards**:
   * Are monetary rewards earned by players classified as prize winnings, contractor fees, or promotional grants?
   * Is Project Eko obligated to deduct a 5% or 10% Withholding Tax at the point of disbursement to players and remit to LIRS/FIRS?
2. **VAT on Sponsor Marketing Budgets**:
   * Does corporate sponsor funding attract standard 7.5% Value Added Tax (VAT) when invoiced as digital media advertising?

---

## 5. Youth Protection & Age Eligibility

### Applicable Framework:
* Child Rights Act 2003 (as domesticated in Lagos State).

### Questions for Counsel:
1. **Minors in the Simulation vs. Real Rewards**:
   * The platform intends to permit players of all ages to play the entertainment/simulation layer (driving, working for Game Naira), but strictly gates real-money cashouts to verified adults aged 18 and older.
   * **Question**: Does this strict functional bifurcation adequately shield the platform from legal liability regarding child labor, financial exploitation, or minor gambling allegations?
2. **Parental Consent Mechanics**:
   * If a player aged 16–17 participates in a sponsored esports or driving competition, can rewards be lawfully disbursed to a verified parent or legal guardian?

---

## 6. Data Protection & Privacy (NDPA 2023)

### Applicable Framework:
* Nigeria Data Protection Act 2023 (NDPA).
* Nigeria Data Protection Commission (NDPC) Regulatory Guidelines.

### Questions for Counsel:
1. **Data Controller Filing**:
   * Does Project Eko meet the statutory threshold of a *Data Controller of Major Importance* under the NDPC guidelines?
2. **Telemetry & Anti-Fraud Data Collection**:
   * The anti-cheat engine collects granular device identifiers, IP addresses, browser hardware fingerprints, and vehicle steering telemetry to detect bots and reward fraud.
   * **Question**: How should the platform's Privacy Notice and consent modals be framed under the NDPA to justify this telemetry under legitimate business interest without triggering regulatory penalties?
