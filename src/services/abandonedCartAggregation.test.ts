/// <reference types="node" />
import { describe, it } from 'node:test';
import { strictEqual, deepStrictEqual, rejects } from 'node:assert';
import { abandonedEventValue, summarizeAbandonedCarts, loadAbandonedCartSummary, type AbandonedCartEvent } from './abandonedCartAggregation';

const cart = (price: number, overrides: Partial<AbandonedCartEvent> = {}): AbandonedCartEvent => ({
  event_type: 'abandoned_cart', product_id: 'cart', session_id: 's1', visitor_id: 'v1',
  created_at: '2026-11-01T18:30:00Z', price, quantity: 3, items: [], ...overrides,
});
const purchase = (overrides: Partial<AbandonedCartEvent> = {}) => cart(120, {
  event_type: 'purchase', created_at: '2026-11-01T19:15:00Z', ...overrides,
});

describe('Abandoned cart value', () => {
  it('counts the latest R$102 snapshot once instead of R$90 + R$102', () => {
    strictEqual(summarizeAbandonedCarts([cart(102, { created_at: '2026-11-01T19:00:00Z' }), cart(90)], []).lostRevenue, 102);
  });
  it('excludes the R$120 cart purchased at 19:15 after abandonment at 18:30', () => {
    strictEqual(summarizeAbandonedCarts([cart(120)], [purchase()]).lostRevenue, 0);
  });
  it('excludes a later purchase after the report ends with a changed session', () => {
    strictEqual(summarizeAbandonedCarts([cart(120)], [purchase({ session_id: 's2', created_at: '2026-11-03T19:00:00Z' })]).lostRevenue, 0);
  });
  it('matches a purchase by session even when visitor identity is absent', () => {
    strictEqual(summarizeAbandonedCarts([cart(120, { visitor_id: null })], [purchase({ visitor_id: null })]).lostRevenue, 0);
  });
  it('does not classify a later cart as recovered by an earlier purchase', () => {
    strictEqual(summarizeAbandonedCarts([cart(120)], [purchase({ created_at: '2026-11-01T17:00:00Z' })]).lostRevenue, 120);
  });
  it('does not treat a finalize button click or another visitor as a purchase', () => {
    strictEqual(summarizeAbandonedCarts([cart(120)], [purchase({ event_type: 'checkout_finalize' }), purchase({ session_id: 'other', visitor_id: 'other' })]).lostRevenue, 120);
  });
  it('uses the R$150 cart total once for three pizzas even without items', () => {
    strictEqual(abandonedEventValue(cart(150, { items: null })), 150);
  });
  it('still multiplies genuinely legacy unit prices and deduplicates each product', () => {
    deepStrictEqual(summarizeAbandonedCarts([
      cart(40, { product_id: 'pizza', items: null }),
      cart(50, { product_id: 'pizza', items: null, created_at: '2026-11-01T18:31:00Z' }),
      cart(12, { product_id: 'drink', items: null, quantity: 1 }),
    ], []), { lostRevenue: 162, abandonedCount: 1, avgAbandonedTicket: 162 });
  });
  it('uses a visitor fallback when session is missing', () => {
    strictEqual(summarizeAbandonedCarts([cart(90, { session_id: null }), cart(102, { session_id: null, created_at: '2026-11-01T19:00:00Z' })], []).lostRevenue, 102);
  });
  it('does not invent identities for anonymous rows', () => {
    strictEqual(summarizeAbandonedCarts([cart(90, { session_id: null, visitor_id: null })], []).abandonedCount, 0);
  });
  it('keeps zero latest snapshots instead of reviving earlier amounts', () => {
    strictEqual(summarizeAbandonedCarts([cart(90), cart(0, { created_at: '2026-11-01T19:00:00Z' })], []).lostRevenue, 0);
  });
  it('derives count, total and average from the same remaining carts', () => {
    deepStrictEqual(summarizeAbandonedCarts([cart(90), cart(150, { session_id: 's2', visitor_id: 'v2' })], []), { lostRevenue: 240, abandonedCount: 2, avgAbandonedTicket: 120 });
  });
  it('loads past 1000 abandoned rows and purchase rows', async () => {
    const abandoned = Array.from({ length: 1001 }, (_, i) => cart(1, { session_id: `s${i}`, visitor_id: `v${i}` }));
    const purchases = Array.from({ length: 1001 }, (_, i) => purchase({ session_id: `p${i}`, visitor_id: `p${i}` }));
    purchases[1000] = purchase({ session_id: 's1000', visitor_id: 'v1000' });
    const summary = await loadAbandonedCartSummary(async (kind, offset, limit) => (kind === 'abandoned' ? abandoned : purchases).slice(offset, offset + limit));
    strictEqual(summary.lostRevenue, 1000);
    strictEqual(summary.abandonedCount, 1000);
  });
  it('propagates failed reads rather than returning an incomplete summary', async () => {
    await rejects(loadAbandonedCartSummary(async () => { throw new Error('Read failed'); }), /Read failed/);
  });
});