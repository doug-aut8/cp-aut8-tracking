import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const pemContent = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsignedToken}.${sigB64}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

function buildReportRequest(reportType: string, startDate: string, endDate: string) {
  const dateRanges = [{ startDate, endDate }];

  const reports: Record<string, any> = {
    overview: {
      requests: [{
        dateRanges,
        metrics: [
          { name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' },
          { name: 'bounceRate' }, { name: 'averageSessionDuration' }, { name: 'newUsers' },
        ],
      }],
    },
    sources: {
      requests: [{
        dateRanges,
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }],
    },
    conversion_time: {
      requests: [{
        dateRanges,
        dimensions: [{ name: 'sessionSource' }],
        metrics: [
          { name: 'averageSessionDuration' },
          { name: 'sessions' },
          { name: 'conversions' },
        ],
        orderBys: [{ metric: { metricName: 'conversions' }, desc: true }],
        limit: 10,
      }],
    },
    daily: {
      requests: [{
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }],
    },
    pages: {
      requests: [{
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }],
    },
    devices: {
      requests: [{
        dateRanges,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      }],
    },
    cities: {
      requests: [{
        dateRanges,
        dimensions: [{ name: 'city' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }],
    },
    day_hour: {
      requests: [{
        dateRanges,
        dimensions: [{ name: 'dayOfWeek' }, { name: 'hour' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [
          { dimension: { dimensionName: 'dayOfWeek' } },
          { dimension: { dimensionName: 'hour' } },
        ],
      }],
    },
  };

  if (!reports[reportType]) throw new Error(`Unknown reportType: ${reportType}`);
  return reports[reportType];
}

async function fetchGA4Data(accessToken: string, propertyId: string, requestBody: any) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`GA4 API error [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function runDailySnapshot(accessToken: string, propertyId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const snapshotDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
  const startDate = snapshotDate;
  const endDate = snapshotDate;

  const reportTypes = ['overview', 'sources', 'conversion_time', 'day_hour', 'devices'];
  const results: Record<string, any> = {};

  for (const rt of reportTypes) {
    try {
      const reqBody = buildReportRequest(rt, startDate, endDate);
      const data = await fetchGA4Data(accessToken, propertyId, reqBody);
      results[rt] = data;

      // Upsert snapshot
      const { error } = await supabase.from('ga4_snapshots').upsert(
        { snapshot_date: snapshotDate, report_type: rt, data },
        { onConflict: 'snapshot_date,report_type' }
      );
      if (error) console.error(`Upsert error for ${rt}:`, error);
    } catch (e) {
      console.error(`Error fetching ${rt}:`, e);
      results[rt] = { error: String(e) };
    }
  }

  return { snapshot_date: snapshotDate, results };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const saJson = Deno.env.get('GA4_SERVICE_ACCOUNT_JSON');
    if (!saJson) throw new Error('GA4_SERVICE_ACCOUNT_JSON not configured');
    const propertyId = Deno.env.get('GA4_PROPERTY_ID');
    if (!propertyId) throw new Error('GA4_PROPERTY_ID not configured');

    const serviceAccount = JSON.parse(saJson);
    const accessToken = await getAccessToken(serviceAccount);

    const body = await req.json();
    const { mode, reportType, startDate = 'yesterday', endDate = 'yesterday' } = body;

    // SNAPSHOT MODE: called by cron, fetches all report types and saves to DB
    if (mode === 'snapshot') {
      const result = await runDailySnapshot(accessToken, propertyId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // QUERY MODE: on-demand single report (legacy/fallback)
    const requestBody = buildReportRequest(reportType || 'overview', startDate, endDate);
    const gaData = await fetchGA4Data(accessToken, propertyId, requestBody);

    return new Response(JSON.stringify(gaData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('GA4 Analytics error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
