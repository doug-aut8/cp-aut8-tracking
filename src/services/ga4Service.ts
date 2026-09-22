import { supabase } from "@/integrations/supabase/client";

// ---- Snapshot-based data (reads from ga4_snapshots table) ----

export interface GA4SnapshotRow {
  id: string;
  snapshot_date: string;
  report_type: string;
  data: any;
  created_at: string;
}

export const fetchSnapshots = async (
  startDate: string,
  endDate: string,
  reportType?: string
): Promise<GA4SnapshotRow[]> => {
  let query = supabase
    .from('ga4_snapshots' as any)
    .select('*')
    .gte('snapshot_date', startDate)
    .lte('snapshot_date', endDate)
    .order('snapshot_date', { ascending: true });

  if (reportType) {
    query = query.eq('report_type', reportType);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as any) || [];
};

// ---- Parse overview from snapshot ----
export interface GA4Overview {
  activeUsers: number;
  sessions: number;
  pageViews: number;
  bounceRate: number;
  avgSessionDuration: number;
  newUsers: number;
}

export const parseOverviewFromSnapshot = (snapshot: any): GA4Overview => {
  const row = snapshot?.reports?.[0]?.rows?.[0]?.metricValues || [];
  return {
    activeUsers: Number(row[0]?.value || 0),
    sessions: Number(row[1]?.value || 0),
    pageViews: Number(row[2]?.value || 0),
    bounceRate: Number(row[3]?.value || 0),
    avgSessionDuration: Number(row[4]?.value || 0),
    newUsers: Number(row[5]?.value || 0),
  };
};

// ---- Parse sources from snapshot ----
export interface GA4SourceRow {
  name: string;
  sessions: number;
  activeUsers: number;
}

export const parseSourcesFromSnapshot = (snapshot: any): GA4SourceRow[] => {
  const rows = snapshot?.reports?.[0]?.rows || [];
  return rows.map((r: any) => ({
    name: r.dimensionValues[0].value || '(not set)',
    sessions: Number(r.metricValues[0].value),
    activeUsers: Number(r.metricValues[1].value),
  }));
};

// ---- Parse conversion time from snapshot ----
export interface GA4ConversionRow {
  source: string;
  avgSessionDuration: number;
  sessions: number;
  conversions: number;
}

export const parseConversionTimeFromSnapshot = (snapshot: any): GA4ConversionRow[] => {
  const rows = snapshot?.reports?.[0]?.rows || [];
  return rows.map((r: any) => ({
    source: r.dimensionValues[0].value || '(not set)',
    avgSessionDuration: Number(r.metricValues[0].value),
    sessions: Number(r.metricValues[1].value),
    conversions: Number(r.metricValues[2].value),
  }));
};

// ---- Aggregate overview snapshots across date range ----
export const aggregateOverviews = (snapshots: GA4SnapshotRow[]): GA4Overview => {
  const overviews = snapshots.map(s => parseOverviewFromSnapshot(s.data));
  if (overviews.length === 0) {
    return { activeUsers: 0, sessions: 0, pageViews: 0, bounceRate: 0, avgSessionDuration: 0, newUsers: 0 };
  }
  return {
    activeUsers: overviews.reduce((sum, o) => sum + o.activeUsers, 0),
    sessions: overviews.reduce((sum, o) => sum + o.sessions, 0),
    pageViews: overviews.reduce((sum, o) => sum + o.pageViews, 0),
    bounceRate: overviews.reduce((sum, o) => sum + o.bounceRate, 0) / overviews.length,
    avgSessionDuration: overviews.reduce((sum, o) => sum + o.avgSessionDuration, 0) / overviews.length,
    newUsers: overviews.reduce((sum, o) => sum + o.newUsers, 0),
  };
};

// ---- Daily chart data from overview snapshots ----
export interface GA4DailyRow {
  date: string;
  activeUsers: number;
  sessions: number;
  pageViews: number;
}

export const buildDailyFromSnapshots = (snapshots: GA4SnapshotRow[]): GA4DailyRow[] => {
  return snapshots.map(s => {
    const o = parseOverviewFromSnapshot(s.data);
    const d = s.snapshot_date; // YYYY-MM-DD
    return {
      date: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
      activeUsers: o.activeUsers,
      sessions: o.sessions,
      pageViews: o.pageViews,
    };
  });
};

// ---- Parse day_hour heatmap from snapshot ----
export interface GA4DayHourRow {
  dayOfWeek: number;
  hour: number;
  sessions: number;
}

export const parseDayHourFromSnapshot = (snapshot: any): GA4DayHourRow[] => {
  const rows = snapshot?.reports?.[0]?.rows || [];
  return rows.map((r: any) => ({
    dayOfWeek: Number(r.dimensionValues[0].value),
    hour: Number(r.dimensionValues[1].value),
    sessions: Number(r.metricValues[0].value),
  }));
};

// ---- Parse devices from snapshot ----
export interface GA4DeviceRow {
  device: string;
  sessions: number;
  activeUsers: number;
}

export const parseDevicesFromSnapshot = (snapshot: any): GA4DeviceRow[] => {
  const rows = snapshot?.reports?.[0]?.rows || [];
  return rows.map((r: any) => ({
    device: r.dimensionValues[0].value || '(not set)',
    sessions: Number(r.metricValues[0].value),
    activeUsers: Number(r.metricValues[1].value),
  }));
};

// ---- Trigger manual snapshot (for testing) ----
export const triggerSnapshot = async () => {
  const { data, error } = await supabase.functions.invoke('ga4-analytics', {
    body: { mode: 'snapshot' },
  });
  if (error) throw new Error(error.message);
  return data;
};

// ---- Legacy: direct GA4 query (kept for fallback) ----
export const fetchGA4Report = async (params: {
  startDate?: string;
  endDate?: string;
  reportType: string;
}) => {
  const { data, error } = await supabase.functions.invoke('ga4-analytics', {
    body: params,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
};
