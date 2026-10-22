# PROJECT EKO — PERFORMANCE BUDGET & HARDWARE PROFILES

> **Performance Mandate**: Project Eko must run smoothly on standard web browsers without requiring high-end gaming hardware or high-bandwidth home broadband.

---

## 1. Network & Payload Budgets

```
┌─────────────────────────────────┬────────────────────┬────────────────────┬─────────────────────────────────┐
│ Metric                          │ Target (Desktop)   │ Target (Mobile)    │ Hard CI/CD Failure Threshold    │
├─────────────────────────────────┼────────────────────┼────────────────────┼─────────────────────────────────┤
│ Initial Web Client Bundle (Gzip)│ < 12 MB            │ < 8 MB             │ > 15 MB                         │
├─────────────────────────────────┼────────────────────┼────────────────────┼─────────────────────────────────┤
│ District Sector Streaming Chunk │ < 6 MB             │ < 4 MB             │ > 8 MB                          │
├─────────────────────────────────┼────────────────────┼────────────────────┼─────────────────────────────────┤
│ Time to First Interactive (TTI) │ < 2.5s (Broadband) │ < 4.0s (4G Mobile) │ > 6.0s                          │
├─────────────────────────────────┼────────────────────┼────────────────────┼─────────────────────────────────┤
│ Realtime WebSocket Bandwidth    │ < 4 KB/sec         │ < 3 KB/sec         │ > 8 KB/sec                      │
└─────────────────────────────────┴────────────────────┴────────────────────┴─────────────────────────────────┘
```

---

## 2. Rendering & Frame Rate Budgets

```
┌─────────────────────────────────┬────────────────────┬────────────────────┬─────────────────────────────────┐
│ Rendering Metric                │ Target (Desktop)   │ Target (Mobile)    │ Degradation Fallback Trigger    │
├─────────────────────────────────┼────────────────────┼────────────────────┼─────────────────────────────────┤
│ Frame Rate                      │ 60 FPS             │ 30–45 FPS          │ Drop < 25 FPS (triggers dynamic │
│                                 │                    │                    │ resolution scaling to 0.75x)    │
├─────────────────────────────────┼────────────────────┼────────────────────┼─────────────────────────────────┤
│ Draw Calls per Frame            │ < 60               │ < 45               │ > 75 draw calls                 │
├─────────────────────────────────┼────────────────────┼────────────────────┼─────────────────────────────────┤
│ Active Triangles in Frustum     │ < 45,000           │ < 25,000           │ > 60,000 triangles              │
├─────────────────────────────────┼────────────────────┼────────────────────┼─────────────────────────────────┤
│ Texture GPU VRAM Allocation     │ < 250 MB           │ < 150 MB           │ > 350 MB (triggers aggressive   │
│                                 │                    │                    │ mipmap dropping)                │
└─────────────────────────────────┴────────────────────┴────────────────────┴─────────────────────────────────┘
```

---

## 3. Hardware Target Matrix

* **Tier 1 (Desktop Enthusiast / Modern Laptop)**: Apple Silicon M1/M2/M3, Intel Core i5/i7 11th Gen+, 8GB+ RAM, Chrome/Edge/Safari. Ultra settings, dynamic shadows, high-res audio, 60 FPS.
* **Tier 2 (Mid-Tier African Smartphone / Everyday PC)**: Tecno Camon / Spark series, Infinix Note / Hot series, Samsung Galaxy A14/A24, Xiaomi Redmi 12, 4GB RAM, Android Chrome / iOS Safari. Medium settings, baked lighting, 30+ FPS.
* **Tier 3 (Budget Smartphone / Legacy Device)**: 3GB RAM, Mali G52/G57 GPU. Low settings, disabled bloom, simplified particle effects, static shadow maps.
