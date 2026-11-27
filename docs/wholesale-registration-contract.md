# Wholesale registration frontend contract

This theme page is assigned to `/pages/wholesale-registration-form`. It submits only to same-origin Shopify App Proxy paths. Both section settings must be configured with paths beginning with `/apps/` before the page enables its form.

## Step 1: request an email verification code

The browser sends an `application/x-www-form-urlencoded` POST to the section setting `submit_endpoint` with these fields:

- `business_name`
- `contact_name`
- `email`
- `phone`
- `business_type` (`physical_store`, `online_store`, `reseller`, `marketplace`, or `other`)
- `address`
- `city`
- `store_url` (optional)
- `purchase_estimate` (optional)
- `privacy_consent=yes`
- `source=wholesale-registration-form` and `form_version=1` (untrusted metadata; never use these for authorization)

The backend must validate and allowlist fields, require `privacy_consent=yes`, apply anti-spam/rate limits, store a pending verification challenge, and send a one-time email code. It must not create or link a customer, approve an application, or trust browser-supplied tags/status at this stage.

Success response (HTTP 200 or 202, JSON):

```json
{ "ok": true, "challenge_id": "opaque-server-generated-id" }
```

The UI stores the challenge ID only in page memory and shows the email-code step. A challenge ID is not proof of identity and must be checked by the backend.

## Step 2: verify or resend the code

The browser POSTs to `verify_endpoint` with `challenge_id`, `action=verify`, and `verification_code` (six digits). For a resend it sends `challenge_id` and `action=resend`. The backend must enforce expiry, single use, retry limits, and resend rate limits.

For successful verification, the backend rechecks the customer, creates or links the customer without overwriting existing profile data, creates a wholesale application with review status `Menunggu`, and adds `status-menunggu` without replacing other tags. The customer must not be downgraded if already approved. Return:

```json
{ "ok": true }
```

For failures return a non-2xx status with a generic JSON body such as `{ "ok": false }`. Do not disclose whether an email already has an account. The frontend displays translated generic messages and never renders server text as HTML.

## Completion

Both endpoint paths must use Shopify's same-origin App Proxy route. Leaving either setting blank keeps the application form unavailable with a contact link. After endpoints are available, configure them in the section settings and verify the server contract before publishing.
