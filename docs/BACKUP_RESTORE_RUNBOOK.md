# LapKart Backup And Restore Runbook

This runbook is for production Supabase data, Edge Functions, and storefront release recovery.

## Ownership

- Primary restore approver: owner/admin role in Supabase Auth.
- Operators allowed to inspect backups: owner, admin, viewer.
- Operators allowed to restore or rotate credentials: owner/admin only.
- Never run destructive restore commands from a local shell without a fresh production backup and a written restore target.

## Backup Schedule

- Daily: Supabase managed database backup.
- Before migrations: take a manual database backup or create a Supabase branch and verify migrations there first.
- Before bulk imports: export products with `GET /admin/products/export` and keep the CSV with the import job id.
- Before Edge Function deploys: record git commit SHA, deployed function version, and required secrets.

## Manual Database Backup

1. Confirm the active Supabase project ref.
2. Export schema and data from the Supabase dashboard or CLI.
3. Store the artifact in the approved private storage location.
4. Record backup time, operator, project ref, and artifact name in the incident notes.

## Restore Decision Checklist

- Confirm the incident cannot be fixed with a forward migration or targeted data patch.
- Identify the exact restore point and expected data loss window.
- Pause checkout with the `new_checkout`, `cod`, and `razorpay_payments` feature flags if order/payment state is at risk.
- Notify the team before restore starts.
- Keep one owner/admin session active during recovery.

## Restore Procedure

1. Create a Supabase branch from the selected backup when possible.
2. Run smoke SQL checks:
   - `select count(*) from public.products;`
   - `select count(*) from public.orders;`
   - `select count(*) from public.user_roles where role in ('owner', 'admin');`
3. Verify `public.consume_rate_limit` exists and `public.feature_flags` has checkout flags.
4. Test auth login and admin access on the branch.
5. Restore production using Supabase's managed restore flow.
6. Re-apply any migrations newer than the restore snapshot.
7. Redeploy Edge Functions if function code or secrets drifted.

## Post-Restore Verification

- Open `/products` and verify product count, filters, and pagination.
- Open `/admin` as owner/admin and verify analytics, products, orders, users, support, and fulfillment load.
- Call:
  - `GET /admin/products?page=1&pageSize=50`
  - `GET /admin/orders?page=1&pageSize=50`
  - `GET /admin/feature-flags`
  - `GET /admin/monitoring/events?page=1&pageSize=20`
- Verify realtime order updates from admin to customer order page.
- Re-enable checkout flags only after Razorpay and COD smoke checks pass.

## Rollback And Evidence

- Record restore start/end time, operator, backup id, project ref, git SHA, and verification notes.
- Save any failed SQL/API responses in the incident notes.
- Keep the pre-restore backup until the incident review is closed.
