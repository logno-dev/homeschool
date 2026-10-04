# Class fee refunds

## Deployment

Apply `drizzle/0059_class_fee_refunds.sql` through the project's migration process
before deploying the application changes. The migration adds the class-charge
and refund-decision ledgers and snapshots existing **registered** enrollments.
No live database migration or external refund is performed by the code changes.

Historical class changes made before these snapshots cannot be reconstructed
reliably. Existing unallocated overpayments remain in the existing overpayment
workflow. If stored class-fee totals differ from the initial snapshots, reconcile
the bill before using class-specific refunds; the refund endpoint rejects such
discrepancies.

## Admin workflow

1. Change/drop a student's class through registration management (or the family
   registration-change flow).
2. Open **Payments → Class Refunds**. The original class fee remains on the bill
   and in the class's reimbursement total until an admin reviews it.
3. Choose a full/partial completed refund, waive an unpaid fee, or retain the fee.
   Record the reason and date. PayPal refunds require the external refund ID.
4. A monetary refund creates a negative payment record and lowers both the
   family's class charges and paid amount by the same amount. A waiver lowers
   charges only and is limited to the unpaid balance. Retaining a fee leaves
   amounts unchanged. Partial decisions retain the remaining class charge.

These controls **record** completed refunds; they do not initiate transfers.
PayPal supports `POST /v2/payments/captures/{capture_id}/refund`, but this app does
not yet initiate or reconcile provider refunds. Refund permission on the deployed
PayPal credentials has not been verified.

## Accounting

- Class reimbursement totals use original class charges minus refunds/waivers,
  rather than current enrollment multiplied by the current class price.
- Charges are snapshotted per family, child, and class. Later class price changes
  do not rewrite existing charges. Dropped charges remain until reviewed.
- Rejoining after a refund creates a new charge, crediting any retained fee.
- Fee recalculation preserves retained charges and approved reductions.
- A request key and unique method/reference prevent duplicate recording on
  retries; charge changes, audit history, negative payments, and bill updates
  commit in one database transaction.
- Reimbursements reserve the class balance whether pending or paid. New records
  and marking pending records paid cannot exceed the net available balance.
- If refunds reduce a class below existing reimbursements, the payments page
  flags the excess. Pending amounts can be adjusted (including to zero); paid
  amounts are preserved for reconciliation with the teacher.
- Registration-fee tier changes continue to use the existing registration-fee
  calculation. This refund review applies to class fees.

Tests: `node scripts/test-class-fee-refunds.mjs` and
`node scripts/test-financial-line-items.mjs`.
