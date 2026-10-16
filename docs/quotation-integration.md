# Online quotation: implementation and activation

Implemented in theme: signed-in customers can create a printable draft from the server-rendered Shopify cart, enter shipping/billing addresses, copy shipping to billing, and print/save PDF through the browser. Anonymous visitors see login; empty carts see product selection. Personal data is not stored in localStorage. Editing details hides stale output. Existing contact-form submission remains the manual request path.

The repository includes a Cloudflare Worker backend in `quotation-backend/`. It verifies Shopify App Proxy signatures, requires a signed-in customer, checks standard Shopify variant prices server-side, stores customer-scoped requests in D1, creates durable quotation IDs, and can send transactional confirmation through Resend.

Production infrastructure configured on October 16, 2026:

- Worker: `https://bns-quotation.baitandstrike-bns.workers.dev`
- D1 database: `bns-quotations`
- Shopify app: `BNS Online Quotation`
- Storefront proxy: `/apps/bns-quotation`
- Shopify client credentials are stored as encrypted Worker secrets.
- The proxy health route and anonymous-access rejection have been verified through the live storefront.

Resend delivery remains disabled until BNS adds a domain that can be verified in Resend. Set `RESEND_API_KEY`, `QUOTATION_FROM`, and `MERCHANT_EMAIL` after domain verification; requests will still be stored in D1 while email is unavailable.

Because BMT can apply pricing outside Shopify's standard variant price, every new request remains `pending_review`. Do not represent the server-validated standard price as final B2B pricing until BMT verification is implemented.

Backend required before enabling those capabilities:

1. Install a Shopify app with an app proxy and use the official Shopify authentication library. Verify proxy signatures, shop, timestamp and signed logged_in_customer_id; never trust a customer ID supplied in JSON. Require a logged-in customer. Use CSRF protection, idempotency keys and rate limits for creation.
2. POST cart variant IDs, quantities and address fields. Fetch authoritative variants, prices, currency, stock and customer eligibility on the server. Respect market/B2B contextual pricing; do not substitute public retail prices for a B2B price. Reject unavailable items and invalid quantities. Decide tax/shipping treatment and quote validity with the merchant before issuance.
3. Store an immutable price/item/address snapshot under the authenticated customer, with a database-generated unique number, created/expiry timestamps and delivery state. Persist idempotently before rendering PDF. Never put customer documents in a public assets folder.
4. Generate the PDF from that snapshot. Email it using a configured sender and durable delivery queue. Record delivery/failure; retries must not create duplicate quotations. Do not report email success on enqueue alone.
5. GET history/detail/PDF must constrain queries by authenticated shop AND customer ID. Expose a download via an authenticated route or a short-lived signed URL. Cross-customer access must return 404.
6. Test signatures, replay/CSRF, anonymous access, cross-customer IDs, client price tampering, stock/quantity limits, contextual prices, duplicate requests, failed email retries, print pagination, mobile and checkout/cart preservation.

Remaining production prerequisite: a verified transactional email sender domain. Keep all credentials server-side. Theme changes remain suitable for an unpublished preview until they are reviewed and published through the normal theme workflow.

