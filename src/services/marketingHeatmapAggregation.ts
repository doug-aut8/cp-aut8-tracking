export type VisitHeatmapEvent = { id: string; created_at: string; session_id: string | null };

// A session is counted once in each weekday/hour bucket, matching the internal visits heatmap.
export function aggregateVisitHeatmap(events: VisitHeatmapEvent[]) {
  const buckets = new Map<string, { dayOfWeek: number; hour: number; sessions: Set<string> }>();
  for (const event of events) {
    const date = new Date(event.created_at);
    if (Number.isNaN(date.getTime())) continue;
    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    const key = `${dayOfWeek}-${hour}`;
    const bucket = buckets.get(key) ?? { dayOfWeek, hour, sessions: new Set<string>() };
    bucket.sessions.add(event.session_id ?? event.id);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map(({ dayOfWeek, hour, sessions }) => ({ dayOfWeek, hour, value: sessions.size }));
}