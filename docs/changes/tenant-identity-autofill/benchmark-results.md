---
type: Verification Record
title: "tenant-identity-autofill — benchmark results"
status: draft
change_state: benchmark-pending
tags: [change, benchmark, tenants, ai, ocr, v2]
---

# Tenant identity autofill — benchmark results

Not run yet. Run manually after fictional fixtures exist, then paste the aggregate output here. Never add identity values or images.

```bash
NUXT_AI_TENANT_ANTHROPIC_API_KEY=... NUXT_AI_TENANT_VISION_MODEL=... \
  node scripts/benchmark-tenant-vision.mjs --i-confirm-fictional-fixtures
```

| Field | Value |
| --- | --- |
| Model id | |
| Date | |
| Samples (smoke / extended) | |
| JSON validity | |
| ID exact match | |
| Name exact match | |
| Date of birth match | |
| Layout match | |
| Below-card field read | |
| Mismatch detection | |
| Unsupported guesses | |
| Latency p50 / p95 | |
| Tokens in / out | |
| USD per successful extraction | |
| Failure rate | |

Decision rule: see Tenant V2 §G2 (initial proposal at least 98% on critical fields over an extended set).
