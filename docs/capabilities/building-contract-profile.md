---
type: Capability Specification
title: "building-contract-profile"
status: stable
tags: [capability, requirements, buildings, contracts]
---

# building-contract-profile Specification

## Purpose
Define the per-building lessor (contract signer) profile and default contract terms, their permissions, partial saving, and the readiness signals that tell whether a building can issue a contract and invoices.

## Requirements

### Requirement: One contract profile per building
The system SHALL store at most one profile per building in `building_contract_profiles`, containing the lessor identity (full name, date of birth, permanent address, ID number, ID issue date and place), lessor contact (phone, optional email), an optional brand name, contract defaults (term in months, deposit in months of rent), terms (notice days, deposit refund days, renewal months, extra-occupant fee, drilling fee, fingerprint reset fee) and signing copies (`signed_copies`, `copies_per_party`). The table is service-role only; clients never query it directly.

#### Scenario: Owner contact is not a separate source
- **WHEN** a building is created or edited
- **THEN** the building API does not accept `owner_name`, `owner_phone` or `owner_email`; contact for the person who signs contracts lives only in this profile

#### Scenario: Legacy owner contact was folded in
- **WHEN** the owner-to-lessor migration ran
- **THEN** owner name, phone and email were copied only into lessor fields that were empty and passed the same validation as the app (name 2-100 characters, a phone accepted by the tenant phone normalizer, a well-formed email); invalid values were skipped and existing lessor values were never overwritten

### Requirement: Profile read, full save and partial save
`GET /api/buildings/:id/contract-profile` SHALL return the profile or `null`. `PUT` SHALL replace the whole profile with a validated body. `PATCH` SHALL update only the keys present in the body: it validates the stored row merged with the patch (so cross-field rules such as `copies_per_party * 2 <= signed_copies` hold), writes only the patched keys, and leaves every other column untouched. A new row created by `PATCH` uses database defaults (`signed_copies` 2, `copies_per_party` 1).

#### Scenario: Patch does not reset other fields
- **WHEN** a client sends `{ "notice_days": 30 }`
- **THEN** only `notice_days` changes and `signed_copies`, `copies_per_party` and all lessor fields keep their stored values

#### Scenario: Patch breaks a cross-field rule
- **WHEN** a patch lowers `signed_copies` below `copies_per_party * 2`
- **THEN** the response is 422 and nothing is written

#### Scenario: Unknown keys
- **WHEN** the body contains a key that is not a profile field (for example `owner_name`)
- **THEN** the response is 422

#### Scenario: Numeric text from forms
- **WHEN** a form sends numbers as strings (for example `"4"`)
- **THEN** they are coerced before validation, including `signed_copies` and `copies_per_party`

### Requirement: Permissions and PII
Reading requires `building-contract-profile.read`, writing requires `building-contract-profile.write`, and the PII fields (`lessor_date_of_birth`, `lessor_permanent_address`, `lessor_id_number`) additionally require `building-contract-profile.pii.read`. Without it responses mask the ID number to its last four digits and null the date of birth and address, and writes that would change a PII field SHALL be rejected with 403. Building scope is checked for every read and write.

#### Scenario: Manager reads
- **WHEN** a scoped manager reads the profile
- **THEN** the lessor name, phone, email and contract terms are returned and PII is masked or hidden

#### Scenario: Write without PII permission
- **WHEN** a user with write but without PII permission patches a PII field
- **THEN** the response is 403 and nothing is written

#### Scenario: Audit
- **WHEN** a profile is saved or patched
- **THEN** `building.contract_profile.updated` is appended with `configured_first_time` and the names of the changed fields, never their values

### Requirement: Building readiness
`GET /api/buildings/:id/readiness` and the settings bootstrap SHALL report `contract` and `billing` readiness with the list of missing codes. Contract readiness needs the seven lessor fields (not the email), the two contract defaults, the six terms, the billing schedule (generation day and payment due day) and an invoice profile. Billing readiness needs the schedule, the electricity rate unless pricing is tiered, the water rate and an invoice profile. Readiness is computed from unmasked data for every role.

#### Scenario: Optional email
- **WHEN** only `lessor_email` is empty
- **THEN** contract readiness is unaffected

### Requirement: Settings bootstrap carries setup data
`GET /api/buildings/:id/settings-bootstrap` SHALL include `contractProfile` (masked per permission), `readiness`, `roomIdsWithoutInventory` and `vacantRoomIds` (both empty without `rooms.read`). Rooms without inventory are counted with one query per building so item volume cannot truncate the result.

#### Scenario: Room occupancy for setup
- **WHEN** the bootstrap is loaded for a building with archived, vacant and furnished rooms
- **THEN** archived rooms are ignored, `vacantRoomIds` lists rooms with status `available`, and `roomIdsWithoutInventory` lists rooms with zero inventory items
