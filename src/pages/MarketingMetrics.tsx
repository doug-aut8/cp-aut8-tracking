import { MarketingReportTable } from "@/components/admin/MarketingReportTable";
import { LocationSalesReport } from "@/components/admin/LocationSalesReport";
import { MarketingAttributionReports } from "@/components/admin/MarketingAttributionReports";
import { MarketingGA4Reports } from "@/components/admin/MarketingGA4Reports";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DeviceMetrics from "@/components/admin/DeviceMetrics";
import { startOfDay, endOfDay } from "date-fns";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, TrendingUp, TrendingDown, X, ArrowLeft, Info, Sun, Moon } from "lucide-react";
import {
  subDays,
  addDays,
  format,
  differenceInCalendarDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { DateRange } from "react-day-picker";
import {
  getVisitMetrics,
  getUtmSources,
  getUtmSourcesInRange,
  getUtmCampaignsInRange,
  getUtmCampaigns,
  getDailyVisitMetrics,
  getFunnelOverview,
  getAbandonedCartLostValue,
  getAbandonedCheckoutLostValue,
  getBounceRate,
  getProductRankingMetrics,
  getVisitCityOptions,
  type BounceRate,
  type ProductMetricKey,
  type ProductRankingMetrics,
  type VisitMetrics,
  type DailyMetricKey,
  type FunnelOverview,
} from "@/services/productEventService";
import {
  fetchSalesSummary,
  fetchAvgConversionTimeSeconds,
  fetchDailySalesMetrics,
  fetchUniqueSessions,
  fetchOrderCountDetail,
  fetchSalesReport,
  fetchBuyerProfile,
  type BuyerProfile,
  fetchCouponUsageReport,
  type CouponUsageRow,
  fetchProductsReport,
  fetchLocationOptions,
  type LocationField,
  type LocationFilter,
  type SalesSummary,
  type DailySalesMetricKey,
  type OrderCountDetail,
  type SalesReportRow,
  type ProductReportRow,
} from "@/services/salesAnalyticsService";
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
  subtitle?: string;
  change?: string | null;
  isPositive?: boolean;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  showInfoIcon?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  change,
  isPositive = true,
  className,
  selected,
  onClick,
  showInfoIcon,
}) => (
  <Card
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    aria-pressed={onClick ? selected : undefined}
    onKeyDown={onClick ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    className={cn(
      "relative border-0 bg-card text-card-foreground transition-all",
      onClick && "cursor-pointer hover:ring-2 hover:ring-primary/50",
      selected && "ring-2 ring-primary",
      className
    )}
  >
    {showInfoIcon && (
      <Info
        className="absolute bottom-1.5 right-1.5 h-3 w-3 pointer-events-none text-muted-foreground/60"
        aria-label="Detalhes disponíveis"
      />
    )}
    <CardContent className="p-5 flex flex-col justify-between">
      <div className="h-[2.5rem]">
        <p className="text-[11px] font-medium leading-tight text-muted-foreground line-clamp-2">{label}</p>
      </div>
      <div>
        <span className="block text-lg font-bold break-words">{value}</span>
        {subtitle ? (
          <span className="mt-1 block truncate text-xs font-medium text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
        <div className="flex items-center justify-between gap-3 mt-2">
          {change ? (
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
          ) : (
            <span />
          )}
        </div>
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

const salesMetricLabels: Record<DailySalesMetricKey, string> = {
  totalRevenue: "Valor Vendas",
  orderCount: "Qtde de Vendas",
  avgTicketProducts: "Ticket Médio Vendas",
  totalFreight: "Valor Total Fretes",
  avgTicketFreight: "Ticket Médio Fretes",
  totalDiscount: "Descontos/Cupons",
  convTimeSeconds: "Tempo até converter",
  itemsPerOrder: "Itens por pedido",
};

const productMetricLabels: Record<ProductMetricKey, string> = {
  productViews: "Produtos Mais Visualizados",
  productSales: "Produtos Mais Vendidos",
};

// ===== Funil (dados reais de product_events) =====
type FunnelMetricKey =
  | "abandonoCarrinho"
  | "desistenciaCheckout"
  | "tempoCheckout"
  | "pedidosIniciados"
  | "pedidosFinalizados"
  | "taxaConversao";

const funnelMetricLabels: Record<FunnelMetricKey, string> = {
  abandonoCarrinho: "Taxa de Abandono de Carrinho",
  desistenciaCheckout: "Taxa de Desistência no Checkout",
  tempoCheckout: "Tempo Médio no Checkout",
  pedidosIniciados: "Pedidos Iniciados",
  pedidosFinalizados: "Pedidos Finalizados",
  taxaConversao: "Taxa de Conversão",
};

const formatNumber = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")}k` : String(n);

const computeChange = (current: number, previous: number) => {
  if (previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return { label: `${Math.abs(pct).toFixed(0)}%`, isPositive: pct >= 0 };
};

// Cards de vendas: todos conectados a dados reais (pedidos_sabor_delivery
// e checkout_events/product_events para o tempo até a conversão).
interface SalesCardDef {
  label: string;
  value: string;
  change?: string | null;
  isPositive?: boolean;
  metricKey?: DailySalesMetricKey;
}



const formatBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return "—";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m${String(s).padStart(2, "0")}s`;
};

const buildRealSalesCards = (
  current: SalesSummary | null,
  previous: SalesSummary | null,
  convTime: number | null,
  prevConvTime: number | null,
  uniqueSessions: number | null,
  prevUniqueSessions: number | null,
): SalesCardDef[] => {
  const conversionRate =
    uniqueSessions !== null && uniqueSessions > 0 && current
      ? (current.orderCount / uniqueSessions) * 100
      : null;
  const prevConversionRate =
    prevUniqueSessions !== null && prevUniqueSessions > 0 && previous
      ? (previous.orderCount / prevUniqueSessions) * 100
      : null;
  const convRateChange =
    conversionRate !== null && prevConversionRate !== null
      ? computeChange(conversionRate, prevConversionRate)
      : null;
  const fmtChange = (cur: number, prev: number) => computeChange(cur, prev);
  const convChange =
    convTime !== null && prevConvTime !== null && prevConvTime > 0
      ? computeChange(convTime, prevConvTime)
      : null;
  return [
    {
      metricKey: "totalRevenue" as const,
      label: "Valor das Vendas",
      value: current ? formatBRL(current.totalRevenue) : "…",
      change: current && previous ? fmtChange(current.totalRevenue, previous.totalRevenue)?.label ?? null : null,
      isPositive: current && previous ? fmtChange(current.totalRevenue, previous.totalRevenue)?.isPositive ?? true : true,
    },
    {
      metricKey: "orderCount" as const,
      label: "Quantidade de Vendas",
      value: current ? String(current.orderCount) : "…",
      change: current && previous ? fmtChange(current.orderCount, previous.orderCount)?.label ?? null : null,
      isPositive: current && previous ? fmtChange(current.orderCount, previous.orderCount)?.isPositive ?? true : true,
    },
    {
      metricKey: "avgTicketProducts" as const,
      label: "Ticket Médio Produtos",
      value: current ? formatBRL(current.avgTicketProducts) : "…",
      change: current && previous ? fmtChange(current.avgTicketProducts, previous.avgTicketProducts)?.label ?? null : null,
      isPositive: current && previous ? fmtChange(current.avgTicketProducts, previous.avgTicketProducts)?.isPositive ?? true : true,
    },
    {
      label: "Taxa de Conversão",
      value: conversionRate !== null ? `${conversionRate.toFixed(1).replace(".", ",")}%` : "…",
      change: convRateChange?.label ?? null,
      isPositive: convRateChange?.isPositive ?? true,
    },
    {
      metricKey: "totalFreight" as const,
      label: "Valor Total Fretes",
      value: current ? formatBRL(current.totalFreight) : "…",
      change: current && previous ? fmtChange(current.totalFreight, previous.totalFreight)?.label ?? null : null,
      isPositive: current && previous ? fmtChange(current.totalFreight, previous.totalFreight)?.isPositive ?? true : true,
    },
    {
      metricKey: "avgTicketFreight" as const,
      label: "Ticket Médio Fretes",
      value: current ? formatBRL(current.avgTicketFreight) : "…",
      change: current && previous ? fmtChange(current.avgTicketFreight, previous.avgTicketFreight)?.label ?? null : null,
      isPositive: current && previous ? fmtChange(current.avgTicketFreight, previous.avgTicketFreight)?.isPositive ?? true : true,
    },
    {
      metricKey: "totalDiscount" as const,
      label: "Descontos/Cupons",
      value: current ? formatBRL(current.totalDiscount) : "…",
      change: current && previous ? fmtChange(current.totalDiscount, previous.totalDiscount)?.label ?? null : null,
      isPositive: current && previous ? fmtChange(current.totalDiscount, previous.totalDiscount)?.isPositive ?? true : true,
    },
    {
      metricKey: "convTimeSeconds" as const,
      label: "Tempo até a conversão",
      value: formatDuration(convTime),
      change: convChange?.label ?? null,
      // Tempo menor é melhor: queda no tempo conta como positiva
      isPositive: convChange ? !convChange.isPositive : true,
    },
    {
      metricKey: "itemsPerOrder" as const,
      label: "Itens por pedido",
      value: current ? current.itemsPerOrder.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "…",
      change: current && previous ? fmtChange(current.itemsPerOrder, previous.itemsPerOrder)?.label ?? null : null,
      isPositive: current && previous ? fmtChange(current.itemsPerOrder, previous.itemsPerOrder)?.isPositive ?? true : true,
    },
  ];
};


const MarketingMetrics: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(today, 29),
    to: today,
  });
  const [activePreset, setActivePreset] = useState<string>("Últimos 30 dias");

  const datePresets = useMemo(
    () => [
      { label: "Hoje", range: { from: today, to: today } },
      {
        label: "Ontem",
        range: {
          from: subDays(today, 1),
          to: subDays(today, 1),
        },
      },
      {
        label: "Esta Semana",
        range: {
          from: startOfWeek(today, { weekStartsOn: 1 }),
          to: endOfWeek(today, { weekStartsOn: 1 }),
        },
      },
      {
        label: "Este Mês",
        range: {
          from: startOfMonth(today),
          to: endOfMonth(today),
        },
      },
      {
        label: "Últimos 7 dias",
        range: {
          from: subDays(today, 6),
          to: today,
        },
      },
      {
        label: "Últimos 30 dias",
        range: {
          from: subDays(today, 29),
          to: today,
        },
      },
      {
        label: "Últimos 60 dias",
        range: {
          from: subDays(today, 59),
          to: today,
        },
      },
      {
        label: "Últimos 90 dias",
        range: {
          from: subDays(today, 89),
          to: today,
        },
      },
    ],
    [today]
  );

  const applyPreset = (label: string, range: DateRange | undefined) => {
    setActivePreset(label);
    setDateRange(range);
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setActivePreset("Personalizado");
  };

  const [activeTab, setActiveTab] = useState("overview");
  const [performanceView, setPerformanceView] = useState("produtos");
  const metricType = activeTab === "overview" ? "geral" : activeTab === "performance" ? performanceView : activeTab === "acquisition" ? "visitas" : "horarios";
  const [visits, setVisits] = useState<VisitMetrics | null>(null);
  const [prevVisits, setPrevVisits] = useState<VisitMetrics | null>(null);
  const [utmSources, setUtmSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState("todas");
  const [utmCampaigns, setUtmCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("campanhas");
  const [locationMode, setLocationMode] = useState<"todas" | LocationField>("todas");
  const [locationValue, setLocationValue] = useState<string>("");
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [locationOptionsLoading, setLocationOptionsLoading] = useState(false);

  // Bairro só faz sentido onde os dados vêm dos pedidos (vendas e produtos)
  const allowBairroFilter =
    metricType === "vendas" || metricType === "produtos" || metricType === "geral";

  // Filtros em estado não-default ganham moldura amarela
  const filterTriggerClass = (active: boolean) =>
    cn(
      "bg-background border-border text-foreground flex-1 min-w-0",
      active && "border-primary ring-1 ring-primary/50"
    );

  const sourceFilterActive = selectedSource !== "todas";
  const campaignFilterActive = selectedCampaign !== "campanhas";
  const locationModeActive = metricType !== "ga4" && locationMode !== "todas";
  const locationValueActive = locationMode !== "todas" && !!locationValue;
  const hasActiveFilters =
    sourceFilterActive ||
    campaignFilterActive ||
    locationModeActive ||
    locationValueActive;

  const clearFilters = () => {
    setSelectedSource("todas");
    setSelectedCampaign("campanhas");
    setLocationMode("todas");
    setLocationValue("");
  };


  const cityFilter = locationMode === "cidade" && locationValue ? locationValue : null;

  const locationFilter: LocationFilter | null =
    locationMode !== "todas" && locationValue
      ? { field: locationMode, value: locationValue }
      : null;

  // Ao trocar de aba, volta para "Todas as Localizações" se o modo não se aplica
  useEffect(() => {
    if (!allowBairroFilter && locationMode === "bairro") {
      setLocationMode("todas");
      setLocationValue("");
    }
  }, [allowBairroFilter, locationMode]);

  // Carrega as opções de cidade/bairro conforme o modo escolhido
  useEffect(() => {
    if (locationMode === "todas") {
      setLocationOptions([]);
      return;
    }
    let cancelled = false;
    setLocationOptionsLoading(true);
    const locStart = dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined;
    const locEnd = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined;
    (locationMode === "cidade"
      ? Promise.all([
          fetchLocationOptions("cidade", locStart, locEnd),
          getVisitCityOptions(locStart, locEnd),
        ]).then(
          ([fromOrders, fromVisits]) =>
            Array.from(new Set([...fromOrders, ...fromVisits])).sort((a, b) =>
              a.localeCompare(b, "pt-BR")
            )
        )
      : fetchLocationOptions(locationMode, locStart, locEnd)
    )
      .then((options) => {
        if (cancelled) return;
        setLocationOptions(options);
        setLocationValue((cur) => (cur && !options.includes(cur) ? "" : cur));
      })
      .catch(() => {
        if (!cancelled) setLocationOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLocationOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationMode, dateRange?.from, dateRange?.to]);
  const [selectedMetric, setSelectedMetric] = useState<DailyMetricKey>("totalVisits");
  const [selectedSalesMetric, setSelectedSalesMetric] = useState<DailySalesMetricKey>("totalRevenue");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [salesChartData, setSalesChartData] = useState<ChartPoint[]>([]);
  const [salesChartLoading, setSalesChartLoading] = useState(false);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [prevSalesSummary, setPrevSalesSummary] = useState<SalesSummary | null>(null);
  const [convTime, setConvTime] = useState<number | null>(null);
  const [prevConvTime, setPrevConvTime] = useState<number | null>(null);
  const [uniqueSessions, setUniqueSessions] = useState<number | null>(null);
  const [prevUniqueSessions, setPrevUniqueSessions] = useState<number | null>(null);
  const salesDetailsOpen = metricType === "geral";
  const [topSalesDays, setTopSalesDays] = useState<ChartPoint[]>([]);
  const [buyerProfile, setBuyerProfile] = useState<BuyerProfile | null>(null);
  const orderCountDetailsOpen = metricType === "geral";
  const [orderCountDetail, setOrderCountDetail] = useState<OrderCountDetail | null>(null);
  const [orderCountLoading, setOrderCountLoading] = useState(false);
  const salesReportOpen = metricType === "geral";
  const [salesReportRows, setSalesReportRows] = useState<SalesReportRow[]>([]);
  const [salesReportLoading, setSalesReportLoading] = useState(false);
  const [reportMonthIndex, setReportMonthIndex] = useState(0);
  const productsReportOpen = metricType === "produtos";
  const [productsReportRows, setProductsReportRows] = useState<ProductReportRow[]>([]);
  const [productsReportLoading, setProductsReportLoading] = useState(false);
  const [productsMonthIndex, setProductsMonthIndex] = useState(0);
  const [selectedFunnelMetric, setSelectedFunnelMetric] = useState<FunnelMetricKey>("abandonoCarrinho");
  const funnelDetail = selectedFunnelMetric;
  const [funnel, setFunnel] = useState<FunnelOverview | null>(null);
  const [prevFunnel, setPrevFunnel] = useState<FunnelOverview | null>(null);
  const [bounce, setBounce] = useState<BounceRate | null>(null);
  const [prevBounce, setPrevBounce] = useState<BounceRate | null>(null);

  const [productRanking, setProductRanking] = useState<ProductRankingMetrics | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductMetric, setSelectedProductMetric] = useState<ProductMetricKey>("productViews");
  const productDetail = selectedProductMetric;

  // Métricas de produtos (visualizações e vendas) para a aba "Produtos"
  useEffect(() => {
    if (metricType !== "produtos" || !dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;

    let cancelled = false;
    setProductsLoading(true);
    setProductRanking(null);
    getProductRankingMetrics(start, end, sourceFilter, campaignFilter)
      .then((data) => {
        if (!cancelled) setProductRanking(data);
      })
      .catch(() => {
        if (!cancelled) setProductRanking(null);
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [metricType, dateRange, selectedSource, selectedCampaign]);

  // Série diária da métrica de produtos selecionada (dias sem dados = 0)
  const productChartData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const series =
      selectedProductMetric === "productSales"
        ? productRanking?.dailySales ?? []
        : productRanking?.dailyViews ?? [];
    const byDate = new Map(series.map((d) => [d.date, d.value]));
    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    return Array.from({ length: days }, (_, i) => {
      const day = addDays(dateRange.from, i);
      return {
        date: format(day, "d MMM"),
        value: byDate.get(format(day, "yyyy-MM-dd")) ?? 0,
      };
    });
  }, [productRanking, selectedProductMetric, dateRange]);

  const productChartMax = useMemo(() => {
    if (!productChartData.length) return 10;
    const max = Math.max(...productChartData.map((d) => d.value));
    return max > 0 ? Math.ceil(max * 1.1) : 10;
  }, [productChartData]);

  // Popula o filtro de Origens apenas com as utm_source existentes no período selecionado
  // (união de product_events e pedidos_sabor_delivery). Campanhas continuam globais.
  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      getUtmSources().then(setUtmSources);
      getUtmCampaigns().then(setUtmCampaigns);
      return;
    }
    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    let cancelled = false;
    getUtmSourcesInRange(start, end).then((sources) => {
      if (cancelled) return;
      setUtmSources(sources);
      setSelectedSource((current) =>
        current !== "todas" && !sources.includes(current) ? "todas" : current
      );
    });
    getUtmCampaignsInRange(start, end).then((campaigns) => {
      if (cancelled) return;
      setUtmCampaigns(campaigns);
      setSelectedCampaign((current) =>
        current !== "campanhas" && !campaigns.includes(current) ? "campanhas" : current
      );
    });
    return () => {
      cancelled = true;
    };
  }, [dateRange?.from, dateRange?.to]);

  const [mmLight, setMmLight] = useState<boolean>(() => localStorage.getItem("mm_theme") === "light");
  useEffect(() => {
    document.body.classList.add("marketing-metrics-theme");
    return () => document.body.classList.remove("marketing-metrics-theme", "mm-light");
  }, []);
  useEffect(() => {
    document.body.classList.toggle("mm-light", mmLight);
    localStorage.setItem("mm_theme", mmLight ? "light" : "dark");
  }, [mmLight]);

  // Carrega métricas de visitas do product_events para o período selecionado
  // e para o período anterior equivalente (para o % de variação).
  useEffect(() => {
    if ((metricType !== "visitas" && metricType !== "geral") || !dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    const prevEnd = format(subDays(dateRange.from, 1), "yyyy-MM-dd");
    const prevStart = format(subDays(dateRange.from, days), "yyyy-MM-dd");

    let cancelled = false;
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;
    Promise.all([
      getVisitMetrics(start, end, sourceFilter, campaignFilter, cityFilter),
      getVisitMetrics(prevStart, prevEnd, sourceFilter, campaignFilter, cityFilter),
      getBounceRate(start, end, sourceFilter, campaignFilter, cityFilter),
      getBounceRate(prevStart, prevEnd, sourceFilter, campaignFilter, cityFilter),
    ]).then(([current, previous, currentBounce, previousBounce]) => {
      if (cancelled) return;
      setVisits(current);
      setPrevVisits(previous);
      setBounce(currentBounce);
      setPrevBounce(previousBounce);
    });
    return () => {
      cancelled = true;
    };
  }, [metricType, dateRange, selectedSource, selectedCampaign, cityFilter]);

  const visitChange = (key: keyof VisitMetrics) =>
    visits && prevVisits ? computeChange(visits[key], prevVisits[key]) : null;

  // Carrega o resumo de vendas do período selecionado e do período anterior
  // equivalente (para o % de variação), respeitando os filtros de UTM.
  useEffect(() => {
    if ((metricType !== "vendas" && metricType !== "geral") || !dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    const prevEnd = subDays(dateRange.from, 1);
    const prevStart = subDays(prevEnd, days - 1);
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;

    let cancelled = false;
    setSalesSummary(null);
    setPrevSalesSummary(null);
    setConvTime(null);
    setPrevConvTime(null);
    setUniqueSessions(null);
    setPrevUniqueSessions(null);

    Promise.all([
      fetchSalesSummary(start, end, sourceFilter, campaignFilter, locationFilter),
      fetchSalesSummary(
        format(prevStart, "yyyy-MM-dd"),
        format(prevEnd, "yyyy-MM-dd"),
        sourceFilter,
        campaignFilter,
        locationFilter,
      ),
      fetchAvgConversionTimeSeconds(start, end, sourceFilter, campaignFilter).catch(() => null),
      fetchAvgConversionTimeSeconds(
        format(prevStart, "yyyy-MM-dd"),
        format(prevEnd, "yyyy-MM-dd"),
        sourceFilter,
        campaignFilter,
      ).catch(() => null),
      fetchUniqueSessions(start, end, sourceFilter, campaignFilter).catch(() => null),
      fetchUniqueSessions(
        format(prevStart, "yyyy-MM-dd"),
        format(prevEnd, "yyyy-MM-dd"),
        sourceFilter,
        campaignFilter,
      ).catch(() => null),
    ])
      .then(([current, previous, conv, prevConv, sessions, prevSessions]) => {
        if (cancelled) return;
        setSalesSummary(current);
        setPrevSalesSummary(previous);
        setConvTime(conv);
        setPrevConvTime(prevConv);
        setUniqueSessions(sessions);
        setPrevUniqueSessions(prevSessions);
      })
      .catch(() => {
        if (cancelled) return;
        setSalesSummary(null);
        setPrevSalesSummary(null);
      });

    return () => {
      cancelled = true;
    };
  }, [metricType, dateRange, selectedSource, selectedCampaign, locationMode, locationValue]);

  // Top 3 dias com mais vendas para o detalhamento na página
  useEffect(() => {
    if (!salesDetailsOpen || !dateRange?.from || !dateRange?.to) {
      setTopSalesDays([]);
      return;
    }
    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;
    let cancelled = false;
    fetchDailySalesMetrics(start, end, "totalRevenue", sourceFilter, campaignFilter, locationFilter)
      .then((rows) => {
        if (cancelled) return;
        setTopSalesDays(
          [...rows]
            .sort((a, b) => b.value - a.value)
            .slice(0, 3)
            .filter((d) => d.value > 0)
            .map((d) => ({ date: format(new Date(`${d.date}T00:00:00`), "dd/MM/yyyy"), value: d.value }))
        );
      })
      .catch(() => {
        if (!cancelled) setTopSalesDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [salesDetailsOpen, metricType, dateRange, selectedSource, selectedCampaign, locationMode, locationValue]);

  useEffect(() => {
    if (!salesDetailsOpen || !dateRange?.from || !dateRange?.to) return;
    setBuyerProfile(null);
    let cancelled = false;
    fetchBuyerProfile(
      format(dateRange.from, "yyyy-MM-dd"),
      format(dateRange.to, "yyyy-MM-dd"),
      selectedSource === "todas" ? null : selectedSource,
      selectedCampaign === "campanhas" ? null : selectedCampaign,
      locationFilter,
    )
      .then((r) => { if (!cancelled) setBuyerProfile(r); })
      .catch(() => { if (!cancelled) setBuyerProfile(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesDetailsOpen, dateRange, selectedSource, selectedCampaign, locationMode, locationValue]);

  // Detalhamento da "Quantidade de Vendas"
  useEffect(() => {
    if (!orderCountDetailsOpen || !dateRange?.from || !dateRange?.to) {
      return;
    }
    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;
    let cancelled = false;
    setOrderCountLoading(true);
    fetchOrderCountDetail(start, end, sourceFilter, campaignFilter, locationFilter)
      .then((detail) => {
        if (cancelled) return;
        setOrderCountDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setOrderCountDetail(null);
      })
      .finally(() => {
        if (!cancelled) setOrderCountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderCountDetailsOpen, dateRange, selectedSource, selectedCampaign, locationMode, locationValue]);

  // Relatório completo de vendas
  useEffect(() => {
    if (!salesReportOpen || !dateRange?.from || !dateRange?.to) return;
    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;
    let cancelled = false;
    setSalesReportLoading(true);
    setReportMonthIndex(0);
    fetchSalesReport(start, end, sourceFilter, campaignFilter, locationFilter)
      .then((rows) => {
        if (!cancelled) setSalesReportRows(rows);
      })
      .catch(() => {
        if (!cancelled) setSalesReportRows([]);
      })
      .finally(() => {
        if (!cancelled) setSalesReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salesReportOpen, dateRange, selectedSource, selectedCampaign, locationMode, locationValue]);

  // Relatório de cupons
  const couponsOpen = metricType === "geral";
  const [couponRows, setCouponRows] = useState<CouponUsageRow[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  useEffect(() => {
    if (!couponsOpen || !dateRange?.from || !dateRange?.to) return;
    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;
    let cancelled = false;
    setCouponsLoading(true);
    fetchCouponUsageReport(start, end, sourceFilter, campaignFilter, locationFilter)
      .then((rows) => !cancelled && setCouponRows(rows))
      .catch(() => !cancelled && setCouponRows([]))
      .finally(() => !cancelled && setCouponsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [couponsOpen, dateRange, selectedSource, selectedCampaign, locationMode, locationValue]);

  // Agrupa as vendas do relatório por mês
  const salesReportMonths = useMemo(() => {
    const groups = new Map<string, SalesReportRow[]>();
    salesReportRows.forEach((row) => {
      const d = new Date(row.dateIso);
      if (isNaN(d.getTime())) return;
      const key = format(startOfMonth(d), "yyyy-MM");
      const arr = groups.get(key);
      if (arr) arr.push(row);
      else groups.set(key, [row]);
    });
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, rows]) => ({
        key,
        label: format(new Date(`${key}-01T00:00:00`), "MMMM yyyy"),
        rows,
        total: rows.reduce((acc, r) => acc + (r.status === "cancelled" ? 0 : r.total), 0),
      }));
  }, [salesReportRows]);

  const currentReportMonth =
    salesReportMonths[Math.min(reportMonthIndex, Math.max(salesReportMonths.length - 1, 0))] ?? null;

  // Relatório completo de produtos vendidos
  useEffect(() => {
    if (!productsReportOpen || !dateRange?.from || !dateRange?.to) return;
    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;
    let cancelled = false;
    setProductsReportLoading(true);
    setProductsMonthIndex(0);
    fetchProductsReport(start, end, sourceFilter, campaignFilter, locationFilter)
      .then((rows) => {
        if (!cancelled) setProductsReportRows(rows);
      })
      .catch(() => {
        if (!cancelled) setProductsReportRows([]);
      })
      .finally(() => {
        if (!cancelled) setProductsReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productsReportOpen, dateRange, selectedSource, selectedCampaign, locationMode, locationValue]);

  const productsReportMonths = useMemo(() => {
    const monthGroups = new Map<string, ProductReportRow[]>();
    productsReportRows.forEach((row) => {
      const arr = monthGroups.get(row.monthKey);
      if (arr) arr.push(row);
      else monthGroups.set(row.monthKey, [row]);
    });
    return Array.from(monthGroups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, rows]) => {
        const categoryGroups = new Map<string, ProductReportRow[]>();
        rows.forEach((row) => {
          const cat = row.category || "Sem categoria";
          const arr = categoryGroups.get(cat);
          if (arr) arr.push(row);
          else categoryGroups.set(cat, [row]);
        });
        const categories = Array.from(categoryGroups.entries())
          .map(([category, catRows]) => ({
            category,
            rows: [...catRows].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue),
            totalQuantity: catRows.reduce((acc, r) => acc + r.quantity, 0),
            total: catRows.reduce((acc, r) => acc + r.revenue, 0),
          }))
          .sort((a, b) => b.totalQuantity - a.totalQuantity || b.total - a.total);
        return {
          key,
          label: format(new Date(`${key}-01T00:00:00`), "MMMM yyyy"),
          categories,
          totalQuantity: rows.reduce((acc, r) => acc + r.quantity, 0),
          total: rows.reduce((acc, r) => acc + r.revenue, 0),
        };
      });
  }, [productsReportRows]);

  const currentProductsMonth =
    productsReportMonths[Math.min(productsMonthIndex, Math.max(productsReportMonths.length - 1, 0))] ??
    null;


  const salesCards = useMemo(
    () => [
      ...buildRealSalesCards(
        salesSummary,
        prevSalesSummary,
        convTime,
        prevConvTime,
        uniqueSessions,
        prevUniqueSessions
      ).filter(card => card.label !== "Taxa de Conversão"),
      (() => {
        const rpv = salesSummary && visits && visits.uniqueVisitors > 0 ? salesSummary.totalRevenue / visits.uniqueVisitors : null;
        const prevRpv = prevSalesSummary && prevVisits && prevVisits.uniqueVisitors > 0 ? prevSalesSummary.totalRevenue / prevVisits.uniqueVisitors : null;
        const ch = rpv !== null && prevRpv !== null ? computeChange(rpv, prevRpv) : null;
        return { label: "Receita por Visitante (RPV)", value: rpv !== null ? formatBRL(rpv) : salesSummary && visits ? "—" : "…", change: ch?.label ?? null, isPositive: ch?.isPositive ?? true } as SalesCardDef;
      })(),
      (() => {
        const couponOrders = couponRows.reduce((a, r) => a + r.uses, 0);
        const rate = salesSummary && salesSummary.orderCount > 0 && !couponsLoading ? (couponOrders / salesSummary.orderCount) * 100 : null;
        return { label: "Taxa de Utilização de Cupons", value: rate !== null ? `${rate.toFixed(1).replace(".", ",")}%` : salesSummary?.orderCount === 0 ? "—" : "…", change: null } as SalesCardDef;
      })(),
      ...(selectedCampaign !== "campanhas" ? [(() => {
        const ch = uniqueSessions !== null && prevUniqueSessions !== null ? computeChange(uniqueSessions, prevUniqueSessions) : null;
        return { label: "Sessões da Campanha", value: uniqueSessions !== null ? formatNumber(uniqueSessions) : "…", change: ch?.label ?? null, isPositive: ch?.isPositive ?? true } as SalesCardDef;
      })()] : []),
    ],
    [
      visits,
      prevVisits,
      couponRows,
      couponsLoading,
      selectedCampaign,
      salesSummary,
      prevSalesSummary,
      convTime,
      prevConvTime,
      uniqueSessions,
      prevUniqueSessions,
    ]
  );

  // Carrega série diária da métrica selecionada para o gráfico
  useEffect(() => {
    if ((metricType !== "visitas" && metricType !== "geral") || !dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;

    let cancelled = false;
    setChartLoading(true);
    getDailyVisitMetrics(start, end, selectedMetric, sourceFilter, campaignFilter, cityFilter)
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
  }, [metricType, dateRange, selectedMetric, selectedSource, selectedCampaign, cityFilter]);

  // Carrega série diária real da métrica de vendas selecionada
  useEffect(() => {
    if ((metricType !== "vendas" && metricType !== "geral") || !dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;

    let cancelled = false;
    setSalesChartLoading(true);
    fetchDailySalesMetrics(start, end, selectedSalesMetric, sourceFilter, campaignFilter, locationFilter)
      .then((data) => {
        if (cancelled) return;
        setSalesChartData(
          data.map((d) => ({
            date: format(new Date(`${d.date}T00:00:00`), "d MMM"),
            value: Number(d.value.toFixed(2)),
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setSalesChartData([]);
      })
      .finally(() => {
        if (!cancelled) setSalesChartLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [metricType, dateRange, selectedSalesMetric, selectedSource, selectedCampaign, locationMode, locationValue]);

  const salesChartMax = useMemo(() => {
    if (!salesChartData.length) return 10;
    const max = Math.max(...salesChartData.map((d) => d.value));
    return max > 0 ? Math.ceil(max * 1.1) : 10;
  }, [salesChartData]);

  const isSalesMoneyMetric = ["totalRevenue", "avgTicketProducts", "totalFreight", "avgTicketFreight", "totalDiscount"].includes(selectedSalesMetric);
  const salesChartTickFormatter = (value: number) => {
    if (isSalesMoneyMetric) {
      return value >= 1000 ? `R$ ${(value / 1000).toFixed(1).replace(".", ",")}k` : `R$ ${value}`;
    }
    if (selectedSalesMetric === "convTimeSeconds") return formatDuration(value);
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")}k`;
    return String(value);
  };
  const salesMetricLabel = salesMetricLabels[selectedSalesMetric];

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

  // Carrega os dados reais do funil (período atual e anterior equivalente)
  useEffect(() => {
    if (metricType !== "funil" || !dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    const prevEnd = format(subDays(dateRange.from, 1), "yyyy-MM-dd");
    const prevStart = format(subDays(dateRange.from, days), "yyyy-MM-dd");

    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;

    let cancelled = false;
    setFunnel(null);
    Promise.all([
      getFunnelOverview(start, end, sourceFilter, campaignFilter, cityFilter),
      getFunnelOverview(prevStart, prevEnd, sourceFilter, campaignFilter, cityFilter),
    ]).then(([current, previous]) => {
      if (cancelled) return;
      setFunnel(current);
      setPrevFunnel(previous);
    });
    return () => {
      cancelled = true;
    };
  }, [metricType, dateRange, selectedSource, selectedCampaign, cityFilter]);

  // Valor potencial perdido nos carrinhos abandonados (detalhe de abandono)
  const [abandonedLostValue, setAbandonedLostValue] = useState<number | null>(null);
  useEffect(() => {
    if (funnelDetail !== "abandonoCarrinho" || !dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;

    let cancelled = false;
    setAbandonedLostValue(null);
    getAbandonedCartLostValue(start, end, sourceFilter, campaignFilter).then((value) => {
      if (!cancelled) setAbandonedLostValue(value);
    });
    return () => {
      cancelled = true;
    };
  }, [funnelDetail, dateRange, selectedSource, selectedCampaign]);

  // Valor potencial perdido nas desistências no checkout (detalhe de desistência)
  const [checkoutLostValue, setCheckoutLostValue] = useState<number | null>(null);
  useEffect(() => {
    if (funnelDetail !== "desistenciaCheckout" || !dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;

    let cancelled = false;
    setCheckoutLostValue(null);
    getAbandonedCheckoutLostValue(start, end, sourceFilter, campaignFilter).then((value) => {
      if (!cancelled) setCheckoutLostValue(value);
    });
    return () => {
      cancelled = true;
    };
  }, [funnelDetail, dateRange, selectedSource, selectedCampaign]);

  const funnelStages = useMemo(() => {
    const s = funnel?.stages;
    return [
      { label: "Visitas", value: s?.visits ?? 0 },
      { label: "Itens Visualizados", value: s?.itemViews ?? 0 },
      { label: "Adicionados ao Carrinho", value: s?.addToCart ?? 0 },
      { label: "Início de Checkout", value: s?.beginCheckout ?? 0 },
      { label: "Fim de Checkout", value: s?.endCheckout ?? 0 },
      { label: "Compras", value: s?.purchases ?? 0 },
    ];
  }, [funnel]);

  const funnelCardValue = (key: FunnelMetricKey) => {
    if (!funnel) return "…";
    if (key === "tempoCheckout") return formatDuration(funnel.tempoCheckout);
    if (key === "pedidosIniciados" || key === "pedidosFinalizados") {
      return funnel[key].toLocaleString("pt-BR");
    }
    return `${funnel[key].toFixed(1).replace(".", ",")}%`;
  };

  const funnelChange = (key: FunnelMetricKey) =>
    funnel && prevFunnel ? computeChange(funnel[key], prevFunnel[key]) : null;

  // Série diária real do funil para a métrica selecionada
  const funnelChartData = useMemo(() => {
    if (!funnel || !dateRange?.from || !dateRange?.to) return [];
    const byDate = new Map(funnel.daily.map((d) => [d.date, d]));
    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    return Array.from({ length: days }, (_, i) => {
      const day = addDays(dateRange.from, i);
      const key = format(day, "yyyy-MM-dd");
      const row = byDate.get(key);
      return {
        date: format(day, "d MMM"),
        value: row
          ? selectedFunnelMetric === "taxaConversao"
            ? Math.round(row.taxaConversao * 10) / 10
            : Math.round(row[selectedFunnelMetric])
          : 0,
      };
    });
  }, [funnel, dateRange, selectedFunnelMetric]);

  const funnelChartMax = useMemo(() => {
    if (!funnelChartData.length) return 100;
    const max = Math.max(...funnelChartData.map((d) => d.value));
    return max > 0 ? Math.ceil(max * 1.1) : 100;
  }, [funnelChartData]);

  const funnelChartTickFormatter = (value: number) => {
    if (selectedFunnelMetric === "tempoCheckout") return formatDuration(value);
    if (selectedFunnelMetric === "pedidosIniciados" || selectedFunnelMetric === "pedidosFinalizados") {
      return value.toLocaleString("pt-BR");
    }
    return `${value}%`;
  };

  return (
    <div className={`marketing-metrics-theme ${mmLight ? "mm-light" : ""} min-h-screen bg-background text-foreground`}>
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-normal">
              Análise de Marketing
            </h1>
          </div>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMmLight((v) => !v)}
            aria-label={mmLight ? "Ativar modo escuro" : "Ativar modo claro"}
            title={mmLight ? "Modo escuro" : "Modo claro"}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            {mmLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span className="hidden sm:inline">{mmLight ? "Escuro" : "Claro"}</span>
          </button>
          <Link
            to="/admin-dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Painel de Administração
          </Link>
          </div>
        </div>

        {/* Period selector */}
        <section className="mb-6 border-y border-border py-5">
          <div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
                <span className="text-2xl font-bold">Período</span>
                {dateRange?.from && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {dateRange.to
                      ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                      : format(dateRange.from, "dd/MM/yyyy")}
                  </span>
                )}
                <DateRangePicker
                  dateRange={dateRange}
                  onDateRangeChange={handleDateRangeChange}
                  className="w-full sm:w-auto"
                  buttonClassName="rounded-full border-border bg-background px-4 py-2 text-foreground hover:bg-muted"
                  activePresetLabel={activePreset}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {datePresets.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset.label, preset.range)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                      activePreset === preset.label
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    )}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  onClick={() => setActivePreset("Personalizado")}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                    activePreset === "Personalizado"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  )}
                >
                  Personalizado
                </Button>
              </div>
            </div>
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-4">
            <TabsTrigger value="overview" className="whitespace-normal py-3">Visão Geral & Vendas</TabsTrigger>
            <TabsTrigger value="performance" className="whitespace-normal py-3">Produtos & Funil</TabsTrigger>
            <TabsTrigger value="acquisition" className="whitespace-normal py-3">Aquisição & Público</TabsTrigger>
            <TabsTrigger value="hours" className="whitespace-normal py-3">Horários & Comportamento</TabsTrigger>
          </TabsList>
        </Tabs>
        {activeTab === "performance" && <Tabs value={performanceView} onValueChange={setPerformanceView} className="mb-6"><TabsList><TabsTrigger value="produtos">Produtos</TabsTrigger><TabsTrigger value="funil">Funil de conversão</TabsTrigger></TabsList></Tabs>}
        {activeTab !== "hours" && <>
        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6 sm:grid sm:grid-cols-2 lg:flex lg:flex-row lg:flex-nowrap lg:gap-3">
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className={filterTriggerClass(sourceFilterActive)}>
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
            <SelectTrigger className={filterTriggerClass(campaignFilterActive)}>
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

          {metricType !== "ga4" && (
            <Select
              value={locationMode}
              onValueChange={(v) => {
                setLocationMode(v as "todas" | LocationField);
                setLocationValue("");
              }}
            >
              <SelectTrigger className={filterTriggerClass(locationModeActive)}>
                <SelectValue placeholder="Localizações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Localizações</SelectItem>
                <SelectItem value="cidade">Cidade</SelectItem>
                {allowBairroFilter && <SelectItem value="bairro">Bairro</SelectItem>}
              </SelectContent>
            </Select>
          )}

          {metricType !== "ga4" && locationMode !== "todas" && (
            <Select value={locationValue} onValueChange={setLocationValue}>
              <SelectTrigger className={filterTriggerClass(locationValueActive)}>
                <SelectValue
                  placeholder={
                    locationOptionsLoading
                      ? "Carregando..."
                      : locationMode === "cidade"
                        ? "Selecione a cidade"
                        : "Selecione o bairro"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {locationOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="shrink-0 border-primary text-primary"
            >
              <X className="mr-2 h-4 w-4" />
              Limpar Filtros
            </Button>
          )}
        </div>

        </>}

        {(metricType === "vendas" || metricType === "geral") && (
          <>
            {metricType === "geral" && (
              <h2 className="text-lg font-semibold mb-4">Vendas</h2>
            )}
            {/* Sales metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {salesCards.map((card) => (
                <MetricCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  change={card.change ?? null}
                  isPositive={card.isPositive ?? true}
                  selected={card.metricKey ? selectedSalesMetric === card.metricKey : false}
                  onClick={card.metricKey ? () => { if (card.metricKey) setSelectedSalesMetric(card.metricKey); } : undefined}

                />
              ))}
            </div>

            {/* Sales chart (somente na vista Vendas) */}
            {(metricType === "vendas" || metricType === "geral") && (
            <section className="my-8 border-t border-border pt-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    {salesMetricLabel}
                  </p>
                  {salesChartLoading && (
                    <span className="text-xs text-muted-foreground">Carregando…</span>
                  )}
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={salesChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
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
                        domain={[0, salesChartMax]}
                        tickFormatter={salesChartTickFormatter}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                          color: "hsl(var(--card-foreground))",
                        }}
                        formatter={(value: number) => [
                          isSalesMoneyMetric
                            ? formatBRL(Number(value))
                            : selectedSalesMetric === "convTimeSeconds"
                              ? formatDuration(Number(value))
                              : Number(value).toLocaleString("pt-BR"),
                          salesMetricLabel,
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#salesGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
            )}

            {/* Sales breakdown */}
            <section className="my-8 min-w-0 border-t border-border pt-6">
<h2 className="mb-4 text-lg font-semibold">Custos e perfil dos compradores</h2>

                <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Custos registrados (CMV, brindes e frete)</p>
                    <p className="text-2xl font-bold tracking-normal text-destructive">
                      {salesSummary ? formatBRL(salesSummary.totalCost) : "…"}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                      <span>CMV: {salesSummary ? formatBRL(salesSummary.totalProductCost) : "…"}</span>
                      <span>Frete: {salesSummary ? formatBRL(salesSummary.totalFreight) : "…"}</span>
                      {salesSummary && salesSummary.totalGiftCost > 0 && (
                        <span>Brindes: {formatBRL(salesSummary.totalGiftCost)}</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 rounded-lg bg-food-green/10 p-4">
                    <p className="text-sm font-medium text-food-green">Resultado estimado (receita − custos registrados)</p>
                    <p className="text-2xl font-bold tracking-normal text-food-green">
                      {salesSummary ? formatBRL(salesSummary.totalRevenue - salesSummary.totalCost) : "…"}
                    </p>
                  </div>
                  {([
                    { title: "Perfil do Comprador", hint: "Pelo histórico do telefone", data: buyerProfile?.customer, a: ["Novos Clientes", "novos"], b: ["Clientes Recorrentes", "recorrentes"] },
                    { title: "Jornada de Acesso", hint: "Pelas visitas no site", data: buyerProfile?.journey, a: ["Comprou na 1ª Visita", "primeiraVisita"], b: ["Comprou após Retorno", "retorno"] },
                  ] as const).map((blk) => {
                    const d = blk.data as Record<string, { revenue: number; orders: number }> | undefined;
                    const total = d ? Object.values(d).reduce((acc, x) => acc + x.revenue, 0) : 0;
                    return (
                      <div key={blk.title} className="space-y-2 sm:col-span-2 border-t border-border pt-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold">{blk.title}</p>
                          <p className="text-xs text-muted-foreground">{blk.hint}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[blk.a, blk.b].map(([label, key]) => {
                            const seg = d?.[key];
                            const pct = seg && total > 0 ? Math.round((seg.revenue / total) * 100) : 0;
                            return (
                              <div key={key} className="space-y-0.5">
                                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                                <p className="text-lg font-bold">{seg ? formatBRL(seg.revenue) : "…"}</p>
                                {seg && (
                                  <p className="text-xs text-muted-foreground">
                                    {pct}% da receita · {seg.orders} pedidos · TM {formatBRL(seg.orders ? seg.revenue / seg.orders : 0)}
                                  </p>
                                )}
                                {blk.title === "Jornada de Acesso" && buyerProfile && (() => {
                                  const branch = key === "retorno" ? buyerProfile.journey.retorno : buyerProfile.journey.primeiraVisita;
                                  return <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
                                    {([['Novos Clientes', branch.novos], ['Clientes Recorrentes', branch.recorrentes], ['Perfil não identificado', branch.naoIdentificados]] as const).filter(([, part]) => part.orders > 0).map(([name, part]) => <div key={name} className="text-xs">
                                      <p className="font-medium">{name} · {branch.revenue ? Math.round(part.revenue / branch.revenue * 100) : 0}% da receita</p>
                                      <p className="text-muted-foreground">{formatBRL(part.revenue)} · {part.orders} pedidos</p>
                                    </div>)}
                                  </div>;
                                })()}
                              </div>
                            );
                          })}
                        </div>
                        {blk.title === "Jornada de Acesso" && buyerProfile && buyerProfile.unlinkedOrders > 0 && <p className="text-xs text-muted-foreground">{buyerProfile.unlinkedOrders} pedidos sem vínculo exato com eventos de visita</p>}
                        {blk.title === "Jornada de Acesso" && locationMode === "bairro" && <p className="text-xs text-muted-foreground">Compras antigas sem pedido vinculado não têm bairro identificado.</p>}
                        {blk.title === "Perfil do Comprador" && buyerProfile && buyerProfile.unclassifiedOrders > 0 && <p className="text-xs text-muted-foreground">{buyerProfile.unclassifiedOrders} pedidos sem telefone identificado</p>}
                      </div>
                    );
                  })}
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-sm font-semibold">Top 3 dias com mais vendas:</p>
                    {topSalesDays.length > 0 ? (
                      <ul className="space-y-1">
                        {topSalesDays.map((d) => (
                          <li key={d.date} className="text-xs text-foreground">
                            {d.date} -&nbsp;&nbsp;{formatBRL(d.value)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem vendas no período.</p>
                    )}
                  </div>
                  
                </div>
              
</section>

            {/* Relatório Completo de Vendas */}
            <LocationSalesReport filters={dateRange?.from && dateRange?.to ? {
              startDate: format(dateRange.from, "yyyy-MM-dd"),
              endDate: format(dateRange.to, "yyyy-MM-dd"),
              source: selectedSource === "todas" ? null : selectedSource,
              campaign: selectedCampaign === "campanhas" ? null : selectedCampaign,
              location: locationFilter,
            } : null} />

            <section className="my-8 min-w-0 border-t border-border pt-6">
<h2 className="mb-4 text-lg font-semibold">Pedidos do período</h2>


                {salesReportMonths.length > 1 && (
                  <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-3 shrink-0">
                    <Button
                      type="button"
                      onClick={() => setReportMonthIndex((i) => Math.min(i + 1, salesReportMonths.length - 1))}
                      disabled={reportMonthIndex >= salesReportMonths.length - 1}
                      className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      ‹ Anterior
                    </Button>
                    <span className="text-sm font-semibold capitalize">{currentReportMonth?.label}</span>
                    <Button
                      type="button"
                      onClick={() => setReportMonthIndex((i) => Math.max(i - 1, 0))}
                      disabled={reportMonthIndex <= 0}
                      className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Próximo ›
                    </Button>
                  </div>
                )}

                <MarketingReportTable rows={(currentReportMonth?.rows ?? []).map(row => ({ id: row.id, label: row.customer, detail: `${format(new Date(row.dateIso), "dd/MM/yyyy HH:mm")} · #${row.code}`, quantity: row.itemCount, revenue: row.total, status: row.status }))} nameLabel="Cliente / Pedido" quantityLabel="Itens" revenueLabel="Valor" loading={salesReportLoading} />
</section>

            {/* Relatório de cupons */}
            <section className="my-8 min-w-0 border-t border-border pt-6">
<h2 className="mb-2 text-lg font-semibold">Cupons Utilizados</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  {salesSummary && !couponsLoading
                    ? `${couponRows.reduce((a, r) => a + r.uses, 0)} de ${salesSummary.orderCount} pedidos${selectedCampaign !== "campanhas" ? " da campanha" : ""} com cupom (${salesSummary.orderCount ? ((couponRows.reduce((a, r) => a + r.uses, 0) / salesSummary.orderCount) * 100).toFixed(1).replace(".", ",") : "0,0"}%)`
                    : "…"}
                </p>

                <MarketingReportTable rows={couponRows.map(row => ({ id: row.name, label: row.name, detail: `${row.share.toFixed(1)}% dos usos`, quantity: row.uses, revenue: row.totalDiscount }))} nameLabel="Cupom" quantityLabel="Usos" revenueLabel="Desconto e custo de brindes" totalLabel="Total de descontos e brindes" loading={couponsLoading} />
</section>





            {/* Detalhamento: Quantidade de Vendas */}
            <section className="my-8 min-w-0 border-t border-border pt-6">
<h2 className="mb-4 text-lg font-semibold">Destaques do período</h2>

                <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Top 3 dias com mais pedidos:</p>
                    {orderCountDetail && orderCountDetail.topDays.length > 0 ? (
                      <ul className="space-y-1">
                        {orderCountDetail.topDays.map((d) => (
                          <li key={d.date} className="text-xs text-foreground">
                            {format(new Date(`${d.date}T00:00:00`), "dd/MM/yyyy")} -&nbsp;&nbsp;
                            {d.orders} {d.orders === 1 ? "pedido" : "pedidos"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {orderCountLoading ? "Carregando…" : "Sem vendas no período."}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Top 3 produtos mais vendidos:</p>
                    {orderCountDetail && orderCountDetail.topProducts.length > 0 ? (
                      <ul className="space-y-1">
                        {orderCountDetail.topProducts.map((p, i) => (
                          <li key={`${p.name}-${p.size ?? ""}-${i}`} className="text-xs text-foreground">
                            {p.quantity} {p.category ? `${p.category} ` : ""}
                            {p.name}
                            {p.size ? ` "${p.size}"` : ""} - {formatBRL(p.revenue)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {orderCountLoading ? "Carregando…" : "Sem produtos vendidos no período."}
                      </p>
                    )}
                  </div>

                  
                </div>
              
</section>

          </>
        )}

        {metricType === "produtos" && (
          <>
            <p className="mb-4 text-xs text-muted-foreground">Ranking e visualizações: eventos do cardápio, filtrados por origem e campanha. Localização aplica-se somente ao relatório de produtos vendidos.</p>
            {/* Cards de produtos */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mb-8">
              <MetricCard
                label="Produtos Mais Visualizados"
                value={
                  productsLoading
                    ? "…"
                    : productRanking?.topViewed[0]
                      ? `${productRanking.topViewed[0].productName} — ${formatNumber(productRanking.topViewed[0].value)}`
                      : "Sem dados"
                }
                subtitle={
                  !productsLoading && productRanking?.topViewed[0]
                    ? `Categoria: ${productRanking.topViewed[0].categoryName}`
                    : undefined
                }
                selected={selectedProductMetric === "productViews"}
                onClick={() => {
                  setSelectedProductMetric("productViews");
                }}
                showInfoIcon
              />
              <MetricCard
                label="Produtos Mais Vendidos"
                value={
                  productsLoading
                    ? "…"
                    : productRanking?.topSold[0]
                      ? `${productRanking.topSold[0].productName} — ${formatNumber(productRanking.topSold[0].value)}`
                      : "Sem dados"
                }
                subtitle={
                  !productsLoading && productRanking?.topSold[0]
                    ? `Categoria: ${productRanking.topSold[0].categoryName}`
                    : undefined
                }
                selected={selectedProductMetric === "productSales"}
                onClick={() => {
                  setSelectedProductMetric("productSales");
                }}
                showInfoIcon
              />
            </div>

            {/* Detalhamento — Top 5 produtos */}
            <section className="my-8 min-w-0 border-t border-border pt-6">
<h2 className="mb-4 text-lg font-semibold">Ranking de produtos · Top 5 Produtos mais Visualizados</h2>

                <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {productsLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando…</p>
                  ) : (productDetail === "productSales"
                      ? productRanking?.topSold ?? []
                      : productRanking?.topViewed ?? []
                    ).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                  ) : (
                    (productDetail === "productSales"
                      ? (productRanking?.topSold ?? [])
                      : (productRanking?.topViewed ?? [])
                    ).map((row, i) => (
                      <div
                        key={row.productId}
                        className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">
                            <span className="text-muted-foreground mr-2">{i + 1}.</span>
                            {row.productName}
                          </span>
                          <span className="block text-xs font-medium text-muted-foreground">
                            {row.categoryName}
                          </span>
                        </span>
                        <span className="font-bold whitespace-nowrap">
                          {row.value.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              
</section>

            {/* Relatório Completo de Produtos Vendidos */}
            <section className="my-8 min-w-0 border-t border-border pt-6">
<h2 className="mb-4 text-lg font-semibold">Produtos vendidos por categoria</h2>


                {productsReportMonths.length > 1 && (
                  <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-3 shrink-0">
                    <Button
                      type="button"
                      onClick={() =>
                        setProductsMonthIndex((i) => Math.min(i + 1, productsReportMonths.length - 1))
                      }
                      disabled={productsMonthIndex >= productsReportMonths.length - 1}
                      className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      ‹ Anterior
                    </Button>
                    <span className="text-sm font-semibold capitalize">{currentProductsMonth?.label}</span>
                    <Button
                      type="button"
                      onClick={() => setProductsMonthIndex((i) => Math.max(i - 1, 0))}
                      disabled={productsMonthIndex <= 0}
                      className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Próximo ›
                    </Button>
                  </div>
                )}

                <MarketingReportTable rows={(currentProductsMonth?.categories ?? []).flatMap(cat => cat.rows.map((row, i) => ({ id: `${cat.category}-${row.menuItemId ?? row.name}-${row.size ?? ""}-${i}`, label: `${row.name}${row.size ? ` · ${row.size}` : ""}`, detail: cat.category, quantity: row.quantity, revenue: row.revenue })))} nameLabel="Produto / Categoria" quantityLabel="Unidades" revenueLabel="Receita dos itens" loading={productsReportLoading} />
</section>



            {/* Evolução diária da métrica de produtos selecionada */}
            <section className="my-8 border-t border-border pt-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    {productMetricLabels[selectedProductMetric]}
                  </p>
                  {productsLoading && (
                    <span className="text-xs text-muted-foreground">Carregando…</span>
                  )}
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={productChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="productsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
                        domain={[0, productChartMax]}
                        tickFormatter={(value: number) => formatNumber(Number(value))}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                          color: "hsl(var(--card-foreground))",
                        }}
                        formatter={(value: number) => [
                          Number(value).toLocaleString("pt-BR"),
                          productMetricLabels[selectedProductMetric],
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#productsGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </>
        )}

        

        {metricType === "funil" && (
          <>
            {/* Funil de vendas */}
            <section className="mb-8 border-y border-border py-5">
              <div>
                <div className="space-y-3 sm:hidden">
                  {funnelStages.map((stage, i) => {
                    const maxValue = Math.max(...funnelStages.map((item) => item.value), 1);
                    const width = Math.max(42, Math.sqrt(stage.value / maxValue) * 100);
                    const next = funnelStages[i + 1];
                    const rate = next && stage.value > 0 ? Math.round((next.value / stage.value) * 100) : null;
                    const opacity = 0.35 + (i / Math.max(funnelStages.length - 1, 1)) * 0.65;
                    return (
                      <div key={stage.label} className="flex items-center gap-3">
                        <div className="w-28 shrink-0 text-right">
                          <p className="text-[11px] font-medium leading-tight text-muted-foreground">{stage.label}</p>
                          {rate !== null && (
                            <p className="mt-1 text-[10px] text-muted-foreground">{rate}% para próxima</p>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 justify-center">
                          <div
                            className="flex h-12 min-w-[42%] items-center justify-center rounded-sm transition-[width] duration-300"
                            style={{ width: `${width}%`, backgroundColor: `hsl(var(--primary) / ${opacity})` }}
                          >
                            <span className="px-2 text-sm font-bold text-primary-foreground">
                              {formatNumber(stage.value)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden items-start overflow-x-auto sm:flex">
                  {funnelStages.map((stage, i) => {
                    // Escala por raiz quadrada para as etapas finais não sumirem
                    const widthWeight = Math.sqrt(stage.value);
                    const next = funnelStages[i + 1];
                    const rate = next && stage.value > 0 ? Math.round((next.value / stage.value) * 100) : null;
                    const opacity = 0.3 + (i / (funnelStages.length - 1)) * 0.7;
                    const clipPath =
                      i === 0
                        ? "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)"
                        : i === funnelStages.length - 1
                          ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)"
                          : "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)";
                    return (
                      <div
                        key={stage.label}
                        style={{ flexGrow: Math.max(1, widthWeight), flexBasis: 0 }}
                        className={cn("min-w-[90px]", i > 0 && "-ml-3")}
                      >
                        <p className="mb-2 flex h-9 items-end justify-center px-1 text-center text-[10px] sm:text-xs font-medium leading-tight text-muted-foreground">
                          {stage.label}
                        </p>
                        <div
                          className="flex h-16 sm:h-24 items-center justify-center"
                          style={{ backgroundColor: `hsl(var(--primary) / ${opacity})`, clipPath }}
                        >
                          <span className="px-4 text-xs sm:text-xl font-bold text-primary-foreground whitespace-nowrap">
                            {formatNumber(stage.value)}
                          </span>
                        </div>
                        <p className="mt-2 h-4 text-center text-xs font-medium text-muted-foreground">
                          {rate !== null ? `${rate}% →` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Cards do funil (dados reais, todos clicáveis) */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {(Object.keys(funnelMetricLabels) as FunnelMetricKey[]).map((key) => (
                <MetricCard
                  key={key}
                  label={funnelMetricLabels[key]}
                  value={funnelCardValue(key)}
                  change={funnelChange(key)?.label ?? null}
                  isPositive={funnelChange(key) ? (["abandonoCarrinho", "desistenciaCheckout", "tempoCheckout"].includes(key) ? !funnelChange(key)?.isPositive : funnelChange(key)?.isPositive) : true}
                  selected={selectedFunnelMetric === key}
                  onClick={() => {
                    setSelectedFunnelMetric(key);
                  }}
                  showInfoIcon={
                    key === "abandonoCarrinho" || key === "desistenciaCheckout" || key === "taxaConversao"
                  }
                />
              ))}
            </div>

            {/* Detalhamento do funil */}
            {["abandonoCarrinho", "taxaConversao", "desistenciaCheckout"].includes(funnelDetail) && (
            <section className="my-8 min-w-0 border-t border-border pt-6">
<h2 className="mb-4 text-lg font-semibold">Detalhamento do funil · eventos do cardápio</h2>

                <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {!funnel ? (
                    <p className="text-sm text-muted-foreground">Carregando…</p>
                  ) : funnelDetail === "abandonoCarrinho" ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sessões que adicionaram ao carrinho</span>
                        <span className="font-semibold">{funnel.stages.addToCart.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sessões que iniciaram o checkout</span>
                        <span className="font-semibold">{funnel.stages.beginCheckout.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Valor Potencial Perdido</span>
                        <span className="font-bold text-destructive">
                          {abandonedLostValue === null ? "…" : formatBRL(abandonedLostValue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-3 text-sm sm:col-span-2">
                        <span className="text-muted-foreground">Carrinhos abandonados</span>
                        <span className="font-bold text-destructive">
                          {Math.max(0, funnel.stages.addToCart - funnel.stages.beginCheckout).toLocaleString("pt-BR")} ({funnelCardValue("abandonoCarrinho")})
                        </span>
                      </div>
                    </>
                  ) : funnelDetail === "taxaConversao" ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Visitas ao cardápio</span>
                        <span className="font-semibold">{funnel.stages.visits.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pedidos finalizados</span>
                        <span className="font-semibold">{funnel.stages.purchases.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-3 text-sm sm:col-span-2">
                        <span className="text-muted-foreground">Taxa de conversão</span>
                        <span className="font-bold text-food-green">
                          {funnelCardValue("taxaConversao")}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sessões que iniciaram o checkout</span>
                        <span className="font-semibold">{funnel.stages.beginCheckout.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sessões que finalizaram o checkout</span>
                        <span className="font-semibold">{funnel.stages.endCheckout.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sessões com compra concluída</span>
                        <span className="font-semibold">{funnel.stages.purchases.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Valor Potencial Perdido</span>
                        <span className="font-bold text-destructive">
                          {checkoutLostValue === null ? "…" : formatBRL(checkoutLostValue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-3 text-sm sm:col-span-2">
                        <span className="text-muted-foreground">Desistências no checkout</span>
                        <span className="font-bold text-destructive">
                          {Math.max(0, funnel.stages.beginCheckout - funnel.stages.purchases).toLocaleString("pt-BR")} ({funnelCardValue("desistenciaCheckout")})
                        </span>
                      </div>
                    </>
                  )}
                </div>
              
</section>
            )}

            {/* Evolução da métrica selecionada */}
            <section className="my-8 border-t border-border pt-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Evolução — {funnelMetricLabels[selectedFunnelMetric]}
                  </p>
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={funnelChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="funnelGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
                        domain={[0, funnelChartMax]}
                        tickFormatter={funnelChartTickFormatter}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                          color: "hsl(var(--card-foreground))",
                        }}
                        formatter={(value: number) => [
                          funnelChartTickFormatter(Number(value)),
                          funnelMetricLabels[selectedFunnelMetric],
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#funnelGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </>
        )}

        {(metricType === "visitas") && (
          <>
        <h2 className="text-lg font-semibold mb-4">Visitas ao cardápio · Dados internos</h2>
        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
          <MetricCard
            label="Duração Média por Visita"
            value={visits ? formatDuration(visits.averageVisitDurationSeconds) : "…"}
            change={visitChange("averageVisitDurationSeconds")?.label ?? null}
            isPositive={visitChange("averageVisitDurationSeconds")?.isPositive ?? true}
          />
          {selectedCampaign !== "campanhas" && (
            <MetricCard
              label="Sessões da Campanha"
              value={bounce ? formatNumber(bounce.totalSessions) : "…"}
              change={bounce && prevBounce ? computeChange(bounce.totalSessions, prevBounce.totalSessions)?.label ?? null : null}
              isPositive={bounce && prevBounce ? computeChange(bounce.totalSessions, prevBounce.totalSessions)?.isPositive ?? true : true}
            />
          )}
          <MetricCard
            label="Taxa de Rejeição"
            value={bounce ? `${bounce.rate.toFixed(1).replace(".", ",")}%` : "…"}
            change={
              bounce && prevBounce ? computeChange(bounce.rate, prevBounce.rate)?.label ?? null : null
            }
            isPositive={
              bounce && prevBounce
                ? !(computeChange(bounce.rate, prevBounce.rate)?.isPositive ?? false)
                : true
            }
          />
        </div>

        {/* Modal — detalhamento da Taxa de Rejeição */}
        <section className="my-8 min-w-0 border-t border-border pt-6">
<h2 className="mb-4 text-lg font-semibold">Detalhamento — Taxa de Rejeição</h2>


            <div className="py-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Taxa de rejeição</p>
                <p className="text-2xl font-bold">
                  {bounce ? `${bounce.rate.toFixed(1).replace(".", ",")}%` : "…"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {bounce
                    ? `${formatNumber(bounce.bouncedSessions)} de ${formatNumber(bounce.totalSessions)} sessões`
                    : ""}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Visitas novas</p>
                <p className="text-xl font-bold">{bounce ? formatNumber(bounce.bouncedNew) : "…"}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Visitas recorrentes</p>
                <p className="text-xl font-bold">
                  {bounce ? formatNumber(bounce.bouncedReturning) : "…"}
                </p>
              </div>
            </div>
          
</section>


        {/* Chart (somente nas vistas Visitas/GA4) */}
        {(metricType === "visitas") && (
        <section className="mt-8 border-t border-border pt-6">
          <div>
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
          </div>
        </section>
        )}
          </>
        )}
        {activeTab === "acquisition" && dateRange?.from && dateRange?.to && <MarketingAttributionReports start={format(dateRange.from, "yyyy-MM-dd")} end={format(dateRange.to, "yyyy-MM-dd")} />}
        {activeTab === "acquisition" && dateRange?.from && dateRange?.to && <section className="mt-8 border-t border-border pt-6"><h2 className="mb-2 text-lg font-semibold">Aparelhos, sistemas e navegadores · Cardápio</h2><p className="mb-4 text-xs text-muted-foreground">Período completo · independente dos filtros de origem, campanha e localização.</p><DeviceMetrics from={dateRange.from} to={dateRange.to} /></section>}
        {(activeTab === "acquisition" || activeTab === "hours") && dateRange?.from && dateRange?.to && <MarketingGA4Reports start={format(dateRange.from, "yyyy-MM-dd")} end={format(dateRange.to, "yyyy-MM-dd")} mode={activeTab === "hours" ? "hours" : "acquisition"} />}
      </div>
    </div>
  );
};

export default MarketingMetrics;
