# Project Architecture

- Campaign investments store media spend only; campaign reports reuse `fetchSalesSummary` per campaign and main report dates for dynamic gift CMV and derive CAC/ROAS/LTV:CAC from the combined cost, avoiding frozen or double-counted gifts.

- Resolve scheduled and manual store operation in `useStoreOpen`, with shared React Query caches and an admin-only `configuracoes` override; this keeps both admin controls, public status and checkout aligned without changing weekly hours.

- Buyer and campaign reports share historical first-order classification by normalized phone; journey totals also include legacy purchase sessions, with unidentified buyer profiles unless an exact order ID exists. Never approximate order links; apply event filters and omit unlinked legacy events for neighborhood filters.

- Marketing metrics uses four top-level views with inline reports; GA4 reads share the `ga4-snapshots` query key and heatmaps accept source-specific values so external sessions and internal orders are never presented as the same measure.
- Marketing's internal visits heatmap pages through all visit events and deduplicates sessions per weekday/hour bucket to avoid silently truncated counts.
- Location sales reports share one cached, completely paginated order query per header filter set; city/neighborhood rankings and product/order details derive from those same orders so drilldowns cannot bypass filters.

- Use `getOrderItemDisplayName` for customer-facing and printed item titles so half-pizza formatting stays consistent without changing stored order data.
- Dine-in (QR table) orders are stored in `pedidos_sabor_delivery` with `origem = 'salao'` and `mesa`, so kitchen, printing and reports share one order pipeline; the `mesas` table only tracks tables.
- Printed order identifiers use the first six characters of the order UUID so the comanda and delivery stub show the same short code as the app.
- Missing distance-provider configuration must return a handled availability message rather than an HTTP 500 so checkout remains usable.
- Thermal print font settings are stored together under `comanda_font_sizes`, with distinct fields for the order receipt and delivery stub, so preview, test, and live printing stay synchronized.
- A newly split layout color must fall back to the key it was separated from while that key is absent in `configuracoes` (e.g. `cor_background_cards` → `cor_background_header`), so stores configured before the split keep their current look.

