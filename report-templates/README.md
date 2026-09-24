# DVCLC Report Templates

Publish each `main.typ` to the report service with the slug shown below, then select its published version under **Admin > Settings > Report Templates**.

| Application report | Suggested service slug |
| --- | --- |
| Registration invoice | `dvclc-invoice` |
| Billing statement | `dvclc-billing-statement` |
| Donation receipt | `dvclc-donation-receipt` |

The templates load the immutable submitted payload mounted by the report service as `data.json`:

```typst
#let data = json("data.json")
```

After publishing, the application discovers the generated JSON Schema and pins both the selected version and its schema hash. Publish a new version when changing a contract; do not replace an already-published version.

Each directory includes `sample-data.json` for the report service's template preview and contract-publication workflow. Classroom schedules and attendance reports remain in the application's existing printable HTML system and are intentionally not configured here.
