# Room setup & inventory lite (V2 PR2)

**Status: source merged; cloud hardening check open.** Room generator, templates and handover snapshots were integrated in `develop`. The 2026-11-15 migration and SQL checks are recorded, but newer `20261116100000_inventory_lite_functions_hardening.sql` (PR #26) was not confirmed applied to cloud. Baseline stabilization also corrects non-atomic template/room saves using existing replacement RPCs.

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
