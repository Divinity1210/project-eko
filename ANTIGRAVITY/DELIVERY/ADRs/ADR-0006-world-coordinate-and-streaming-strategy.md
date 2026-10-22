# ADR-0006: World Coordinate System, Compressed Topology & Streaming

## Status
Approved

## Context
Lagos covers 1,171 square kilometers. Exporting an uncompressed 1:1 real-world map into a web browser creates immense asset file sizes, excessive draw distances, empty unpopulated spaces, and devastating memory consumption on mobile devices.

## Decision
We implement a **Topologically Compressed Coordinate System with Dynamic District Streaming**:
1. **World Origin $(0, 0, 0)$**: Tafawa Balewa Square (TBS) / CMS Interchange on Lagos Island.
2. **Topological Compression**:
   * Highways & Expressways (e.g., Third Mainland Bridge, Ikorodu Road) are compressed at a **1:4 scale** (e.g., Third Mainland Bridge is 3.2 km in-game vs. 11.8 km real-world).
   * Core pedestrian and market hubs (e.g., CMS Terminal, Tejuosho Market, Computer Village) are compressed at a **1:2 scale** to preserve intense urban density.
3. **District Chunk Streaming**: The world is divided into $500\text{m} \times 500\text{m}$ grid sectors. The client dynamically streams in 3D geometry and collider navmeshes within a 750-meter visibility envelope and unloads distant sectors to keep mobile memory below 350MB.

## Alternatives Considered
* *Full 1:1 Geographic Scale*: Rejected because driving between districts would take 45 real-time minutes of empty repetitive highway, destroying player retention and causing browser OOM crashes.
* *Disconnected Static Levels / Teleportation*: Rejected because breaking the spatial continuity of Lagos destroys the core fantasy of mobility and transport enterprise.

## Consequences
* **Positive**: High perceived street density, rapid asset streaming, smooth 60 FPS performance on mid-tier hardware.
* **Negative**: Requires careful artistic curation to ensure the transition between compressed highways and dense pedestrian hubs feels natural.

## Rollback / Reversal Strategy
Sector chunk sizing is configurable in `packages/world/src/config.ts`. If memory pressure spikes on low-end devices, chunk radius can be tuned dynamically based on device hardware concurrency and GPU tier.
