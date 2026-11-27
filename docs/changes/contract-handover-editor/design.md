---
type: Change Design
title: Contract handover inventory editor
status: draft
---

# Contract handover inventory editor

Approved in conversation on 2026-11-27. Completes the missing edit UI described by [contract quick create](../contract-quick-create/design.md).

Owners with `contracts.update` can edit the handover list in contract detail until a contract document is issued/signed. Use the existing inventory editor and atomic PUT endpoint. “Lấy lại từ phòng” replaces only the unsaved draft after confirmation; show the fetched list before saving. Cancel discards the draft. Room inventory never changes automatically.

Reuse the document section's loaded metadata to determine the lock; unknown metadata disables editing. Changes to documents update the lock immediately. The existing server/database lock remains authoritative if another session issues a document during editing. Keep failed drafts available for review. Checkout remains read-only.

Preserve the operational semantic theme, existing primitives and responsive inventory editor. No new dependency, database schema, or runtime is needed.
