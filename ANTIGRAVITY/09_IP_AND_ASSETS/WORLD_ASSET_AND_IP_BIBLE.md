# DOCUMENT 09 — WORLD ASSET & IP BIBLE
## Rights-Aware Content Creation, Licensing Matrix & 3D Optimization

> **The IP Doctrine**: Real-world geography inspires the world, but intellectual property boundaries protect the company. Every visual, auditory, and structural asset must carry an explicit legal classification before being baked into production bundles:
> 
> **Real Place (Where Permitted) $\longrightarrow$ Fictionalized Brand (By Default) $\longrightarrow$ Licensed Brand (Commercially Partnered)**

---

## 1. The Three-Tier IP Taxonomy

```
┌─────────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┐
│ TIER 1: REAL GEOGRAPHY & CIVIC  │ TIER 2: FICTIONALIZED EQUIVALENT│ TIER 3: LICENSED PARTNERSHIPS   │
│ (Freely usable / Public Domain) │ (Original In-Game Brands)       │ (Commercial Advertiser Deals)   │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ • Geographic district names     │ • "TotalEnergies" ──► "Oandoil" │ • Verified brand billboards and │
│   (Yaba, Victoria Island, etc.) │ • "Shoprite" ──► "BuyRite"      │   exclusive storefronts         │
│ • Public civic plazas & grounds │ • "Zenith Bank" ──► "Apex Bank" │ • Official Afrobeats tracks with│
│   (TBS, Freedom Park, National  │ • "Toyota HiAce" ──► "Danfo 14" │   cleared publishing licenses   │
│   Theatre silhouette)           │ • "Indomie" ──► "Lasgidi Noodle"│ • Official corporate sponsor    │
│ • Transport corridors & roads   │ • "Chicken Republic" ──►        │   challenges (e.g. Zenith Bank, │
│   (Broad St, 3rd Mainland, etc.)│   "Republic Chicken & Rice"     │   MTN, Guinness Nigeria)        │
└─────────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

---

## 2. Legal Guardrails & Compliance Standards

### 2.1 Geographic Data & OpenStreetMap (ODbL Compliance)
* Road topology and district networks are derived from OpenStreetMap (OSM) data.
* **Compliance Invariant**:
  * We maintain mandatory public attribution: *"Map data © OpenStreetMap contributors under ODbL"*.
  * The production world does not directly expose raw OSM database tables; the game engine consumes a proprietary, game-optimized topological navmesh graph derived from lawful geospatial data.

### 2.2 Architectural Works & Building Likenesses
* Under Section 20 of the Nigerian Copyright Act 2022, architectural works permanently situated in a public place may be included in artistic works (paintings, photographs, films) without copyright infringement.
* **Production Policy**:
  * Civic silhouettes (National Theatre, TBS, City Hall) are modeled from original observational photographic references.
  * Private corporate skyscrapers (e.g., proprietary corporate headquarters with registered trademarks) are represented with stylized, original architectural geometries to avoid trademark dilution claims.

### 2.3 Vehicle Likenesses & Badging
* **No Unlicensed Trademarks**: In-game vehicles do **not** use real automaker badges (Toyota, Mercedes-Benz, Volkswagen) or exact trademarked model names.
* Vehicles are modeled as original, culturally recognizable silhouettes with fictional branding:
  * The Danfo minibus is branded as the *"Eko Cruiser 14"*.
  * The commercial ride-hailing sedan is branded as the *"Kano Motors Arrow 1.8"*.
  * The luxury executive SUV is branded as the *"Sahara Titan V8"*.

### 2.4 Audio, Radio & Music Licensing
* **Zero Pirated Audio**: No scraping of commercial Afrobeats from Spotify, Apple Music, or YouTube.
* Music broadcast through vehicle radios comprises:
  1. *Original In-House Productions*: Authentic Afrobeats, Amapiano, Fuji, and Highlife tracks composed specifically for Project Eko.
  2. *Licensed Commercial Tracks*: Negotiated distribution rights with Nigerian record labels and independent artists, providing revenue-share attribution.

---

## 3. 3D Asset Pipeline & Technical Optimization

Because Project Eko runs in a web browser across desktop laptops and mid-tier African smartphones (e.g., Tecno, Infinix, Samsung A-series), assets must meet strict polygon and draw-call budgets:

```
┌────────────────────┬──────────────┬──────────────┬──────────────────┬───────────────────────────────┐
│ Asset Class        │ Max Poly/LOD0│ LOD1 / LOD2  │ Max Texture Size │ Material Type                 │
├────────────────────┼──────────────┼──────────────┼──────────────────┼───────────────────────────────┤
│ Player Vehicle     │ 25,000 tris  │ 8k / 2k tris │ 2048x2048 Atlas  │ PBR (Metallic-Roughness)      │
├────────────────────┼──────────────┼──────────────┼──────────────────┼───────────────────────────────┤
│ NPC Traffic Car    │ 6,000 tris   │ 1.5k tris    │ 1024x1024 Shared │ Low-cost Diffuse + Normal     │
├────────────────────┼──────────────┼──────────────┼──────────────────┼───────────────────────────────┤
│ Character Avatar   │ 12,000 tris  │ 4k / 1k tris │ 1024x1024 Atlas  │ Skinned Mesh / Standard PBR   │
├────────────────────┼──────────────┼──────────────┼──────────────────┼───────────────────────────────┤
│ Landmark Building  │ 40,000 tris  │ 10k / 2k tris│ 2048x2048 Atlas  │ Baked Lighting + PBR Accents  │
├────────────────────┼──────────────┼──────────────┼──────────────────┼───────────────────────────────┤
│ Modular District   │ 2,500 tris/  │ 800 tris     │ 1024x1024 Texture│ Instanced Static Mesh         │
│ Facade             │ module       │              │ Array            │                               │
└────────────────────┴──────────────┴──────────────┴──────────────────┴───────────────────────────────┘
```

* **Asset Delivery Format**: All 3D assets are exported as binary **glTF (.glb)** with Draco mesh compression and KTX2 / Basis Universal GPU texture compression for sub-second streaming over cellular 4G connections.
