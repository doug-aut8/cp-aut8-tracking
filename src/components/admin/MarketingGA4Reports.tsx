import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { fetchSnapshots, parseOverviewFromSnapshot, buildDailyFromSnapshots, parseSourcesFromSnapshot, parseDevicesFromSnapshot, parseConversionTimeFromSnapshot, parseDayHourFromSnapshot } from "@/services/ga4Service";
import { fetchSalesHeatmap } from "@/services/salesAnalyticsService";
import { MetricsHeatmap } from "./MetricsHeatmap";
import { fetchMenuVisitsHeatmap } from "@/services/marketingHeatmapService";

const number = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const duration = (value: number) => `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;

export function MarketingGA4Reports({ start, end, mode }: { start: string; end: string; mode: "acquisition" | "hours" }) {
  const snapshots = useQuery({ queryKey: ["ga4-snapshots", start, end], queryFn: () => fetchSnapshots(start, end), staleTime: 60_000 });
  const sales = useQuery({ queryKey: ["sales-heatmap", start, end], queryFn: () => fetchSalesHeatmap(start, end), enabled: mode === "hours", staleTime: 60_000 });
  const visits = useQuery({ queryKey: ["marketing-menu-visits-heatmap", start, end], queryFn: () => fetchMenuVisitsHeatmap(start, end), enabled: mode === "hours", staleTime: 60_000 });
  const [heatMetric, setHeatMetric] = useState<"orders" | "revenue">("orders");
  const data = useMemo(() => {
    const all = snapshots.data ?? [];
    const overviewRows = all.filter(s => s.report_type === "overview");
    const overview = overviewRows.map(s => parseOverviewFromSnapshot(s.data));
    const sessions = overview.reduce((sum, row) => sum + row.sessions, 0);
    const sources = new Map<string, { name: string; sessions: number; activeUsers: number }>();
    const devices = new Map<string, { device: string; sessions: number }>();
    const conversions = new Map<string, { source: string; sessions: number; conversions: number; weightedDuration: number }>();
    all.forEach(s => {
      if (s.report_type === "sources") parseSourcesFromSnapshot(s.data).forEach(row => {
        const old = sources.get(row.name) ?? { name: row.name, sessions: 0, activeUsers: 0 };
        old.sessions += row.sessions; old.activeUsers += row.activeUsers; sources.set(row.name, old);
      });
      if (s.report_type === "devices") parseDevicesFromSnapshot(s.data).forEach(row => {
        const old = devices.get(row.device) ?? { device: row.device, sessions: 0 };
        old.sessions += row.sessions; devices.set(row.device, old);
      });
      if (s.report_type === "conversion_time") parseConversionTimeFromSnapshot(s.data).forEach(row => {
        const old = conversions.get(row.source) ?? { source: row.source, sessions: 0, conversions: 0, weightedDuration: 0 };
        old.sessions += row.sessions; old.conversions += row.conversions;
        old.weightedDuration += row.avgSessionDuration * row.sessions; conversions.set(row.source, old);
      });
    });
    return {
      sessions, overviewRows,
      views: overview.reduce((sum, row) => sum + row.pageViews, 0),
      bounce: sessions ? overview.reduce((sum, row) => sum + row.bounceRate * row.sessions, 0) / sessions : 0,
      duration: sessions ? overview.reduce((sum, row) => sum + row.avgSessionDuration * row.sessions, 0) / sessions : 0,
      daily: buildDailyFromSnapshots(overviewRows),
      sources: [...sources.values()].sort((a, b) => b.sessions - a.sessions),
      devices: [...devices.values()].sort((a, b) => b.sessions - a.sessions),
      conversions: [...conversions.values()].sort((a, b) => b.conversions - a.conversions),
      heat: all.filter(s => s.report_type === "day_hour").flatMap(s => parseDayHourFromSnapshot(s.data)).map(row => ({ ...row, value: row.sessions })),
    };
  }, [snapshots.data]);
  const state = snapshots.isLoading ? "Carregando Google Analytics…" : snapshots.isError ? "Não foi possível carregar o Google Analytics." : !snapshots.data?.length ? "Nenhum relatório GA4 coletado neste período." : null;
  return <div className="mt-8 space-y-8 text-foreground">
    {mode === "hours" && <section className="space-y-4 border-t border-border pt-6">
      <div><h2 className="text-xl font-semibold">Visitas por dia e horário · Cardápio</h2><p className="mt-1 text-xs text-muted-foreground">Período completo · sessões distintas por dia da semana e horário · horário local do navegador ({Intl.DateTimeFormat().resolvedOptions().timeZone}) · sem filtros de origem, campanha ou localização.</p></div>
      {visits.isLoading ? <p className="text-sm text-muted-foreground">Carregando visitas…</p> : visits.isError ? <div className="flex flex-wrap items-center gap-3"><p>Não foi possível carregar as visitas.</p><Button variant="outline" onClick={() => visits.refetch()}>Tentar novamente</Button></div> : !visits.data?.length ? <p className="text-sm text-muted-foreground">Sem visitas registradas no período.</p> : <MetricsHeatmap rows={visits.data} unit="sessões do cardápio" />}
    </section>}
    <section className="space-y-4 border-t border-border pt-6">
      <div><h2 className="text-xl font-semibold">{mode === "hours" ? "Sessões por dia e horário · GA4" : "Google Analytics · GA4"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Período completo · relatórios diários do GA4 · independente dos filtros de origem, campanha e localização do cardápio.</p>
        {snapshots.data?.length ? <p className="mt-1 text-xs text-muted-foreground">Última coleta disponível: {[...snapshots.data].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))[0]?.snapshot_date.split("-").reverse().join("/")} · fuso da propriedade GA4</p> : null}
      </div>
      {state ? <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground"><p>{state}</p>{snapshots.isError && <Button variant="outline" onClick={() => snapshots.refetch()}>Tentar novamente</Button>}</div> : mode === "hours" ? (
        data.heat.length ? <MetricsHeatmap rows={data.heat} unit="sessões GA4" /> : <p className="text-sm text-muted-foreground">Sem relatório de dia e horário no período.</p>
      ) : <>
        {data.overviewRows.length > 0 ? <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[
            ["Sessões GA4", number(data.sessions)], ["Visualizações de página GA4", number(data.views)], ["Rejeição GA4", `${number(data.bounce * 100)}%`], ["Duração média da sessão GA4", duration(data.duration)],
          ].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-xl font-bold">{value}</p></div>)}</div>
          <div className="h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.daily}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="date" /><YAxis /><Tooltip />
            <Line dataKey="sessions" name="Sessões GA4" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
          </LineChart></ResponsiveContainer></div>
        </> : <p className="text-sm text-muted-foreground">Sem relatório geral GA4 no período.</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <section><h3 className="mb-3 font-semibold">Fontes de tráfego · GA4</h3><Table><TableHeader><TableRow><TableHead>Fonte / meio</TableHead><TableHead className="text-right">Sessões</TableHead></TableRow></TableHeader><TableBody>{data.sources.map(row => <TableRow key={row.name}><TableCell className="break-words">{row.name}</TableCell><TableCell className="text-right">{number(row.sessions)}</TableCell></TableRow>)}{!data.sources.length && <TableRow><TableCell colSpan={2}>Sem dados de fontes.</TableCell></TableRow>}</TableBody></Table></section>
          <section><h3 className="mb-3 font-semibold">Dispositivos · GA4</h3><Table><TableHeader><TableRow><TableHead>Aparelho</TableHead><TableHead className="text-right">Sessões</TableHead></TableRow></TableHeader><TableBody>{data.devices.map(row => <TableRow key={row.device}><TableCell>{({ mobile: "Celular", desktop: "Computador", tablet: "Tablet" } as Record<string, string>)[row.device] ?? row.device}</TableCell><TableCell className="text-right">{number(row.sessions)}</TableCell></TableRow>)}{!data.devices.length && <TableRow><TableCell colSpan={2}>Sem dados de dispositivos.</TableCell></TableRow>}</TableBody></Table></section>
        </div>
      </>}
    </section>
    {mode === "hours" && <>
      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Vendas por dia e horário · Pedidos</h2><p className="mt-1 text-xs text-muted-foreground">Período completo · pedidos não cancelados · horário local do navegador ({Intl.DateTimeFormat().resolvedOptions().timeZone})</p></div>
          <div className="flex gap-2"><Button size="sm" variant={heatMetric === "orders" ? "default" : "outline"} onClick={() => setHeatMetric("orders")}>Pedidos</Button><Button size="sm" variant={heatMetric === "revenue" ? "default" : "outline"} onClick={() => setHeatMetric("revenue")}>Receita</Button></div>
        </div>
        {sales.isLoading ? <p>Carregando vendas…</p> : sales.isError ? <div className="flex items-center gap-3"><p>Não foi possível carregar as vendas.</p><Button variant="outline" onClick={() => sales.refetch()}>Tentar novamente</Button></div> : !sales.data?.length ? <p className="text-sm text-muted-foreground">Sem vendas no período.</p> : <MetricsHeatmap rows={sales.data.map(row => ({ ...row, value: row[heatMetric] }))} unit="pedidos" money={heatMetric === "revenue"} />}
      </section>
      <section className="space-y-3 border-t border-border pt-6"><h2 className="text-xl font-semibold">Duração da sessão e eventos de conversão por fonte · GA4</h2>
        <p className="text-xs text-muted-foreground">Duração da sessão não representa o tempo até a compra. Conversões são os eventos definidos no GA4, não pedidos confirmados.</p>
        <Table><TableHeader><TableRow><TableHead>Fonte</TableHead><TableHead className="text-right">Sessões</TableHead><TableHead className="text-right">Conversões GA4</TableHead><TableHead className="text-right">Duração média</TableHead></TableRow></TableHeader><TableBody>{data.conversions.map(row => <TableRow key={row.source}><TableCell>{row.source}</TableCell><TableCell className="text-right">{number(row.sessions)}</TableCell><TableCell className="text-right">{number(row.conversions)}</TableCell><TableCell className="text-right">{duration(row.sessions ? row.weightedDuration / row.sessions : 0)}</TableCell></TableRow>)}{!data.conversions.length && <TableRow><TableCell colSpan={4}>{state ?? "Sem dados de conversão GA4 no período."}</TableCell></TableRow>}</TableBody></Table>
      </section>
    </>}
  </div>;
}