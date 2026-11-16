# Identity card benchmark fixtures

Fully fictional data only. Never add real photos, names, ID numbers or addresses to the repository.

Each case is a pair: a ground-truth `<case>.json` and its image files in this folder.

```json
{
  "images": ["case-01-front.png", "case-01-back.png"],
  "below_card_field": "id_issued_date",
  "expected": {
    "document_type": "can_cuoc_2024",
    "capture_layout": "separate_images",
    "identity_mismatch": false,
    "fields": { "full_name": null, "id_number": null, "date_of_birth": null, "gender": null,
      "nationality": null, "residence_address": null, "address_label": null,
      "birth_registration_place": null, "place_of_origin": null, "id_issued_date": null,
      "id_expiry_date": null, "id_issued_place": null }
  }
}
```

`below_card_field` is optional and marks a field printed outside the card frame (VNeID screenshots). Cover the four formats in Tenant V2 SPEC-05 (FMT-01 to FMT-04) plus clear, glare, blur, low light, crop, tilt, front-only and a mismatching pair.
