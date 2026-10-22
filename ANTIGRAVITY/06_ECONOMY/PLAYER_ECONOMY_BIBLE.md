# DOCUMENT 06 — PLAYER ECONOMY BIBLE
## The Economic Constitution: Monetary Policy, Double-Entry Ledgers & Market Mechanics

> **The Sovereign Rule**: Game Naira (GN) is the exclusive, closed-loop bloodline of the Lagos simulation. It has **zero cash convertibility**. It represents labor, commercial acumen, risk, and asset ownership. Every single coin in circulation must be accounted for within a strict, mathematically audited double-entry ledger.

---

## 1. The Double-Entry Ledger System (Zero-Discrepancy Invariant)

Every economic transaction in Project Eko adheres to classical financial accounting standards. The system does not maintain single-value user balance counters; balances are materialized projections of an immutable transaction log.

$$\sum \text{Debits} \equiv \sum \text{Credits}$$

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ SAMPLE TRANSACTION: Player Amaka buys fuel at an Oshodi Filling Station                     │
├─────────────────────┬───────────────────┬──────────────┬──────────────┬─────────────────────┤
│ Account             │ Account Type      │ Debit (GN)   │ Credit (GN)  │ Ledger Note         │
├─────────────────────┼───────────────────┼──────────────┼──────────────┼─────────────────────┤
│ Player:Amaka:Cash   │ Asset             │ —            │ ₦12,500      │ Outflow from player │
│ System:Sink:FuelTax │ Revenue / Sink    │ ₦2,500       │ —            │ Municipal tax burn  │
│ Business:Oando:Rev  │ Revenue           │ ₦10,000      │ —            │ Station gross margin│
└─────────────────────┴───────────────────┴──────────────┴──────────────┴─────────────────────┘
```

### 1.1 Invariant Rules of the Ledger
1. **Atomicity**: Economic events execute inside strict ACID database transactions. If any step fails, the entire transaction rolls back.
2. **Idempotency Keys**: All client-initiated financial requests include a UUIDv4 idempotency key. Network retries will never double-charge or double-credit an account.
3. **No Destructive Updates**: Balance corrections, refunds, or administrative interventions must be made via explicit compensating journal entries with auditable reason codes.

---

## 2. Macroeconomic Sinks & Sources Equilibrium

To prevent runaway hyperinflation—a fatal flaw of poorly designed MMO economies—the economy operates an automated central bank mechanism monitoring the **Money Supply Equilibrium Ratio ($M_s$)**:

$$M_s = \frac{\text{Total Daily Sinks}}{\text{Total Daily Sources}} \approx 1.00 \pm 0.05$$

```mermaid
graph TD
    subgraph SOURCES [SOURCES OF GAME NAIRA (Money Creation)]
        S1[Job Salaries & Shift Wages]
        S2[Fare Revenue from NPC Passengers]
        S3[Mission Completion Grants]
        S4[Wholesale Market Trading Margins]
        S5[Sponsor Brand Campaign Subsidies]
    end

    subgraph SINKS [SINKS OF GAME NAIRA (Money Destruction)]
        K1[Fuel Purchases: Petrol / Diesel]
        K2[Vehicle Maintenance, Parts & Tyres]
        K3[Generator Fuel & Utility Bills]
        K4[Property Rent & Commercial Leases]
        K5[Licensing, Test & Toll Fees]
        K6[Sales & Corporate Municipal Taxes]
        K7[Food, Beverage & Consumable Buffs]
    end

    SOURCES -->|Player Wealth Flow| ECONOMY_POOL[Active Player Economy]
    ECONOMY_POOL -->|Essential Running Costs| SINKS
