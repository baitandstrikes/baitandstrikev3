# BNS Atelier — Symmetry-inspired redesign

Built independently on the existing BNS Shopify Liquid theme. The requested reference is the Symmetry preset at https://themes.shopify.com/themes/symmetry/presets/symmetry, viewed on 13 October 2026. This is not the licensed Symmetry theme and does not promise its complete feature parity.

## Changes

- Montserrat body and light heading fonts, neutral colors, transparent hero header, portrait collection and product cards, centered product carousel headings, updated editorial sections, footer, product and collection layouts.
- Mobile layout at 749px and below: two-column cards, full-height hero, collapsible navigation, accessible filter toggle, compact sort controls, touch-visible quick view and full-width product layout.
- Predictive product, collection and page search with debounce, request cancellation and standard search fallback.
- Native Shopify color swatches linked to matching variants; automatic sort submission; inventory count only for tracked inventory without overselling.
- Merchant-configurable countdown promotion, journal and testimonial carousel sections. Countdown requires a future timestamp including timezone and hides when expired. No fabricated promotion or customer testimonial is prefilled.
- Existing cart drawer, quick view, Ajax add/change, product variant selection, gallery, zoom, recommendations, account pages and checkout forms retained.

## Install and configure

1. Upload the supplied theme ZIP under Online Store → Themes → Add theme. Preview before publishing.
2. Set your logo and navigation in Header. Upload desktop and mobile banner photos in Hero Slideshow; add images or collections to collection tiles. Existing SVG placeholders remain until real assets are selected.
3. Choose collections for product carousels, choose a blog for Journal, and add verified customer quotes using Testimonials. Configure optional promotion end time explicitly.
4. Configure Shopify Search & Discovery filters and product color swatches in the store. Swatches only show when the corresponding Shopify swatch data exists.
5. Check the font selections, localized text, store policies, shipping and newsletter settings. No free-shipping claim or invented review is added.
6. Verify add-to-cart, variant changes, quantities, discounts, notes, customer accounts and checkout using an unpublished Shopify preview with real store data.

## Verification and limits

Changed Liquid, schema, JSON and assets were checked with Shopify's theme validator. JavaScript syntax and interaction checks cover predictive search, mobile filters, sorting, countdown and testimonials. Local homepage preview uses actual Liquid sections with fixture products; it is not a Shopify storefront and cannot validate live Ajax cart, checkout, customer accounts or Shopify-hosted fonts.

The repository has no real photography or configured store data. Therefore screenshot equivalence to the fashion demo and every proprietary Symmetry feature (including lookbooks, hotspots, preorder configuration and full app integrations) have not been established. Store installation and publishing are not included in this change.

## Content imported from the original repository

FAQ: ten questions and answers from baitandstrikes/baitandstrike templates/page.about-us.json, also synchronized to the homepage. Contact: copy and complete address, phone, WhatsApp, opening hours and directions from templates/page.contact.json and sections/contact-page-custom.liquid. About Us: default text and all 18 preset blocks from sections/bns-b2b-about.liquid, adapted to the new design. The source about-us template itself contained FAQ, so it was not used as the business profile. About CTA links route to Contact because the new theme does not implement the old B2B registration pages. Assign Shopify pages to the faq, contact and about-us templates after installing.
