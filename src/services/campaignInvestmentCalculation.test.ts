/// <reference types="node" />
import { describe, it } from "node:test";
import { deepStrictEqual, strictEqual, rejects } from "node:assert";
import { campaignInvestmentTotal, loadCampaignGiftCost } from "./campaignInvestmentCalculation";

describe("Campaign gift investment", () => {
  it("uses gift product cost, not selling price or other product costs", async () => {
    const cost = await loadCampaignGiftCost("2026-11-01", "2026-11-08", "pizza-promo", async () => ({
      totalGiftCost: 60, totalProductCost: 300, totalRevenue: 2000, giftSellingPrice: 150,
    }));
    strictEqual(cost, 60);
  });
  it("uses exactly the campaign and period chosen inside the modal", async () => {
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
});