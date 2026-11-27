/// <reference types="node" />
import { describe, it } from "node:test";
import { deepStrictEqual, strictEqual, rejects } from "node:assert";
import { campaignInvestmentTotal, loadCampaignGiftCost, loadCampaignGiftCosts, campaignCostMetrics, DEFAULT_INCLUDE_CAMPAIGN_GIFTS } from "./campaignInvestmentCalculation";

describe("Campaign gift investment", () => {
  it("uses gift product cost, not selling price or other product costs", async () => {
    const cost = await loadCampaignGiftCost("2026-11-01", "2026-11-08", "pizza-promo", async () => ({
      totalGiftCost: 60, totalProductCost: 300, totalRevenue: 2000, giftSellingPrice: 150,
    }));
    strictEqual(cost, 60);
  });
  it("uses exactly the campaign and main report period", async () => {
    await loadCampaignGiftCost("2026-07-01", "2026-07-23", "campanha-a", async (...args) => {
      deepStrictEqual(args, ["2026-07-01", "2026-07-23", null, "campanha-a"]);
      return { totalGiftCost: 60 };
    });
  });
  it("adds gifts to media only when selected", () => {
    strictEqual(campaignInvestmentTotal(200, 60, true), 260);
    strictEqual(campaignInvestmentTotal(200, 60, false), 200);
  });
  it("allows a gift-only investment and preserves zero when no gifts exist", () => {
    strictEqual(campaignInvestmentTotal(0, 60, true), 60);
    strictEqual(campaignInvestmentTotal(200, 0, true), 200);
  });
  it("does not query an invalid date interval", async () => {
    await rejects(loadCampaignGiftCost("2026-11-08", "2026-11-01", "promo", async () => {
      throw new Error("Should not query");
    }), /período válido/);
  });
  it("includes gift costs by default", () => {
    strictEqual(DEFAULT_INCLUDE_CAMPAIGN_GIFTS, true);
  });
  it("separates media and gifts and uses total for CAC, ROAS and LTV:CAC", () => {
    deepStrictEqual(campaignCostMetrics(200, 60, true, 2600, 10, 520), {
      mediaCost: 200, giftCost: 60, cost: 260, cac: 26, roas: 10, ltvCac: 20,
    });
  });
  it("disabling gifts leaves only media in total and efficiency metrics", () => {
    deepStrictEqual(campaignCostMetrics(200, 60, false, 2600, 10, 520), {
      mediaCost: 200, giftCost: 0, cost: 200, cac: 20, roas: 13, ltvCac: 26,
    });
  });
  it("recalculates gifts independently for each campaign when the main period changes", async () => {
    const load = async (start: string, end: string, source: null, campaign: string) => {
      strictEqual(source, null);
      strictEqual(end, "2026-11-08");
      return { totalGiftCost: campaign === "promo-a" ? (start === "2026-11-08" ? 10 : 60) : 20 };
    };
    deepStrictEqual(await loadCampaignGiftCosts("2026-11-01", "2026-11-08", ["promo-a", "promo-b"], load), { "promo-a": 60, "promo-b": 20 });
    deepStrictEqual(await loadCampaignGiftCosts("2026-11-08", "2026-11-08", ["promo-a", "promo-b"], load), { "promo-a": 10, "promo-b": 20 });
  });
  it("does not hide a failed gift calculation as zero", async () => {
    await rejects(loadCampaignGiftCosts("2026-11-01", "2026-11-08", ["promo"], async () => { throw new Error("Unavailable"); }), /Unavailable/);
  });
  it("avoids invalid divisions for campaigns without media, gifts or new customers", () => {
    deepStrictEqual(campaignCostMetrics(0, 0, true, 100, 0, null), {
      mediaCost: 0, giftCost: 0, cost: 0, cac: null, roas: null, ltvCac: null,
    });
  });
});