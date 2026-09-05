import React, { useEffect, useMemo, useState } from "react";
import { ShoppingCart, TrendingUp, TrendingDown } from "lucide-react";
import { subDays, format, differenceInCalendarDays } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  getVisitMetrics,
  getUtmSources,
  getUtmCampaigns,
  getDailyVisitMetrics,
  type VisitMetrics,
  type DailyMetricKey,
} from "@/services/productEventService";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/DateRangePicker";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  change?: string | null;
  isPositive?: boolean;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  change,
  isPositive = true,
  className,
  selected,
  onClick,
}) => (
  <Card
    onClick={onClick}
    className={cn(
      "border-0 bg-card text-card-foreground transition-all",
      onClick && "cursor-pointer hover:ring-2 hover:ring-primary/50",
      selected && "ring-2 ring-primary",
      className
    )}
  >
    <CardContent className="p-5">
      <p className="text-sm font-medium text-muted-foreground mb-3">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        {change && (
          <span
            className={cn(
              "flex items-center gap-1 text-sm font-semibold",
              isPositive ? "text-food-green" : "text-destructive"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {change}
          </span>
        )}
      </div>
    </CardContent>
  </Card>
);

interface ChartPoint {
  date: string;
  value: number;
}

const metricLabels: Record<DailyMetricKey, string> = {
  totalVisits: "Total de Visitas",
  uniqueVisitors: "Visitantes Únicos",
  newVisitors: "Visitantes Novos",
  returningVisitors: "Visitantes Recorrentes",
  pageViews: "Total Page Views",
  viewsPerVisit: "Visualizações por Visita",
};

const formatNumber = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")}k` : String(n);

const computeChange = (current: number, previous: number) => {
  if (previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return { label: `${Math.abs(pct).toFixed(0)}%`, isPositive: pct >= 0 };
};

const MarketingMetrics: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(today, 30),
    to: today,
  });
  const [metricType, setMetricType] = useState("visitas");
  const [visits, setVisits] = useState<VisitMetrics | null>(null);
  const [prevVisits, setPrevVisits] = useState<VisitMetrics | null>(null);
  const [utmSources, setUtmSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState("todas");
  const [utmCampaigns, setUtmCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("campanhas");
  const [selectedMetric, setSelectedMetric] = useState<DailyMetricKey>("totalVisits");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Popula o filtro de Origens com todas as utm_source presentes em product_events
  useEffect(() => {
    getUtmSources().then(setUtmSources);
    getUtmCampaigns().then(setUtmCampaigns);
  }, []);

  useEffect(() => {
    document.body.classList.add("marketing-metrics-theme");
    return () => document.body.classList.remove("marketing-metrics-theme");
  }, []);

  // Carrega métricas de visitas do product_events para o período selecionado
  // e para o período anterior equivalente (para o % de variação).
  useEffect(() => {
    if (metricType !== "visitas" || !dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    const prevEnd = format(subDays(dateRange.from, 1), "yyyy-MM-dd");
    const prevStart = format(subDays(dateRange.from, days), "yyyy-MM-dd");

    let cancelled = false;
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;
    Promise.all([
      getVisitMetrics(start, end, sourceFilter, campaignFilter),
      getVisitMetrics(prevStart, prevEnd, sourceFilter, campaignFilter),
    ]).then(([current, previous]) => {
      if (cancelled) return;
      setVisits(current);
      setPrevVisits(previous);
    });
    return () => {
      cancelled = true;
    };
  }, [metricType, dateRange, selectedSource, selectedCampaign]);

  const visitChange = (key: keyof VisitMetrics) =>
    visits && prevVisits ? computeChange(visits[key], prevVisits[key]) : null;

  // Carrega série diária da métrica selecionada para o gráfico
  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;

    let cancelled = false;
    setChartLoading(true);
    getDailyVisitMetrics(start, end, selectedMetric, sourceFilter, campaignFilter)
      .then((data) => {
        if (cancelled) return;
        setChartData(
          data.map((d) => ({
            date: format(new Date(`${d.date}T00:00:00`), "d MMM"),
            value: Number(d.value.toFixed(2)),
          }))
        );
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dateRange, selectedMetric, selectedSource, selectedCampaign]);

  const chartMax = useMemo(() => {
    if (!chartData.length) return 14000;
    const max = Math.max(...chartData.map((d) => d.value));
    return max > 0 ? Math.ceil(max * 1.1) : 10;
  }, [chartData]);

  const chartTickFormatter = (value: number) => {
    if (selectedMetric === "viewsPerVisit") return value.toFixed(1).replace(".", ",");
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")}k`;
    return String(value);
  };

  return (
    <div className="marketing-metrics-theme min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <ShoppingCart className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">
            Análise de Marketing
          </h1>
        </div>

        {/* Period selector */}
        <Card className="border-0 bg-card text-card-foreground mb-6">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <span className="text-2xl font-bold">Período</span>
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                className="w-full sm:w-auto"
                buttonClassName="rounded-full border-border bg-background px-4 py-2 text-foreground hover:bg-muted"
              />
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Select value={metricType} onValueChange={setMetricType}>
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue placeholder="Visitas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visitas">Visitas</SelectItem>
              <SelectItem value="vendas">Vendas</SelectItem>
              <SelectItem value="funil">Funil</SelectItem>
              <SelectItem value="ga4">Google Analytics</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="canais">
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue placeholder="Canais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="canais">Canais</SelectItem>
              <SelectItem value="organico">Orgânico</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="social">Social</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue placeholder="Origens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as origens</SelectItem>
              {utmSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue placeholder="Campanhas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="campanhas">Todas as campanhas</SelectItem>
              {utmCampaigns.map((campaign) => (
                <SelectItem key={campaign} value={campaign}>
                  {campaign}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <MetricCard
            label="Total de Visitas"
            value={visits ? formatNumber(visits.totalVisits) : "…"}
            change={visitChange("totalVisits")?.label ?? null}
            isPositive={visitChange("totalVisits")?.isPositive ?? true}
            selected={selectedMetric === "totalVisits"}
            onClick={() => setSelectedMetric("totalVisits")}
          />
          <MetricCard
            label="Visitantes Únicos"
            value={visits ? formatNumber(visits.uniqueVisitors) : "…"}
            change={visitChange("uniqueVisitors")?.label ?? null}
            isPositive={visitChange("uniqueVisitors")?.isPositive ?? true}
            selected={selectedMetric === "uniqueVisitors"}
            onClick={() => setSelectedMetric("uniqueVisitors")}
          />
          <MetricCard
            label="Visitantes Novos"
            value={visits ? formatNumber(visits.newVisitors) : "…"}
            change={visitChange("newVisitors")?.label ?? null}
            isPositive={visitChange("newVisitors")?.isPositive ?? true}
            selected={selectedMetric === "newVisitors"}
            onClick={() => setSelectedMetric("newVisitors")}
          />
          <MetricCard
            label="Visitantes Recorrentes"
            value={visits ? formatNumber(visits.returningVisitors) : "…"}
            change={visitChange("returningVisitors")?.label ?? null}
            isPositive={visitChange("returningVisitors")?.isPositive ?? true}
            selected={selectedMetric === "returningVisitors"}
            onClick={() => setSelectedMetric("returningVisitors")}
          />
          <MetricCard
            label="Total Page Views"
            value={visits ? formatNumber(visits.pageViews) : "…"}
            change={visitChange("pageViews")?.label ?? null}
            isPositive={visitChange("pageViews")?.isPositive ?? true}
            selected={selectedMetric === "pageViews"}
            onClick={() => setSelectedMetric("pageViews")}
          />
          <MetricCard
            label="Visualizações por Visita"
            value={visits ? visits.viewsPerVisit.toFixed(1).replace(".", ",") : "…"}
            change={visitChange("viewsPerVisit")?.label ?? null}
            isPositive={visitChange("viewsPerVisit")?.isPositive ?? true}
            selected={selectedMetric === "viewsPerVisit"}
            onClick={() => setSelectedMetric("viewsPerVisit")}
          />
          <MetricCard label="Duração média por Visita" value="—" />
          <MetricCard label="Taxa de Rejeição" value="—" />
          <MetricCard label="Scroll to Goals:" value="—" />
        </div>

        {/* Chart */}
        <Card className="border-0 bg-card text-card-foreground">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">
                {metricLabels[selectedMetric]}
              </p>
              {chartLoading && (
                <span className="text-xs text-muted-foreground">Carregando…</span>
              )}
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="visitsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--muted) / 0.3)"
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    interval={4}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    domain={[0, chartMax]}
                    tickFormatter={chartTickFormatter}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      color: "hsl(var(--card-foreground))",
                    }}
                    formatter={(value: number) => [
                      selectedMetric === "viewsPerVisit"
                        ? Number(value).toFixed(2).replace(".", ",")
                        : Number(value).toLocaleString(),
                      metricLabels[selectedMetric],
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#visitsGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketingMetrics;