```

### 2.1 Dynamic Inflation Dampeners
If aggregate player money supply expands faster than GDP (asset acquisition volume), the central economy engine dynamically adjusts:
* **Toll Gate Tariffs**: Lekki-Ikoyi Link Bridge toll fee auto-scales from ₦500 to ₦1,200 GN.
* **Parts & Tyre Import Tariffs**: Mechanic yard spare parts costs increase by 10–25%.
* **Licensing Renewal Costs**: Commercial driver permits require higher administrative fees.

---

## 3. Asset Lifecycle, Depreciation & Scrapping

Vehicles, machinery, and equipment are depreciating capital assets, not permanent indestructible trophies.

### 3.1 Vehicle Depreciation Curve
A vehicle loses value based on age, mileage, and incident history according to a modified exponential decay formula:
$$V(t, d, c) = V_{\text{base}} \cdot e^{-(\lambda_t \cdot t + \lambda_d \cdot d)} \cdot \left(\frac{c}{100}\right)^\gamma$$
* $t$: In-game months in service.
* $d$: Total kilometers driven.
* $c$: Overall mechanical condition rating (0–100%).
* **Salvage Floor**: A vehicle never depreciates below 15% of its original purchase price, representing its scrap metal value at the Owode Onirin industrial scrap yard.

### 3.2 Vehicle Scrapping & Component Salvage
When a car becomes uneconomical to repair (e.g., following a high-speed crash on Eko Bridge), the owner can:
* Sell it to a junkyard for immediate scrap Game Naira.
* Dismantle it using the Mechanic Bay skill to harvest salvageable alternators, gearboxes, and wheels to use as spare parts for their fleet or sell on the player marketplace.

---

## 4. Property, Commercial Leases & Tenancy

Real estate represents the premier wealth storage and passive income system in Project Eko:

```
┌──────────────────────────┬─────────────────┬──────────────────┬─────────────────────────────────┐
│ Property Class           │ District Tier   │ Capital Cost     │ Operational Role                │
├──────────────────────────┼─────────────────┼──────────────────┼─────────────────────────────────┤
│ Face-me-I-face-you Room  │ Mushin / Agege  │ ₦150,000 GN / yr │ Basic shelter, inventory chest  │
├──────────────────────────┼─────────────────┼──────────────────┼─────────────────────────────────┤
│ 2-Bedroom Urban Flat     │ Surulere / Yaba │ ₦850,000 GN / yr │ Wardrobe, rest buff, home office│
├──────────────────────────┼─────────────────┼──────────────────┼─────────────────────────────────┤
│ Commercial Retail Stall  │ Tejuosho Market │ ₦2,500,000 GN    │ Sell electronics/clothing goods │
├──────────────────────────┼─────────────────┼──────────────────┼─────────────────────────────────┤
│ Vehicle Repair Depot     │ Oshodi / Ikeja  │ ₦8,000,000 GN    │ Repair bay for 4 fleet vehicles │
├──────────────────────────┼─────────────────┼──────────────────┼─────────────────────────────────┤
│ Luxury Waterfront Duplex │ Lekki Phase 1   │ ₦45,000,000 GN   │ High prestige, VIP party hosting│
├──────────────────────────┼─────────────────┼──────────────────┼─────────────────────────────────┤
│ Prime Commercial Tower   │ Victoria Island │ ₦250,000,000 GN  │ Multi-business enterprise HQ    │
└──────────────────────────┴─────────────────┴──────────────────┴─────────────────────────────────┘
```

* **Landlord Gameplay**: Players who own commercial or residential properties can lease them to other players, setting monthly rent, managing generator maintenance, and collecting passive Game Naira yields.

---

## 5. Banking, Credit & Financing

The in-game financial institution (**Eko Central Bank / Commercial Banks**) provides realistic credit instruments:

### 5.1 Hire-Purchase & Vehicle Financing
* Entry-level players cannot afford to buy a ₦3,500,000 GN Danfo bus with upfront cash.
* **Financing Terms**: 20% down payment (₦700,000 GN) with daily automated debit deductions of ₦25,000 GN over 140 in-game days.
* **Default & Repossession**: If a player's account maintains insufficient funds for 3 consecutive days, a repossession order is issued. An NPC tow truck repo crew will hunt the vehicle in the open world, seize it, and auction it off to recover the loan balance!

### 5.2 Business Expansion Mortgages
* High-reputation players with proven track records can secure commercial loans to purchase warehousing in Apapa or boutique storefronts in Admiralty Way, collateralized against their existing fleet assets.
