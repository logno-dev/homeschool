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

## Itemized invoices and billing statements

Invoice and billing-statement payloads now include `lineItems`, an array of
`{ "description": "Sam — Art Studio", "amount": "$30.00" }` objects. Amounts are
formatted currency strings, just like the existing `amounts` fields.

Publish the updated templates and schemas as new versions, then select those
versions under **Admin > Settings > Report Templates**. Existing hosted templates
must be updated to render the new field; a strict schema must also allow it.
The bundled samples include registration and per-child class charges.

The registration fee is a family-level line item because pricing rules may price
the family as a group. Its description includes the distinct child count and
matching pricing tier (or first-child/additional-child calculation for legacy
pricing). Children enrolled only in registration-exempt classes are excluded and
noted. If the current calculation differs from the recorded registration fee,
the description identifies it as a recorded amount rather than attributing it
to a current tier. These descriptions use the existing `lineItems` contract.
Class charges are shown per child when current enrollment
charges reconcile with the stored billed subtotal; otherwise the recorded class
subtotal is shown rather than inventing historical detail. Any difference between
the component fees and recorded total is displayed as a fee adjustment. Paid and
balance totals remain separate from charges. Donation receipt data is unchanged.
