# BNS quotation backend

Cloudflare Worker for authenticated Shopify App Proxy quotation requests. D1 stores customer-scoped requests and Resend sends transactional confirmations. Every request starts as `pending_review`; BMT/B2B price, discounts, tax, shipping and stock remain subject to merchant review.

Production Worker: `https://bns-quotation.baitandstrike-bns.workers.dev`

Production D1: `bns-quotations` in APAC. Email delivery remains disabled until a Resend sending domain is verified.

## Required setup

1. Create a Shopify app for `baitandstrike.myshopify.com` with product read access and an App Proxy path such as `/apps/bns-quotation` pointing to the Worker URL.
2. Create D1 database `bns-quotations`, replace `database_id`, then apply migrations.
3. Store secrets with Wrangler: `SHOPIFY_API_SECRET`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, and `RESEND_API_KEY`. A static `SHOPIFY_ADMIN_ACCESS_TOKEN` can be used instead of client credentials where supported.
4. Verify a Resend sending domain, then set `QUOTATION_FROM` and `MERCHANT_EMAIL` in `wrangler.jsonc`.
5. Deploy the Worker, configure the App Proxy, then connect the theme form to `/apps/bns-quotation/api/quotations`.

Never commit secrets. Do not connect the live theme until the App Proxy signature, customer ownership, Shopify price validation, D1 migration, and email sender have been verified in preview.

