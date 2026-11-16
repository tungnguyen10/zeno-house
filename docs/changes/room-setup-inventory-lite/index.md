# Room setup & inventory lite (V2 PR2)

**Status: implementation-review.** Tasks 1–11 implemented TDD-first on Node 22; local typecheck/test/lint/knowledge:check all pass. Depends on [atomic-building-room-setup](../atomic-building-room-setup/index.md). Cloud migration apply + type regeneration and git/PR remain maintainer-run — see verification. Batch-page entry points (room list + building detail) are wired.

- [Design](./design.md)
- [Implementation plan](./implementation-plan.md)
- [Verification](./verification.md)
- Parent brief: [ZENO House V2 — Flow Optimization Brief](../zeno-house-v2-optimization/brief.md)

## Capabilities to update on acceptance

- New: `room-inventory`
- [rooms-api](../../capabilities/rooms-api.md)
- [rooms-ui](../../capabilities/rooms-ui.md)
- [contracts-api](../../capabilities/contracts-api.md)
- [buildings-ui](../../capabilities/buildings-ui.md)
