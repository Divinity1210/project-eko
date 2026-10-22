# ADR-0010: Browser-First Performance Budget & African Network Optimisation

## Status
Approved

## Context
Project Eko is targeting Nigerian and African players connecting via mid-tier smartphones (Tecno, Infinix, Xiaomi, Samsung A-series) on 4G cellular data plans with fluctuating bandwidth, high latency, and limited device RAM (3–4 GB). If the web game requires 200MB initial downloads or spikes GPU memory above 500MB, it will crash mobile browsers and fail to retain players.

## Decision
We enforce a **Hard Performance Budget** across all client builds:
1. **Initial Shell Bundle**: $\le$ 15MB gzipped (HTML, JS, Core Shaders, Basic UI).
2. **First Interactive Frame**: $\le$ 3.5 seconds on 4G network connection.
3. **District Payload Chunk**: $\le$ 8MB per district sector.
4. **Target Frame Rate**:
   * Desktop (Laptop / PC): Stable **60 FPS**.
   * Mobile (Mid-Tier Smartphone): Stable $\ge$ **30 FPS**.
5. **Draw Calls & Geometry Budget**:
   * Maximum **75 draw calls** per frame via Three.js static mesh instancing.
   * Maximum **35,000 active triangles** in camera view frustum.
6. **Texture & Asset Compression**:
   * All 3D meshes compressed with **Draco**.
   * All textures compressed with **KTX2 / Basis Universal** (GPU-ready format with zero CPU uncompression overhead).

## Alternatives Considered
* *Full High-Poly AAA Assets*: Rejected because $>90\%$ of the target African audience would experience browser crashes.
* *Pixel Streaming via Server GPU*: Rejected due to astronomical server hosting costs and intolerable streaming latency over cellular connections.

## Consequences
* **Positive**: Instant loading, sub-second boot times, broad hardware accessibility across the entire African continent.
* **Negative**: Requires strict discipline from technical artists and engineers during 3D asset creation and level design.

## Rollback / Reversal Strategy
Performance metrics are captured continuously via client telemetry. If a user's device reports frame rates below 25 FPS, the engine automatically triggers dynamic resolution scaling (0.75x) and disables dynamic shadows.
