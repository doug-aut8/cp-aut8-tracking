import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Brain as PageIcon } from "lucide-react";
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { subDays, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  Eye, Globe, ShoppingCart, Megaphone, DollarSign,
  ChevronLeft, ChevronRight, Package, Search, Filter,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/DateRangePicker";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { XAxis, YAxis, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

import {
  fetchSalesHeatmap, fetchSalesBySource, fetchSalesByCampaign, fetchItemPerformance,
  fetchCampaignDetail, fetchSourceDetail, fetchSalesByMedium, fetchSalesByContent, fetchSalesByTerm,
} from "@/services/salesAnalyticsService";
import { getFunnelData, getMenuVisitsBreakdown, getAddToCartBreakdown, getCheckoutDurationBreakdown, getPurchasesBreakdown, getAbandonedTicketBreakdown, getProductViewsBreakdown, type FunnelData } from "@/services/productEventService";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";


const salesSourceChartConfig: ChartConfig = {
  revenue: { label: "Receita", color: "hsl(var(--primary))" },
  orders: { label: "Pedidos", color: "hsl(142, 76%, 36%)" },
};

const salesCampaignChartConfig: ChartConfig = {
  revenue: { label: "Receita", color: "hsl(262, 83%, 58%)" },
  orders: { label: "Pedidos", color: "hsl(25, 95%, 53%)" },
};

const salesMediumChartConfig: ChartConfig = {
  revenue: { label: "Receita", color: "hsl(340, 82%, 52%)" },
  orders: { label: "Pedidos", color: "hsl(200, 98%, 39%)" },
};

const salesContentChartConfig: ChartConfig = {
  revenue: { label: "Receita", color: "hsl(47, 100%, 47%)" },
  orders: { label: "Pedidos", color: "hsl(160, 84%, 39%)" },
};

const salesTermChartConfig: ChartConfig = {
  revenue: { label: "Receita", color: "hsl(280, 67%, 51%)" },
  orders: { label: "Pedidos", color: "hsl(14, 100%, 57%)" },
};

const SALES_HEATMAP_COLORS = {
  empty: "hsl(var(--muted))",
  low: "hsl(142, 76%, 36%, 0.2)",
  medium: "hsl(142, 76%, 36%, 0.45)",
  high: "hsl(142, 76%, 36%, 0.7)",
  max: "hsl(142, 76%, 36%)",
};

const VISITS_HEATMAP_COLORS = {
  empty: "hsl(var(--muted))",
  low: "hsl(262, 83%, 58%, 0.2)",
  medium: "hsl(262, 83%, 58%, 0.45)",
  high: "hsl(262, 83%, 58%, 0.7)",
  max: "hsl(262, 83%, 58%)",
};

const DEVICE_COLORS = ["hsl(var(--primary))", "hsl(142, 76%, 36%)", "hsl(262, 83%, 58%)", "hsl(25, 95%, 53%)"];
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const AdminGA4 = () => {
  
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


  // Sales analytics queries
  const { data: salesHeatmapData } = useQuery({
    queryKey: ["sales-heatmap", startDate, endDate],
    queryFn: () => fetchSalesHeatmap(startDate, endDate),
  });

  // Menu visits heatmap (sessions per day/hour from product_events)
  const { data: visitsHeatmapEvents } = useQuery({
    queryKey: ["menu-visits-heatmap", startDate, endDate],
    queryFn: async () => {
      const startISO = new Date(`${startDate}T00:00:00`).toISOString();
      const endISO = new Date(`${endDate}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from("product_events")
        .select("created_at, session_id, event_type")
        .in("event_type", ["visita_cardapio_nova", "visita_cardapio_recorrente"])
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .limit(10000);
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  const { data: salesBySourceData } = useQuery({
    queryKey: ["sales-by-source", startDate, endDate],
    queryFn: () => fetchSalesBySource(startDate, endDate),
  });

  const { data: salesByCampaignData } = useQuery({
    queryKey: ["sales-by-campaign", startDate, endDate],
    queryFn: () => fetchSalesByCampaign(startDate, endDate),
  });

  const { data: salesByMediumData } = useQuery({
    queryKey: ["sales-by-medium", startDate, endDate],
    queryFn: () => fetchSalesByMedium(startDate, endDate),
  });

  const { data: salesByContentData } = useQuery({
    queryKey: ["sales-by-content", startDate, endDate],
    queryFn: () => fetchSalesByContent(startDate, endDate),
  });

  const { data: salesByTermData } = useQuery({
    queryKey: ["sales-by-term", startDate, endDate],
    queryFn: () => fetchSalesByTerm(startDate, endDate),
  });

  const { data: itemPerformanceData } = useQuery({
    queryKey: ["item-performance", startDate, endDate],
    queryFn: () => fetchItemPerformance(startDate, endDate),
  });

  // Funnel data query
  const { data: funnelRawData } = useQuery({
    queryKey: ["funnel-data", startDate, endDate],
    queryFn: () => getFunnelData(startDate, endDate),
  });

  const [funnelProduct, setFunnelProduct] = useState<string>("all");
  const [visitsModalOpen, setVisitsModalOpen] = useState(false);
  const [viewsModalOpen, setViewsModalOpen] = useState(false);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [purchasesModalOpen, setPurchasesModalOpen] = useState(false);

  const { data: viewsBreakdown, isLoading: isViewsBreakdownLoading } = useQuery({
    queryKey: ["product-views-breakdown", startDate, endDate],
    queryFn: () => getProductViewsBreakdown(startDate, endDate),
    enabled: viewsModalOpen,
  });

  const { data: categoriesList } = useQuery({
    queryKey: ["all-categories-names"],
    queryFn: async () => {
      const { getAllCategories } = await import("@/services/categoryService");
      return getAllCategories();
    },
    enabled: viewsModalOpen,
  });

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    (categoriesList || []).forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [categoriesList]);

  const sortedFullList = useMemo(() => {
    if (!viewsBreakdown?.fullList) return [];
    return [...viewsBreakdown.fullList].sort((a, b) => b.conversion - a.conversion);
  }, [viewsBreakdown]);

  const { data: visitsBreakdown, isLoading: isVisitsBreakdownLoading } = useQuery({
    queryKey: ["menu-visits-breakdown", startDate, endDate],
    queryFn: () => getMenuVisitsBreakdown(startDate, endDate),
    enabled: visitsModalOpen,
  });

  const { data: cartBreakdown, isLoading: isCartBreakdownLoading } = useQuery({
    queryKey: ["add-to-cart-breakdown", startDate, endDate],
    queryFn: () => getAddToCartBreakdown(startDate, endDate),
    enabled: cartModalOpen,
  });

  const { data: checkoutBreakdown, isLoading: isCheckoutBreakdownLoading } = useQuery({
    queryKey: ["checkout-duration-breakdown", startDate, endDate],
    queryFn: () => getCheckoutDurationBreakdown(startDate, endDate),
    enabled: checkoutModalOpen,
  });

  const { data: abandonedTicket } = useQuery({
    queryKey: ["abandoned-ticket-breakdown", startDate, endDate],
    queryFn: () => getAbandonedTicketBreakdown(startDate, endDate),
    enabled: checkoutModalOpen,
  });

  const { data: purchasesBreakdown, isLoading: isPurchasesBreakdownLoading } = useQuery({
    queryKey: ["purchases-breakdown", startDate, endDate],
    queryFn: () => getPurchasesBreakdown(startDate, endDate),
    enabled: purchasesModalOpen,
  });

  const funnelChartData = useMemo(() => {
    const items = funnelRawData?.perProduct || [];
    const globals = funnelRawData?.globals || {
      menuVisits: 0,
      beginCheckout: 0,
      viewItemSessions: 0,
      addToCartSessions: 0,
      purchaseSessions: 0,
    };
    let views = 0, addToCart = 0, purchases = 0;

    if (funnelProduct === "all") {
      // Totais globais = sessões únicas (uma sessão que viu 3 produtos conta 1x)
      views = globals.viewItemSessions;
      addToCart = globals.addToCartSessions;
      purchases = globals.purchaseSessions;
    } else {
      const item = items.find(i => i.product_id === funnelProduct);
      if (item) { views = item.views; addToCart = item.addToCart; purchases = item.purchases; }
    }

    const menuVisits = globals.menuVisits;
    const beginCheckout = globals.beginCheckout;

    const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
    const convTotal = pct(purchases, menuVisits || views);

    return {
      steps: [
        { name: "Visitas ao Cardápio", value: menuVisits, rate: 100, dropoff: 0 },
        { name: "Visualizações", value: views, rate: pct(views, menuVisits), dropoff: Math.max(menuVisits - views, 0) },
        { name: "Add ao Carrinho", value: addToCart, rate: pct(addToCart, views), dropoff: Math.max(views - addToCart, 0) },
        { name: "Início de Checkout", value: beginCheckout, rate: pct(beginCheckout, addToCart), dropoff: Math.max(addToCart - beginCheckout, 0) },
        { name: "Compras", value: purchases, rate: pct(purchases, beginCheckout), dropoff: Math.max(beginCheckout - purchases, 0) },
      ],
      convTotal,
    };
  }, [funnelRawData, funnelProduct]);

  // Products that have been sold (for funnel dropdown)
  const funnelProductOptions = useMemo(() => {
    return (funnelRawData?.perProduct || []).filter(i => i.purchases > 0);
  }, [funnelRawData]);

  const [itemPage, setItemPage] = useState(0);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 10;

  const { data: campaignDetailData, isLoading: isCampaignDetailLoading } = useQuery({
    queryKey: ["campaign-detail", startDate, endDate, selectedCampaign],
    queryFn: () => fetchCampaignDetail(startDate, endDate, selectedCampaign!),
    enabled: !!selectedCampaign,
  });

  const { data: sourceDetailData, isLoading: isSourceDetailLoading } = useQuery({
    queryKey: ["source-detail", startDate, endDate, selectedSource],
    queryFn: () => fetchSourceDetail(startDate, endDate, selectedSource!),
    enabled: !!selectedSource,
  });

  const paginatedItems = useMemo(() => {
    const items = itemPerformanceData || [];
    const totalQuantity = items.reduce((s, i) => s + i.quantitySold, 0);
    const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
    const start = itemPage * ITEMS_PER_PAGE;
    const page = items.slice(start, start + ITEMS_PER_PAGE);
    const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
    return { page, totalPages, totalQuantity, totalRevenue, totalItems: items.length };
  }, [itemPerformanceData, itemPage]);



  // Build menu visits heatmap: count distinct sessions per day/hour
  const visitsHeatmap = useMemo(() => {
    const grid: Set<string>[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => new Set<string>()));
    (visitsHeatmapEvents || []).forEach((ev: any) => {
      const d = new Date(ev.created_at);
      const day = d.getDay();
      const hour = d.getHours();
      const sid = ev.session_id || `${ev.created_at}-${Math.random()}`;
      grid[day][hour].add(sid);
    });
    const counts = grid.map(row => row.map(s => s.size));
    const maxVal = Math.max(1, ...counts.flat());
    return { grid: counts, maxVal };
  }, [visitsHeatmapEvents]);

  // Build sales heatmap: 7 days x 24 hours
  const salesHeatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    (salesHeatmapData || []).forEach(row => {
      if (row.dayOfWeek >= 0 && row.dayOfWeek < 7 && row.hour >= 0 && row.hour < 24) {
        grid[row.dayOfWeek][row.hour] += row.orders;
      }
    });
    const maxVal = Math.max(1, ...grid.flat());
    return { grid, maxVal };
  }, [salesHeatmapData]);



  const getVisitsHeatmapColor = (value: number, max: number) => {
    if (value === 0) return VISITS_HEATMAP_COLORS.empty;
    const intensity = value / max;
    if (intensity < 0.25) return VISITS_HEATMAP_COLORS.low;
    if (intensity < 0.5) return VISITS_HEATMAP_COLORS.medium;
    if (intensity < 0.75) return VISITS_HEATMAP_COLORS.high;
    return VISITS_HEATMAP_COLORS.max;
  };

  const getSalesHeatmapColor = (value: number, max: number) => {
    if (value === 0) return SALES_HEATMAP_COLORS.empty;
    const intensity = value / max;
    if (intensity < 0.25) return SALES_HEATMAP_COLORS.low;
    if (intensity < 0.5) return SALES_HEATMAP_COLORS.medium;
    if (intensity < 0.75) return SALES_HEATMAP_COLORS.high;
    return SALES_HEATMAP_COLORS.max;
  };

  const hasSalesData = (salesHeatmapData || []).length > 0 || (salesBySourceData || []).length > 0 || (salesByCampaignData || []).length > 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <AdminPageHeader title="Inteligência de Marketing" icon={PageIcon} iconBg="bg-indigo-100" iconColor="text-indigo-600" />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-4 mb-8">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            className="w-full sm:w-auto"
            presets={datePresets}
            activePresetLabel={activePresetLabel}
          />
        </div>
      </div>


          {/* ===== SALES ANALYTICS SECTION (always visible, independent of GA4) ===== */}
          <div className="mt-10 mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Análise de Vendas
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Dados de pedidos reais (Supabase)</p>
          </div>

          {/* Menu Visits Heatmap */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" /> Heatmap — Visitas no Cardápio por Dia e Horário
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(visitsHeatmapEvents || []).length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  Sem dados de visitas no período selecionado.
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
                          const val = visitsHeatmap.grid[dayIdx][h];
                          return (
                            <div
                              key={h}
                              className="flex-1 aspect-square rounded-sm cursor-default transition-colors"
                              style={{ backgroundColor: getVisitsHeatmapColor(val, visitsHeatmap.maxVal), minHeight: 18 }}
                              title={`${dayLabel} ${String(h).padStart(2, '0')}h — ${val} sessões`}
                            />
                          );
                        })}
                      </div>
                    ))}
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <span className="text-[10px] text-muted-foreground">Menos</span>
                      {[VISITS_HEATMAP_COLORS.empty, VISITS_HEATMAP_COLORS.low, VISITS_HEATMAP_COLORS.medium, VISITS_HEATMAP_COLORS.high, VISITS_HEATMAP_COLORS.max].map((color, i) => (
                        <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: color }} />
                      ))}
                      <span className="text-[10px] text-muted-foreground">Mais</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales Heatmap */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Heatmap — Vendas por Dia e Horário
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(salesHeatmapData || []).length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  Sem dados de vendas no período selecionado.
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
                          const val = salesHeatmap.grid[dayIdx][h];
                          return (
                            <div
                              key={h}
                              className="flex-1 aspect-square rounded-sm cursor-default transition-colors"
                              style={{ backgroundColor: getSalesHeatmapColor(val, salesHeatmap.maxVal), minHeight: 18 }}
                              title={`${dayLabel} ${String(h).padStart(2, '0')}h — ${val} pedidos`}
                            />
                          );
                        })}
                      </div>
                    ))}
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <span className="text-[10px] text-muted-foreground">Menos</span>
                      {[SALES_HEATMAP_COLORS.empty, SALES_HEATMAP_COLORS.low, SALES_HEATMAP_COLORS.medium, SALES_HEATMAP_COLORS.high, SALES_HEATMAP_COLORS.max].map((color, i) => (
                        <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: color }} />
                      ))}
                      <span className="text-[10px] text-muted-foreground">Mais</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Sales by Source */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Vendas por Origem (UTM Source)
                  </CardTitle>
                  {(salesBySourceData || []).length > 0 && (
                    <Select
                      value={selectedSource || ""}
                      onValueChange={(val) => setSelectedSource(val || null)}
                    >
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue placeholder="Detalhar origem..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(salesBySourceData || []).map((s) => (
                          <SelectItem key={s.source} value={s.source}>
                            {s.source}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {(salesBySourceData || []).length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Sem dados de UTM. As vendas aparecerão aqui conforme pedidos com UTMs forem criados.
                  </div>
                ) : (
                  <ChartContainer config={salesSourceChartConfig} className="h-[300px] w-full">
                    <BarChart data={salesBySourceData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="source" fontSize={11} tickLine={false} axisLine={false} width={75} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Sales by Campaign */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone className="h-4 w-4" /> Vendas por Campanha
                  </CardTitle>
                  {(salesByCampaignData || []).length > 0 && (
                    <Select
                      value={selectedCampaign || ""}
                      onValueChange={(val) => setSelectedCampaign(val || null)}
                    >
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue placeholder="Detalhar campanha..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(salesByCampaignData || []).map((c) => (
                          <SelectItem key={c.campaign} value={c.campaign}>
                            {c.campaign}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {(salesByCampaignData || []).length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Sem dados de campanhas. Adicione ?utm_campaign=nome nas URLs de campanhas.
                  </div>
                ) : (
                  <ChartContainer config={salesCampaignChartConfig} className="h-[300px] w-full">
                    <BarChart data={salesByCampaignData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="campaign" fontSize={11} tickLine={false} axisLine={false} width={75} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* UTM Medium / Content / Term */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Sales by Medium */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Vendas por Mídia (Medium)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(salesByMediumData || []).length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Sem dados de utm_medium no período.
                  </div>
                ) : (
                  <ChartContainer config={salesMediumChartConfig} className="h-[300px] w-full">
                    <BarChart data={salesByMediumData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="medium" fontSize={11} tickLine={false} axisLine={false} width={75} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Sales by Content */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Vendas por Conteúdo (Content)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(salesByContentData || []).length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Sem dados de utm_content no período.
                  </div>
                ) : (
                  <ChartContainer config={salesContentChartConfig} className="h-[300px] w-full">
                    <BarChart data={salesByContentData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="content" fontSize={11} tickLine={false} axisLine={false} width={75} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Sales by Term */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" /> Vendas por Termo (Term)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(salesByTermData || []).length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Sem dados de utm_term no período.
                  </div>
                ) : (
                  <ChartContainer config={salesTermChartConfig} className="h-[300px] w-full">
                    <BarChart data={salesByTermData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="term" fontSize={11} tickLine={false} axisLine={false} width={75} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Campaign Detail Modal */}
          <Dialog open={!!selectedCampaign} onOpenChange={(open) => { if (!open) setSelectedCampaign(null); }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Campanha: {selectedCampaign}
                </DialogTitle>
                <DialogDescription>
                  Produtos vendidos via esta campanha no período de {startDate} a {endDate}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
                {isCampaignDetailLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (campaignDetailData || []).length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    Nenhum item encontrado para esta campanha.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const items = campaignDetailData || [];
                        const totalQty = items.reduce((s, i) => s + i.quantitySold, 0);
                        const totalRev = items.reduce((s, i) => s + i.revenue, 0);
                        return (
                          <>
                            <TableRow className="bg-muted/30 font-semibold">
                              <TableCell></TableCell>
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right">{totalQty.toLocaleString("pt-BR")}</TableCell>
                              <TableCell className="text-right">{formatCurrency(totalRev)}</TableCell>
                            </TableRow>
                            {items.map((item, idx) => (
                              <TableRow key={item.name}>
                                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">{item.quantitySold.toLocaleString("pt-BR")}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                              </TableRow>
                            ))}
                          </>
                        );
                      })()}
                    </TableBody>
                  </Table>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Source Detail Modal */}
          <Dialog open={!!selectedSource} onOpenChange={(open) => { if (!open) setSelectedSource(null); }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Origem: {selectedSource}
                </DialogTitle>
                <DialogDescription>
                  Produtos vendidos via esta origem no período de {startDate} a {endDate}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
                {isSourceDetailLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (sourceDetailData || []).length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    Nenhum item encontrado para esta origem.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const items = sourceDetailData || [];
                        const totalQty = items.reduce((s, i) => s + i.quantitySold, 0);
                        const totalRev = items.reduce((s, i) => s + i.revenue, 0);
                        return (
                          <>
                            <TableRow className="bg-muted/30 font-semibold">
                              <TableCell></TableCell>
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right">{totalQty.toLocaleString("pt-BR")}</TableCell>
                              <TableCell className="text-right">{formatCurrency(totalRev)}</TableCell>
                            </TableRow>
                            {items.map((item, idx) => (
                              <TableRow key={item.name}>
                                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">{item.quantitySold.toLocaleString("pt-BR")}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                              </TableRow>
                            ))}
                          </>
                        );
                      })()}
                    </TableBody>
                  </Table>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Item Performance Table */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> Desempenho por Item
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(itemPerformanceData || []).length === 0 ? (
                <div className="flex items-center justify-center h-[150px] text-muted-foreground text-sm">
                  Sem dados de itens no período selecionado.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Nome do item</TableHead>
                          <TableHead className="text-right">Itens comprados</TableHead>
                          <TableHead className="text-right">Receita do item</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Totals row */}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell></TableCell>
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">
                            {paginatedItems.totalQuantity.toLocaleString("pt-BR")}
                            <span className="text-muted-foreground text-xs ml-1">100%</span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(paginatedItems.totalRevenue)}
                            <span className="text-muted-foreground text-xs ml-1">100%</span>
                          </TableCell>
                        </TableRow>
                        {paginatedItems.page.map((item, idx) => {
                          const rank = itemPage * ITEMS_PER_PAGE + idx + 1;
                          const qtyPct = paginatedItems.totalQuantity > 0
                            ? ((item.quantitySold / paginatedItems.totalQuantity) * 100).toFixed(2)
                            : "0";
                          const revPct = paginatedItems.totalRevenue > 0
                            ? ((item.revenue / paginatedItems.totalRevenue) * 100).toFixed(2)
                            : "0";
                          return (
                            <TableRow key={item.name}>
                              <TableCell className="text-muted-foreground">{rank}</TableCell>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-right">
                                {item.quantitySold.toLocaleString("pt-BR")}
                                <span className="text-muted-foreground text-xs ml-1">({qtyPct}%)</span>
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.revenue)}
                                <span className="text-muted-foreground text-xs ml-1">({revPct}%)</span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {paginatedItems.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-muted-foreground">
                        Mostrando {itemPage * ITEMS_PER_PAGE + 1}–{Math.min((itemPage + 1) * ITEMS_PER_PAGE, paginatedItems.totalItems)} de {paginatedItems.totalItems} itens
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={itemPage === 0}
                          onClick={() => setItemPage(p => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">
                          {itemPage + 1} / {paginatedItems.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={itemPage >= paginatedItems.totalPages - 1}
                          onClick={() => setItemPage(p => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Funil de Vendas */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" /> Funil de Vendas
                </CardTitle>
                <Select value={funnelProduct} onValueChange={setFunnelProduct}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Produtos</SelectItem>
                    {funnelProductOptions.map(p => (
                      <SelectItem key={p.product_id} value={p.product_id}>
                        {p.product_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {funnelChartData.steps[0].value === 0 ? (
                <p className="text-muted-foreground text-center py-8">Sem dados de funil para o período selecionado.</p>
              ) : (
                <div className="space-y-6">
                  {/* Funnel bars */}
                  <div className="space-y-3">
                    {funnelChartData.steps.map((step, idx) => {
                      const maxVal = funnelChartData.steps[0].value;
                      const widthPct = maxVal > 0 ? Math.max((step.value / maxVal) * 100, 4) : 0;
                      const colors = [
                        "hsl(var(--primary))",
                        "hsl(199, 89%, 48%)",
                        "hsl(25, 95%, 53%)",
                        "hsl(280, 65%, 55%)",
                        "hsl(142, 76%, 36%)",
                      ];
                      return (
                        <div key={step.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              Etapa {idx + 1}: {step.name}
                            </span>
                            <span className="text-muted-foreground">
                              {step.value.toLocaleString("pt-BR")}
                              {idx > 0 && (
                                <span className="ml-2 font-semibold" style={{ color: colors[idx] }}>
                                  {step.rate.toFixed(1)}%
                                </span>
                              )}
                            </span>
                          </div>
                          <div
                            className={`w-full bg-muted rounded-full h-8 overflow-hidden ${idx === 0 || idx === 1 || idx === 2 || idx === 3 || idx === 4 ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
                            onClick={
                              idx === 0
                                ? () => setVisitsModalOpen(true)
                                : idx === 1
                                ? () => setViewsModalOpen(true)
                                : idx === 2
                                ? () => setCartModalOpen(true)
                                : idx === 3
                                ? () => setCheckoutModalOpen(true)
                                : idx === 4
                                ? () => setPurchasesModalOpen(true)
                                : undefined
                            }
                            title={
                              idx === 0
                                ? "Ver detalhes das visitas"
                                : idx === 1
                                ? "Ver detalhes das visualizações"
                                : idx === 2
                                ? "Ver detalhes dos add ao carrinho"
                                : idx === 3
                                ? "Ver tempo médio até finalizar"
                                : idx === 4
                                ? "Ver detalhes das compras efetivadas"
                                : undefined
                            }
                          >
                            <div
                              className="h-full rounded-full flex items-center justify-center text-xs font-bold text-white transition-all duration-500"
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: colors[idx],
                                minWidth: step.value > 0 ? "40px" : "0px",
                              }}
                            >
                              {step.value > 0 && step.value.toLocaleString("pt-BR")}
                            </div>
                          </div>
                          {idx > 0 && step.dropoff > 0 && (
                            <p className="text-xs text-destructive">
                              Taxa de abandono: {step.dropoff.toLocaleString("pt-BR")} ({((step.dropoff / funnelChartData.steps[idx - 1].value) * 100).toFixed(1)}%)
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Conversion summary */}
                  <div className="flex items-center justify-center gap-6 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold" style={{ color: "hsl(142, 76%, 36%)" }}>
                        {funnelChartData.convTotal.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Conversão Total</p>
                      <p className="text-xs text-muted-foreground">(Visita → Compra)</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

      <Dialog open={visitsModalOpen} onOpenChange={setVisitsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes das Visitas ao Cardápio</DialogTitle>
            <DialogDescription>
              Período: {startDate} até {endDate}
            </DialogDescription>
          </DialogHeader>

          {isVisitsBreakdownLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !visitsBreakdown || visitsBreakdown.total === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem visitas no período.</p>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{visitsBreakdown.total.toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Novas</p>
                      <p className="text-2xl font-bold" style={{ color: "hsl(142, 76%, 36%)" }}>
                        {visitsBreakdown.novas.toLocaleString("pt-BR")}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Recorrentes</p>
                      <p className="text-2xl font-bold" style={{ color: "hsl(199, 89%, 48%)" }}>
                        {visitsBreakdown.recorrentes.toLocaleString("pt-BR")}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {([
                  { title: "Por utm_source", rows: visitsBreakdown.bySource },
                  { title: "Por utm_campaign", rows: visitsBreakdown.byCampaign },
                  { title: "Por utm_medium", rows: visitsBreakdown.byMedium },
                  { title: "Por utm_content", rows: visitsBreakdown.byContent },
                ]).map(({ title, rows }) => (
                  <div key={title}>
                    <h4 className="font-semibold mb-2">{title}</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Valor</TableHead>
                          <TableHead className="text-right">Visitas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.key}>
                            <TableCell className="font-medium">{r.key}</TableCell>
                            <TableCell className="text-right">{r.count.toLocaleString("pt-BR")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viewsModalOpen} onOpenChange={setViewsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes das Visualizações de Produto</DialogTitle>
            <DialogDescription>
              Período: {startDate} até {endDate}
            </DialogDescription>
          </DialogHeader>

          {isViewsBreakdownLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !viewsBreakdown || viewsBreakdown.totalViews === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem visualizações no período.</p>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Total de Views</p>
                      <p className="text-2xl font-bold">{viewsBreakdown.totalViews.toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Add ao Carrinho</p>
                      <p className="text-2xl font-bold">{viewsBreakdown.totalAddToCart.toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Produtos únicos</p>
                      <p className="text-2xl font-bold">{viewsBreakdown.uniqueProducts.toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Top 3 categorias mais clicadas</h4>
                  {viewsBreakdown.topCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados de categoria.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Views</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewsBreakdown.topCategories.map((c) => (
                          <TableRow key={c.category}>
                            <TableCell className="font-medium">{categoryNameById.get(c.category) || c.category}</TableCell>
                            <TableCell className="text-right">{c.views.toLocaleString("pt-BR")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Top 5 produtos mais visualizados</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Add Carrinho</TableHead>
                        <TableHead className="text-right">Conversão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewsBreakdown.topProducts.map((p) => (
                        <TableRow key={p.product_id}>
                          <TableCell className="font-medium">{p.product_name}</TableCell>
                          <TableCell className="text-right">{p.views.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">{p.addToCart.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">{p.conversion.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">Produtos "vitrine"</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Entre os mais visualizados, mas com conversão para carrinho abaixo de 40% (mínimo 5 views).
                  </p>
                  {viewsBreakdown.showcase.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum produto vitrine identificado.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Views</TableHead>
                          <TableHead className="text-right">Add Carrinho</TableHead>
                          <TableHead className="text-right">Conversão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewsBreakdown.showcase.map((p) => (
                          <TableRow key={p.product_id}>
                            <TableCell className="font-medium">{p.product_name}</TableCell>
                            <TableCell className="text-right">{p.views.toLocaleString("pt-BR")}</TableCell>
                            <TableCell className="text-right">{p.addToCart.toLocaleString("pt-BR")}</TableCell>
                            <TableCell className="text-right text-destructive font-semibold">{p.conversion.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Todos os produtos</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Add Carrinho</TableHead>
                        <TableHead className="text-right">Conversão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedFullList.map((p) => (
                        <TableRow key={p.product_id}>
                          <TableCell className="font-medium">{p.product_name}</TableCell>
                          <TableCell className="text-right">{p.views.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">{p.addToCart.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">{p.conversion.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cartModalOpen} onOpenChange={setCartModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes dos Add ao Carrinho</DialogTitle>
            <DialogDescription>
              Período: {startDate} até {endDate}
            </DialogDescription>
          </DialogHeader>

          {isCartBreakdownLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !cartBreakdown || cartBreakdown.totalEvents === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem add ao carrinho no período.</p>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Valor Total</p>
                      <p className="text-2xl font-bold" style={{ color: "hsl(142, 76%, 36%)" }}>
                        {formatCurrency(cartBreakdown.totalValue)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Itens Adicionados</p>
                      <p className="text-2xl font-bold">{cartBreakdown.totalQuantity.toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Eventos</p>
                      <p className="text-2xl font-bold">{cartBreakdown.totalEvents.toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Sessões</p>
                      <p className="text-2xl font-bold">{cartBreakdown.totalSessions.toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Por produto</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Sessões</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cartBreakdown.byProduct.map((r) => (
                        <TableRow key={r.product_id}>
                          <TableCell className="font-medium">{r.product_name}</TableCell>
                          <TableCell className="text-right">{r.quantity.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">{r.sessions.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutModalOpen} onOpenChange={setCheckoutModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes do Início de Checkout</DialogTitle>
            <DialogDescription>
              Período: {startDate} até {endDate} · Tempo médio entre abrir o checkout e clicar em "Finalizar Pedido"
              (sessões com mais de 15min são desconsideradas no cálculo)
            </DialogDescription>
          </DialogHeader>

          {isCheckoutBreakdownLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !checkoutBreakdown || checkoutBreakdown.totalCheckoutSessions === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem inícios de checkout no período.</p>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Tempo Médio</p>
                      <p className="text-2xl font-bold" style={{ color: "hsl(280, 65%, 55%)" }}>
                        {Math.floor(checkoutBreakdown.avgDurationSec / 60)}m {checkoutBreakdown.avgDurationSec % 60}s
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Mediana</p>
                      <p className="text-2xl font-bold">
                        {Math.floor(checkoutBreakdown.medianDurationSec / 60)}m {checkoutBreakdown.medianDurationSec % 60}s
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Min / Max</p>
                      <p className="text-lg font-bold">
                        {Math.floor(checkoutBreakdown.minDurationSec / 60)}m {checkoutBreakdown.minDurationSec % 60}s
                        {" · "}
                        {Math.floor(checkoutBreakdown.maxDurationSec / 60)}m {checkoutBreakdown.maxDurationSec % 60}s
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Sessões em Checkout</p>
                      <p className="text-2xl font-bold">{checkoutBreakdown.totalCheckoutSessions.toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Finalizadas (≤15min)</p>
                      <p className="text-2xl font-bold" style={{ color: "hsl(142, 76%, 36%)" }}>
                        {checkoutBreakdown.completedSessions.toLocaleString("pt-BR")}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Carrinhos Abandonados</p>
                      <p className="text-2xl font-bold text-destructive">
                        {checkoutBreakdown.abandonedSessions.toLocaleString("pt-BR")}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {abandonedTicket && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Ticket Médio: Real vs Abandonados</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Real</p>
                          <p className="text-2xl font-bold" style={{ color: "hsl(142, 76%, 36%)" }}>
                            {formatCurrency(abandonedTicket.avgRealTicket)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Abandonado</p>
                          <p className="text-2xl font-bold" style={{ color: "hsl(25, 95%, 53%)" }}>
                            {formatCurrency(abandonedTicket.avgAbandonedTicket)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Carrinhos Aband.</p>
                          <p className="text-2xl font-bold">{abandonedTicket.abandonedCount.toLocaleString("pt-BR")}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Potencial Perdido</p>
                          <p className="text-2xl font-bold text-destructive">
                            {formatCurrency(abandonedTicket.lostRevenue)}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {checkoutBreakdown.excludedOver15min > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {checkoutBreakdown.excludedOver15min.toLocaleString("pt-BR")} sessão(ões) finalizou(aram) acima de
                    15min e foram desconsideradas do cálculo da média.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={purchasesModalOpen} onOpenChange={setPurchasesModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes das Compras Efetivadas</DialogTitle>
            <DialogDescription>
              Período: {startDate} até {endDate}
            </DialogDescription>
          </DialogHeader>

          {isPurchasesBreakdownLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !purchasesBreakdown || purchasesBreakdown.totalOrders === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem compras no período.</p>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Valor Total das Vendas</p>
                      <p className="text-2xl font-bold" style={{ color: "hsl(142, 76%, 36%)" }}>
                        {formatCurrency(purchasesBreakdown.totalRevenue)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Pedidos</p>
                      <p className="text-2xl font-bold">{purchasesBreakdown.totalOrders.toLocaleString("pt-BR")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Ticket Médio</p>
                      <p className="text-2xl font-bold">{formatCurrency(purchasesBreakdown.avgTicket)}</p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Métodos de Pagamento</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={purchasesBreakdown.byPaymentMethod}
                          dataKey="count"
                          nameKey="method"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={(entry: any) => `${entry.method} ${entry.pct.toFixed(1)}%`}
                        >
                          {purchasesBreakdown.byPaymentMethod.map((_, i) => (
                            <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Método</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">Pedidos</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchasesBreakdown.byPaymentMethod.map((r) => (
                          <TableRow key={r.method}>
                            <TableCell className="font-medium capitalize">{r.method}</TableCell>
                            <TableCell className="text-right">{r.pct.toFixed(1)}%</TableCell>
                            <TableCell className="text-right">{r.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Top 3 Horários</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Horário</TableHead>
                          <TableHead className="text-right">Pedidos</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchasesBreakdown.topHours.map((r) => (
                          <TableRow key={r.hour}>
                            <TableCell className="font-medium">{String(r.hour).padStart(2, '0')}:00 - {String(r.hour).padStart(2, '0')}:59</TableCell>
                            <TableCell className="text-right">{r.orders}</TableCell>
                            <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Top 3 Dias da Semana</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dia</TableHead>
                          <TableHead className="text-right">Pedidos</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchasesBreakdown.topDays.map((r) => (
                          <TableRow key={r.dayOfWeek}>
                            <TableCell className="font-medium">{r.label}</TableCell>
                            <TableCell className="text-right">{r.orders}</TableCell>
                            <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGA4;
