import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BarChart3 as PageIcon } from "lucide-react";
import React, { useState, useMemo } from "react";
import { subDays, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  Users, Eye, MousePointerClick, Clock, UserPlus, BarChart3,
  Globe, Timer, RefreshCw, Smartphone, Monitor, Tablet,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/DateRangePicker";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

import {
  fetchSnapshots, aggregateOverviews, buildDailyFromSnapshots,
  parseSourcesFromSnapshot, parseConversionTimeFromSnapshot,
  parseDayHourFromSnapshot, parseDevicesFromSnapshot,
  triggerSnapshot,
  type GA4SnapshotRow,
} from "@/services/ga4Service";

const dailyChartConfig: ChartConfig = {
  activeUsers: { label: "Usuários", color: "hsl(var(--primary))" },
  sessions: { label: "Sessões", color: "hsl(142, 76%, 36%)" },
  pageViews: { label: "Pageviews", color: "hsl(262, 83%, 58%)" },
};

const sourcesChartConfig: ChartConfig = {
  sessions: { label: "Sessões", color: "hsl(142, 76%, 36%)" },
};

const conversionChartConfig: ChartConfig = {
  avgSessionDuration: { label: "Duração Média (s)", color: "hsl(25, 95%, 53%)" },
  conversions: { label: "Conversões", color: "hsl(var(--primary))" },
};

const DEVICE_COLORS = ["hsl(var(--primary))", "hsl(142, 76%, 36%)", "hsl(262, 83%, 58%)", "hsl(25, 95%, 53%)"];
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const GA4Metrics = () => {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [activePresetLabel, setActivePresetLabel] = useState<string | undefined>(undefined);

  const today = new Date();
  const datePresets = useMemo(() => [
    {
      label: "Hoje",
      range: { from: today, to: today },
    },
    {
      label: "Esta Semana",
      range: { from: startOfWeek(today, { weekStartsOn: 0 }), to: endOfWeek(today, { weekStartsOn: 0 }) },
    },
    {
      label: "Este Mês",
      range: { from: startOfMonth(today), to: endOfMonth(today) },
    },
    {
      label: "Personalizado",
      range: undefined as DateRange | undefined,
    },
  ], []);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (!range) {
      setActivePresetLabel("Personalizado");
      return;
    }
    const matched = datePresets.find(p => {
      if (!p.range) return false;
      const fromEq = p.range.from && range.from ? format(p.range.from, "yyyy-MM-dd") === format(range.from, "yyyy-MM-dd") : p.range.from === range.from;
      const toEq = p.range.to && range.to ? format(p.range.to, "yyyy-MM-dd") === format(range.to, "yyyy-MM-dd") : p.range.to === range.to;
      return fromEq && toEq;
    });
    setActivePresetLabel(matched ? matched.label : undefined);
  };

  const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : format(subDays(new Date(), 30), "yyyy-MM-dd");
  const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

  const { data: allSnapshots, isLoading } = useQuery({
    queryKey: ["ga4-snapshots", startDate, endDate],
    queryFn: () => fetchSnapshots(startDate, endDate),
  });

  const overviewSnapshots = (allSnapshots || []).filter((s: GA4SnapshotRow) => s.report_type === 'overview');
  const sourcesSnapshots = (allSnapshots || []).filter((s: GA4SnapshotRow) => s.report_type === 'sources');
  const conversionSnapshots = (allSnapshots || []).filter((s: GA4SnapshotRow) => s.report_type === 'conversion_time');
  const dayHourSnapshots = (allSnapshots || []).filter((s: GA4SnapshotRow) => s.report_type === 'day_hour');
  const devicesSnapshots = (allSnapshots || []).filter((s: GA4SnapshotRow) => s.report_type === 'devices');

  const overview = aggregateOverviews(overviewSnapshots);
  const dailyData = buildDailyFromSnapshots(overviewSnapshots);

  // Merge sources across days
  const sourcesData = useMemo(() => {
    const map = new Map<string, { sessions: number; activeUsers: number }>();
    sourcesSnapshots.forEach((s: GA4SnapshotRow) => {
      parseSourcesFromSnapshot(s.data).forEach(row => {
        const existing = map.get(row.name) || { sessions: 0, activeUsers: 0 };
        map.set(row.name, {
          sessions: existing.sessions + row.sessions,
          activeUsers: existing.activeUsers + row.activeUsers,
        });
      });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);
  }, [sourcesSnapshots]);

  // Merge conversion time data
  const conversionData = useMemo(() => {
    const map = new Map<string, { avgDuration: number; sessions: number; conversions: number; count: number }>();
    conversionSnapshots.forEach((s: GA4SnapshotRow) => {
      parseConversionTimeFromSnapshot(s.data).forEach(row => {
        const existing = map.get(row.source) || { avgDuration: 0, sessions: 0, conversions: 0, count: 0 };
        map.set(row.source, {
          avgDuration: existing.avgDuration + row.avgSessionDuration,
          sessions: existing.sessions + row.sessions,
          conversions: existing.conversions + row.conversions,
          count: existing.count + 1,
        });
      });
    });
    return Array.from(map.entries())
      .map(([source, v]) => ({
        source,
        avgSessionDuration: Math.round(v.avgDuration / v.count),
        sessions: v.sessions,
        conversions: v.conversions,
      }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 10);
  }, [conversionSnapshots]);

  // Build heatmap data: 7 days x 24 hours
  const heatmapData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    dayHourSnapshots.forEach((s: GA4SnapshotRow) => {
      parseDayHourFromSnapshot(s.data).forEach(row => {
        if (row.dayOfWeek >= 0 && row.dayOfWeek < 7 && row.hour >= 0 && row.hour < 24) {
          grid[row.dayOfWeek][row.hour] += row.sessions;
        }
      });
    });
    const maxVal = Math.max(1, ...grid.flat());
    return { grid, maxVal };
  }, [dayHourSnapshots]);

  // Merge devices data
  const devicesData = useMemo(() => {
    const map = new Map<string, { sessions: number; activeUsers: number }>();
    devicesSnapshots.forEach((s: GA4SnapshotRow) => {
      parseDevicesFromSnapshot(s.data).forEach(row => {
        const existing = map.get(row.device) || { sessions: 0, activeUsers: 0 };
        map.set(row.device, {
          sessions: existing.sessions + row.sessions,
          activeUsers: existing.activeUsers + row.activeUsers,
        });
      });
    });
    return Array.from(map.entries())
      .map(([device, v]) => ({ device, ...v }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [devicesSnapshots]);

  const totalDeviceSessions = devicesData.reduce((sum, d) => sum + d.sessions, 0);

  const snapshotMutation = useMutation({
    mutationFn: triggerSnapshot,
    onSuccess: () => {
      toast.success("Snapshot coletado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ga4-snapshots"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const getHeatmapColor = (value: number, max: number) => {
    if (value === 0) return "hsl(var(--muted))";
    const intensity = value / max;
    if (intensity < 0.25) return "hsl(var(--primary) / 0.2)";
    if (intensity < 0.5) return "hsl(var(--primary) / 0.4)";
    if (intensity < 0.75) return "hsl(var(--primary) / 0.65)";
    return "hsl(var(--primary))";
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile': return <Smartphone className="h-4 w-4" />;
      case 'tablet': return <Tablet className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const hasGA4Data = (allSnapshots || []).length > 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <AdminPageHeader title="GA4 Metrics" icon={PageIcon} iconBg="bg-indigo-100" iconColor="text-indigo-600" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-4 mb-8">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => snapshotMutation.mutate()}
            disabled={snapshotMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${snapshotMutation.isPending ? 'animate-spin' : ''}`} />
            Coletar Snapshot
          </Button>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            className="w-full sm:w-auto"
            presets={datePresets}
            activePresetLabel={activePresetLabel}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {!hasGA4Data ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-4 mb-8">
              <BarChart3 className="h-12 w-12" />
              <p className="text-lg">Nenhum snapshot GA4 encontrado neste período.</p>
              <p className="text-sm">Clique em "Coletar Snapshot" ou aguarde o cron diário.</p>
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Usuários Ativos</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{overview.activeUsers.toLocaleString("pt-BR")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Sessões</CardTitle>
                    <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{overview.sessions.toLocaleString("pt-BR")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Pageviews</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{overview.pageViews.toLocaleString("pt-BR")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Taxa Rejeição</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{`${(overview.bounceRate * 100).toFixed(1)}%`}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Duração Média</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{formatDuration(overview.avgSessionDuration)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Novos Usuários</CardTitle>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{overview.newUsers.toLocaleString("pt-BR")}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Chart */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">Métricas Diárias</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={dailyChartConfig} className="h-[300px] w-full">
                    <LineChart data={dailyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="activeUsers" stroke="var(--color-activeUsers)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="sessions" stroke="var(--color-sessions)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="pageViews" stroke="var(--color-pageViews)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Heatmap - Days x Hours */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">Heatmap — Sessões por Dia e Horário</CardTitle>
                </CardHeader>
                <CardContent>
                  {dayHourSnapshots.length === 0 ? (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                      Sem dados de dia/hora. Colete um novo snapshot.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="min-w-[600px]">
                        <div className="flex items-center gap-[2px] mb-[2px]">
                          <div className="w-10 shrink-0" />
                          {Array.from({ length: 24 }, (_, h) => (
                            <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground font-medium">
                              {String(h).padStart(2, '0')}
                            </div>
                          ))}
                        </div>
                        {DAY_LABELS.map((dayLabel, dayIdx) => (
                          <div key={dayIdx} className="flex items-center gap-[2px] mb-[2px]">
                            <div className="w-10 shrink-0 text-xs text-muted-foreground font-medium text-right pr-2">
                              {dayLabel}
                            </div>
                            {Array.from({ length: 24 }, (_, h) => {
                              const val = heatmapData.grid[dayIdx][h];
                              return (
                                <div
                                  key={h}
                                  className="flex-1 aspect-square rounded-sm cursor-default transition-colors"
                                  style={{ backgroundColor: getHeatmapColor(val, heatmapData.maxVal), minHeight: 18 }}
                                  title={`${dayLabel} ${String(h).padStart(2, '0')}h — ${val} sessões`}
                                />
                              );
                            })}
                          </div>
                        ))}
                        <div className="flex items-center justify-end gap-2 mt-3">
                          <span className="text-[10px] text-muted-foreground">Menos</span>
                          {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
                            <div
                              key={intensity}
                              className="w-4 h-4 rounded-sm"
                              style={{
                                backgroundColor: intensity === 0
                                  ? "hsl(var(--muted))"
                                  : `hsl(var(--primary) / ${intensity < 0.5 ? intensity * 1.6 : intensity < 0.75 ? 0.65 : 1})`,
                              }}
                            />
                          ))}
                          <span className="text-[10px] text-muted-foreground">Mais</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="h-4 w-4" /> Fontes de Tráfego
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={sourcesChartConfig} className="h-[300px] w-full">
                      <BarChart data={sourcesData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={90} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="sessions" fill="var(--color-sessions)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Smartphone className="h-4 w-4" /> Dispositivos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {devicesData.length === 0 ? (
                      <div className="flex items-center justify-center h-[120px] text-muted-foreground text-sm">
                        Sem dados de dispositivos. Colete um novo snapshot.
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={devicesData}
                              dataKey="sessions"
                              nameKey="device"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              innerRadius={40}
                              paddingAngle={3}
                              label={({ device, percent }) => `${device} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                              fontSize={12}
                            >
                              {devicesData.map((_, idx) => (
                                <Cell key={idx} fill={DEVICE_COLORS[idx % DEVICE_COLORS.length]} />
                              ))}
                            </Pie>
                            <ChartTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="w-full space-y-2">
                          {devicesData.map((d, idx) => (
                            <div key={d.device} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DEVICE_COLORS[idx % DEVICE_COLORS.length] }} />
                                {getDeviceIcon(d.device)}
                                <span className="capitalize">{d.device}</span>
                              </div>
                              <div className="flex items-center gap-4 text-muted-foreground">
                                <span>{d.sessions.toLocaleString("pt-BR")} sessões</span>
                                <span className="font-medium text-foreground">
                                  {totalDeviceSessions > 0 ? ((d.sessions / totalDeviceSessions) * 100).toFixed(1) : 0}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Conversion Time */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Timer className="h-4 w-4" /> Tempo até Conversão (por Fonte)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {conversionData.length === 0 ? (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      Sem dados de conversão no período
                    </div>
                  ) : (
                    <ChartContainer config={conversionChartConfig} className="h-[300px] w-full">
                      <BarChart data={conversionData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="source" fontSize={11} tickLine={false} axisLine={false} width={90} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="avgSessionDuration" fill="var(--color-avgSessionDuration)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GA4Metrics;
