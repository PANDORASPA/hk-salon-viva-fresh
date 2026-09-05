# Salon Poke Bristol Live-Site Inventory

Captured from `https://lo-chan-hair-bristol.vercel.app` on 2026-08-13 before rebuilding the Git-backed application.

## Identity and contact

- Brand: Salon Poke Bristol / Salon Poke
- Positioning: Asian hair salon; Hong Kong hairstylist in Bristol; 20+ years' experience
- Operation: Bristol city centre, Park Row area, by appointment only
- WhatsApp: `+44 7724 594963`
- Email: `hello@salonpokebristol.com`
- Instagram: `salonpokebristol`

## Preserved routes

`/`, `/services`, `/booking`, `/gallery`, `/about`, `/location`, `/contact`, `/signin`, `/signup`, `/account`, `/terms`, `/privacy`, and protected `/admin`.

## Public image assets

- `/gallery/mens-textured-highlights.jpg`
- `/gallery/c-curl-perm.jpg`
- `/gallery/studio-interior.jpg`
- `/gallery/precision-cutting.jpg`
- `/gallery/in-the-studio.jpg`
- `/gallery/korean-cut-poster.jpg`

## Service menu

The canonical fallback service list, prices in pence, categories, and operational duration estimates are stored in `content/salon-poke-defaults.js`. Public wording retains the live site's note that final price depends on length, thickness, condition, and consultation.

## Recovery note

The live MiniMax deployment is not Git-connected. Its visible content and assets are treated as recovery inputs; the rebuilt Next.js source and versioned Supabase migrations become the maintainable source of truth after verified cutover.
