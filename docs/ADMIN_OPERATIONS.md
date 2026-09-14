# Salon Poke Admin Operations

The [current operations runbook](booking-platform-operations.md) and [launch checklist](launch-checklist-2026-09-14.md) are authoritative. This quick reference does not authorise a migration, demo seed, external send or production deployment.

## First administrator

An authorised operator creates the first Auth identity and its active `admin_users` entry in the controlled target, recording the bootstrap in the change log. Use reviewed migrations after backup/rehearsal; do not automatically load demo data. Never put passwords, private contact details or keys in Git, screenshots or release notes.

After bootstrap, manage administrator state through the audited Administrators module. SQL protects the final active administrator.

## Routine use

- Calendar: create, reschedule, confirm, complete, cancel or mark no-show; mutations and before/after audit commit together.
- Customer Records: create/edit canonical contacts; manually issue packages only to an Auth-bound customer, with a reason and a retry-stable request key. Do not link accounts by matching phone/email.
- Services and Packages: edit prices/mappings, publish services, activate/deactivate templates and reasoned customer entitlements. Stripe online purchases are hard-disabled.
- Staff: edit skills, active state, all seven weekdays and exceptional time off. Future appointments must be handled before deactivation.
- Schedule: maintain shop hours and exceptional closure dates. For emergency shutdown click **將全部星期設為關閉**, then **儲存營業時間**. Preserve all existing appointments.
- Gallery: upload approved JPG/PNG/WebP under 10 MB with meaningful alt text. A storage-cleanup warning requires exact-path operator follow-up.
- Site Content: manage phone, email, WhatsApp, Instagram HTTPS URL, address and arrival note. Blank contacts remain hidden.
- Notifications: review the failed channel and follow-up instructions; check provider history before retrying.

CSV import and unsafe legacy delete/GDPR-delete endpoints are retired with guarded admin-only `410` responses. Use audited editing; erasure needs a separately reviewed process and must never be described as completed when disabled.

## Recovery

Confirm a recoverable backup before any target schema change. Restore an application deployment only after checking additive-schema compatibility. Never delete appointments, entitlement history or audit rows as a rollback shortcut.
