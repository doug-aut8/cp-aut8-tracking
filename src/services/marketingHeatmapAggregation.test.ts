/// <reference types="node" />
import { describe, it as test } from "node:test";
import { deepStrictEqual } from "node:assert";
import { aggregateVisitHeatmap } from "./marketingHeatmapAggregation";

describe("Internal visits heatmap", () => {
  test("counts the same session only once per weekday and hour, separately from orders or GA4", () => {
    const created_at = new Date(2026, 10, 2, 19).toISOString();
    deepStrictEqual(aggregateVisitHeatmap([
      { id: "1", created_at, session_id: "session-a" },
      { id: "2", created_at, session_id: "session-a" },
      { id: "3", created_at, session_id: "session-b" },
    ]), [{ dayOfWeek: 1, hour: 19, value: 2 }]);
  });
});