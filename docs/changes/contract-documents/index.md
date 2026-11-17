# Contract documents (V2 PR4b)

**Status: source merged; deployed smoke / appendix open.** Contract DOCX issuance, private bucket, immutable snapshot, regeneration, signing, void/reissue and cleanup job exist; production migration/verification and local QA were reported passed 2026-11-15. Production application smoke, worker environment secret, failed-file recovery and appendix issuance still need verification/implementation. **Source currently rejects `type: appendix`; do not advertise it as delivered.**

- [Design](./design.md)
- [Implementation plan](./implementation-plan.md)
- [Verification](./verification.md)
- Parent brief: [ZENO House V2 — Flow Optimization Brief](../zeno-house-v2-optimization/brief.md)

## Capabilities to update on acceptance

- New: `contract-documents`
- [contracts-ui](../../capabilities/contracts-ui.md)
- [contracts-api](../../capabilities/contracts-api.md)
- [supabase-scheduled-workers](../../capabilities/supabase-scheduled-workers.md)
