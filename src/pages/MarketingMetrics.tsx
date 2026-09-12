import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, TrendingUp, TrendingDown, X, ArrowLeft } from "lucide-react";
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
  getUtmCampaigns,
  getDailyVisitMetrics,
  getFunnelOverview,
  getAbandonedCartLostValue,
  getAbandonedCheckoutLostValue,
  getBounceRate,
  getProductRankingMetrics,
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
  fetchProductsReport,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  onDetailsClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  change,
  isPositive = true,
  className,
  selected,
  onClick,
  onDetailsClick,
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
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {onDetailsClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDetailsClick();
            }}
            className="shrink-0 text-xs font-medium text-food-green underline underline-offset-2 hover:text-food-green/80 transition-colors"
          >
            Detalhes
          </button>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-2xl font-bold tracking-tight whitespace-nowrap">{value}</span>
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

const salesMetricLabels: Record<DailySalesMetricKey, string> = {
  totalRevenue: "Valor das Vendas",
  orderCount: "Quantidade de Vendas",
  avgTicketProducts: "Ticket Médio Produtos",
  totalFreight: "Valor Total Fretes",
  avgTicketFreight: "Ticket Médio Fretes",
  totalDiscount: "Descontos/Cupons",
  convTimeSeconds: "Tempo até a conversão",
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

const mockSalesCards: SalesCardDef[] = [
  { label: "Scroll to Goals:", value: "45%", change: "5%", isPositive: true },
];

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
    from: subDays(today, 30),
    to: today,
  });
  const [activePreset, setActivePreset] = useState<string>("Personalizado");

  const datePresets = useMemo(
    () => [
      { label: "Hoje", range: { from: today, to: today } },
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

  const [metricType, setMetricType] = useState("visitas");
  const [visits, setVisits] = useState<VisitMetrics | null>(null);
  const [prevVisits, setPrevVisits] = useState<VisitMetrics | null>(null);
  const [utmSources, setUtmSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState("todas");
  const [utmCampaigns, setUtmCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("campanhas");
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
  const [salesDetailsOpen, setSalesDetailsOpen] = useState(false);
  const [topSalesDays, setTopSalesDays] = useState<ChartPoint[]>([]);
  const [orderCountDetailsOpen, setOrderCountDetailsOpen] = useState(false);
  const [orderCountDetail, setOrderCountDetail] = useState<OrderCountDetail | null>(null);
  const [orderCountLoading, setOrderCountLoading] = useState(false);
  const [salesReportOpen, setSalesReportOpen] = useState(false);
  const [salesReportRows, setSalesReportRows] = useState<SalesReportRow[]>([]);
  const [salesReportLoading, setSalesReportLoading] = useState(false);
  const [reportMonthIndex, setReportMonthIndex] = useState(0);
  const [productsReportOpen, setProductsReportOpen] = useState(false);
  const [productsReportRows, setProductsReportRows] = useState<ProductReportRow[]>([]);
  const [productsReportLoading, setProductsReportLoading] = useState(false);
  const [productsMonthIndex, setProductsMonthIndex] = useState(0);
  const [selectedFunnelMetric, setSelectedFunnelMetric] = useState<FunnelMetricKey>("abandonoCarrinho");
  const [funnelDetail, setFunnelDetail] = useState<FunnelMetricKey | null>(null);
  const [funnel, setFunnel] = useState<FunnelOverview | null>(null);
  const [prevFunnel, setPrevFunnel] = useState<FunnelOverview | null>(null);
  const [bounce, setBounce] = useState<BounceRate | null>(null);
  const [prevBounce, setPrevBounce] = useState<BounceRate | null>(null);
  const [bounceDetailsOpen, setBounceDetailsOpen] = useState(false);
  const [productRanking, setProductRanking] = useState<ProductRankingMetrics | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductMetric, setSelectedProductMetric] = useState<ProductMetricKey>("productViews");
  const [productDetail, setProductDetail] = useState<ProductMetricKey | null>(null);

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
      const day = addDays(dateRange.from!, i);
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
      getBounceRate(start, end, sourceFilter, campaignFilter),
      getBounceRate(prevStart, prevEnd, sourceFilter, campaignFilter),
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
  }, [metricType, dateRange, selectedSource, selectedCampaign]);

  const visitChange = (key: keyof VisitMetrics) =>
    visits && prevVisits ? computeChange(visits[key], prevVisits[key]) : null;

  // Carrega o resumo de vendas do período selecionado e do período anterior
  // equivalente (para o % de variação), respeitando os filtros de UTM.
  useEffect(() => {
    if (metricType !== "vendas" || !dateRange?.from || !dateRange?.to) return;

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
      fetchSalesSummary(start, end, sourceFilter, campaignFilter),
      fetchSalesSummary(
        format(prevStart, "yyyy-MM-dd"),
        format(prevEnd, "yyyy-MM-dd"),
        sourceFilter,
        campaignFilter,
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
  }, [metricType, dateRange, selectedSource, selectedCampaign]);

  // Top 3 dias com mais vendas para o modal de detalhamento
  useEffect(() => {
    if (!salesDetailsOpen || metricType !== "vendas" || !dateRange?.from || !dateRange?.to) {
      setTopSalesDays([]);
      return;
    }
    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;
    let cancelled = false;
    fetchDailySalesMetrics(start, end, "totalRevenue", sourceFilter, campaignFilter)
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
  }, [salesDetailsOpen, metricType, dateRange, selectedSource, selectedCampaign]);

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
    fetchOrderCountDetail(start, end, sourceFilter, campaignFilter)
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
  }, [orderCountDetailsOpen, dateRange, selectedSource, selectedCampaign]);

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
    fetchSalesReport(start, end, sourceFilter, campaignFilter)
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
  }, [salesReportOpen, dateRange, selectedSource, selectedCampaign]);

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
        total: rows.reduce((acc, r) => acc + r.total, 0),
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
    fetchProductsReport(start, end, sourceFilter, campaignFilter)
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
  }, [productsReportOpen, dateRange, selectedSource, selectedCampaign]);

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
      ),
      ...mockSalesCards,
    ],
    [
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
    if (metricType !== "visitas" || !dateRange?.from || !dateRange?.to) return;

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
  }, [metricType, dateRange, selectedMetric, selectedSource, selectedCampaign]);

  // Carrega série diária real da métrica de vendas selecionada
  useEffect(() => {
    if (metricType !== "vendas" || !dateRange?.from || !dateRange?.to) return;

    const start = format(dateRange.from, "yyyy-MM-dd");
    const end = format(dateRange.to, "yyyy-MM-dd");
    const sourceFilter = selectedSource === "todas" ? null : selectedSource;
    const campaignFilter = selectedCampaign === "campanhas" ? null : selectedCampaign;

    let cancelled = false;
    setSalesChartLoading(true);
    fetchDailySalesMetrics(start, end, selectedSalesMetric, sourceFilter, campaignFilter)
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
  }, [metricType, dateRange, selectedSalesMetric, selectedSource, selectedCampaign]);

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
      getFunnelOverview(start, end, sourceFilter, campaignFilter),
      getFunnelOverview(prevStart, prevEnd, sourceFilter, campaignFilter),
    ]).then(([current, previous]) => {
      if (cancelled) return;
      setFunnel(current);
      setPrevFunnel(previous);
    });
    return () => {
      cancelled = true;
    };
  }, [metricType, dateRange, selectedSource, selectedCampaign]);

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
      const day = addDays(dateRange.from!, i);
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
    <div className="marketing-metrics-theme min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">
              Análise de Marketing
            </h1>
          </div>
          <Link
            to="/admin-dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Painel de Administração
          </Link>
        </div>

        {/* Period selector */}
        <Card className="border-0 bg-card text-card-foreground mb-6">
          <CardContent className="p-5">
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
                  <button
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
                  </button>
                ))}
                <button
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
                </button>
              </div>
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
              <SelectItem value="produtos">Produtos</SelectItem>
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

        {metricType === "vendas" ? (
          <>
            {/* Sales metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {salesCards.map((card) => (
                <MetricCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  change={card.change ?? null}
                  isPositive={card.isPositive ?? true}
                  selected={card.metricKey ? selectedSalesMetric === card.metricKey : false}
                  onClick={card.metricKey ? () => setSelectedSalesMetric(card.metricKey!) : undefined}
                  onDetailsClick={
                    card.label === "Quantidade de Vendas"
                      ? () => setOrderCountDetailsOpen(true)
                      : ["Valor das Vendas", "Ticket Médio Produtos"].includes(card.label)
                        ? () => setSalesDetailsOpen(true)
                        : undefined
                  }
                />
              ))}
            </div>

            {/* Sales details modal */}
            <Dialog open={salesDetailsOpen} onOpenChange={setSalesDetailsOpen}>
              <DialogContent className="[&>button]:hidden max-sm:fixed max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:h-screen max-sm:rounded-none max-sm:p-0 sm:max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto border-0 bg-card text-card-foreground">
                <DialogHeader className="relative border-b border-border p-6 pb-4">
                  <DialogTitle className="text-xl font-bold pr-10">Detalhamento de Vendas</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                      : "Período selecionado"}
                  </DialogDescription>
                  <button
                    type="button"
                    onClick={() => setSalesDetailsOpen(false)}
                    className="absolute right-4 top-4 rounded-full bg-destructive p-2 text-white shadow-lg hover:bg-destructive/90 transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </DialogHeader>
                <div className="p-6 pt-2 space-y-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Valor total das Vendas</p>
                    <p className="text-2xl font-bold tracking-tight">
                      {salesSummary ? formatBRL(salesSummary.totalRevenue) : "…"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Quantidade de Vendas</p>
                    <p className="text-2xl font-bold tracking-tight">
                      {salesSummary ? String(salesSummary.orderCount) : "…"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Ticket Médio Produtos</p>
                    <p className="text-2xl font-bold tracking-tight">
                      {salesSummary ? formatBRL(salesSummary.avgTicketProducts) : "…"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Custo total (CMV + Frete)</p>
                    <p className="text-2xl font-bold tracking-tight text-destructive">
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
                  <div className="space-y-1 rounded-xl bg-food-green/10 p-4">
                    <p className="text-sm font-medium text-food-green">Lucratividade Total</p>
                    <p className="text-2xl font-bold tracking-tight text-food-green">
                      {salesSummary ? formatBRL(salesSummary.totalRevenue - salesSummary.totalCost) : "…"}
                    </p>
                  </div>
                  <div className="space-y-2">
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
                  <div className="pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setSalesReportOpen(true)}
                      className="text-sm font-semibold text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
                    >
                      Relatório Completo
                    </button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Relatório Completo de Vendas */}
            <Dialog open={salesReportOpen} onOpenChange={setSalesReportOpen}>
              <DialogContent className="[&>button]:hidden max-sm:fixed max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:h-screen max-sm:rounded-none max-sm:p-0 sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden border-0 bg-card text-card-foreground flex flex-col">
                <DialogHeader className="relative border-b border-border p-6 pb-4 shrink-0">
                  <DialogTitle className="text-xl font-bold pr-10">Relatório Completo</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                      : "Período selecionado"}
                  </DialogDescription>
                  <button
                    type="button"
                    onClick={() => setSalesReportOpen(false)}
                    className="absolute right-4 top-4 rounded-full bg-destructive p-2 text-white shadow-lg hover:bg-destructive/90 transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </DialogHeader>

                {salesReportMonths.length > 1 && (
                  <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setReportMonthIndex((i) => Math.min(i + 1, salesReportMonths.length - 1))}
                      disabled={reportMonthIndex >= salesReportMonths.length - 1}
                      className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      ‹ Anterior
                    </button>
                    <span className="text-sm font-semibold capitalize">{currentReportMonth?.label}</span>
                    <button
                      type="button"
                      onClick={() => setReportMonthIndex((i) => Math.max(i - 1, 0))}
                      disabled={reportMonthIndex <= 0}
                      className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Próximo ›
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 pt-4 max-sm:pb-24">
                  {salesReportLoading ? (
                    <p className="text-xs text-muted-foreground">Carregando…</p>
                  ) : !currentReportMonth || currentReportMonth.rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem vendas no período.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {currentReportMonth.rows.map((row) => (
                        <li key={row.id} className="flex items-start justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{row.customer}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(row.dateIso), "dd/MM/yyyy HH:mm")} · #{row.code}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">{formatBRL(row.total)}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.itemCount} {row.itemCount === 1 ? "item" : "itens"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {currentReportMonth && !salesReportLoading && (
                  <div className="flex items-center justify-between border-t border-border px-6 py-3 text-xs shrink-0 bg-card">
                    <span className="text-muted-foreground">
                      {currentReportMonth.rows.length}{" "}
                      {currentReportMonth.rows.length === 1 ? "pedido" : "pedidos"}
                    </span>
                    <span className="font-semibold">{formatBRL(currentReportMonth.total)}</span>
                  </div>
                )}
              </DialogContent>
            </Dialog>



            {/* Detalhamento: Quantidade de Vendas */}
            <Dialog open={orderCountDetailsOpen} onOpenChange={setOrderCountDetailsOpen}>
              <DialogContent className="[&>button]:hidden max-sm:fixed max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:h-screen max-sm:rounded-none max-sm:p-0 sm:max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto border-0 bg-card text-card-foreground">
                <DialogHeader className="relative border-b border-border p-6 pb-4">
                  <DialogTitle className="text-xl font-bold pr-10">Detalhamento — Quantidade de Vendas</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                      : "Período selecionado"}
                  </DialogDescription>
                  <button
                    type="button"
                    onClick={() => setOrderCountDetailsOpen(false)}
                    className="absolute right-4 top-4 rounded-full bg-destructive p-2 text-white shadow-lg hover:bg-destructive/90 transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </DialogHeader>
                <div className="p-6 pt-2 space-y-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Quantidade total de pedidos</p>
                    <p className="text-2xl font-bold tracking-tight">
                      {orderCountLoading || !orderCountDetail ? "…" : String(orderCountDetail.totalOrders)}
                    </p>
                  </div>

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

                  <div className="pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setProductsReportOpen(true)}
                      className="text-sm font-semibold text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
                    >
                      Relatório Completo
                    </button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Relatório Completo de Produtos Vendidos */}
            <Dialog open={productsReportOpen} onOpenChange={setProductsReportOpen}>
              <DialogContent className="[&>button]:hidden max-sm:fixed max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:h-screen max-sm:rounded-none max-sm:p-0 sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden border-0 bg-card text-card-foreground flex flex-col">
                <DialogHeader className="relative border-b border-border p-6 pb-4 shrink-0">
                  <DialogTitle className="text-xl font-bold pr-10">Relatório Completo</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                      : "Período selecionado"}
                  </DialogDescription>
                  <button
                    type="button"
                    onClick={() => setProductsReportOpen(false)}
                    className="absolute right-4 top-4 rounded-full bg-destructive p-2 text-white shadow-lg hover:bg-destructive/90 transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </DialogHeader>

                {productsReportMonths.length > 1 && (
                  <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-3 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setProductsMonthIndex((i) => Math.min(i + 1, productsReportMonths.length - 1))
                      }
                      disabled={productsMonthIndex >= productsReportMonths.length - 1}
                      className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      ‹ Anterior
                    </button>
                    <span className="text-sm font-semibold capitalize">{currentProductsMonth?.label}</span>
                    <button
                      type="button"
                      onClick={() => setProductsMonthIndex((i) => Math.max(i - 1, 0))}
                      disabled={productsMonthIndex <= 0}
                      className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Próximo ›
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 pt-4 max-sm:pb-24">
                  {productsReportLoading ? (
                    <p className="text-xs text-muted-foreground">Carregando…</p>
                  ) : !currentProductsMonth || currentProductsMonth.categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem produtos vendidos no período.</p>
                  ) : (
                    <div className="space-y-6">
                      {currentProductsMonth.categories.map((cat) => (
                        <div key={cat.category}>
                          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-lg bg-muted/80 px-3 py-2 backdrop-blur-sm">
                            <span className="text-sm font-bold text-foreground">{cat.category}</span>
                            <span className="text-xs text-muted-foreground">
                              {cat.totalQuantity} {cat.totalQuantity === 1 ? "item" : "itens"} · {formatBRL(cat.total)}
                            </span>
                          </div>
                          <ul className="divide-y divide-border">
                            {cat.rows.map((row, i) => (
                              <li
                                key={`${row.monthKey}-${row.name}-${row.size ?? ""}-${i}`}
                                className="flex items-start justify-between gap-3 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {row.name}
                                    {row.size ? ` "${row.size}"` : ""}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {row.quantity} {row.quantity === 1 ? "unidade" : "unidades"}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-semibold">{formatBRL(row.revenue)}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {currentProductsMonth && !productsReportLoading && (
                  <div className="flex items-center justify-between border-t border-border px-6 py-3 text-xs shrink-0 bg-card">
                    <span className="text-muted-foreground">
                      {currentProductsMonth.totalQuantity}{" "}
                      {currentProductsMonth.totalQuantity === 1 ? "item vendido" : "itens vendidos"}
                    </span>
                    <span className="font-semibold">{formatBRL(currentProductsMonth.total)}</span>
                  </div>
                )}
              </DialogContent>
            </Dialog>


            {/* Sales chart */}
            <Card className="border-0 bg-card text-card-foreground">
              <CardContent className="p-5">
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
              </CardContent>
            </Card>
          </>
        ) : metricType === "produtos" ? (
          <>
            {/* Cards de produtos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <MetricCard
                label="Produtos Mais Visualizados"
                value={
                  productsLoading
                    ? "…"
                    : productRanking?.topViewed[0]
                      ? `${productRanking.topViewed[0].productName} — ${formatNumber(productRanking.topViewed[0].value)}`
                      : "Sem dados"
                }
                selected={selectedProductMetric === "productViews"}
                onClick={() => setSelectedProductMetric("productViews")}
                onDetailsClick={() => setProductDetail("productViews")}
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
                selected={selectedProductMetric === "productSales"}
                onClick={() => setSelectedProductMetric("productSales")}
                onDetailsClick={() => setProductDetail("productSales")}
              />
            </div>

            {/* Detalhamento — Top 5 produtos */}
            <Dialog open={productDetail !== null} onOpenChange={(open) => !open && setProductDetail(null)}>
              <DialogContent className="[&>button]:hidden max-sm:fixed max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:h-screen max-sm:rounded-none max-sm:p-0 sm:max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto border-0 bg-card text-card-foreground">
                <DialogHeader className="relative border-b border-border p-6 pb-4">
                  <DialogTitle className="text-xl font-bold pr-10">
                    {productDetail ? productMetricLabels[productDetail] : "Detalhamento"}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                      : "Período selecionado"}
                  </DialogDescription>
                  <button
                    type="button"
                    onClick={() => setProductDetail(null)}
                    className="absolute right-4 top-4 rounded-full bg-destructive p-2 text-white shadow-lg hover:bg-destructive/90 transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </DialogHeader>
                <div className="p-6 pt-4 space-y-3">
                  {productsLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando…</p>
                  ) : (productDetail === "productSales"
                      ? productRanking?.topSold ?? []
                      : productRanking?.topViewed ?? []
                    ).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                  ) : (
                    (productDetail === "productSales"
                      ? productRanking!.topSold
                      : productRanking!.topViewed
                    ).map((row, i) => (
                      <div
                        key={row.productId}
                        className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 text-sm"
                      >
                        <span className="truncate">
                          <span className="text-muted-foreground mr-2">{i + 1}.</span>
                          {row.productName}
                        </span>
                        <span className="font-bold whitespace-nowrap">
                          {row.value.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Evolução diária da métrica de produtos selecionada */}
            <Card className="border-0 bg-card text-card-foreground">
              <CardContent className="p-5">
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
              </CardContent>
            </Card>
          </>
        ) : metricType === "funil" ? (
          <>
            {/* Funil de vendas */}
            <Card className="border-0 bg-card text-card-foreground mb-8">
              <CardContent className="p-4 sm:p-5">
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

                <div className="hidden items-start sm:flex">
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
                        style={{ flexGrow: widthWeight, flexBasis: 0 }}
                        className={cn("min-w-0", i > 0 && "-ml-3")}
                      >
                        <p className="mb-2 flex h-9 items-end justify-center px-1 text-center text-[10px] sm:text-xs font-medium leading-tight text-muted-foreground">
                          {stage.label}
                        </p>
                        <div
                          className="flex h-16 sm:h-24 items-center justify-center"
                          style={{ backgroundColor: `hsl(var(--primary) / ${opacity})`, clipPath }}
                        >
                          <span className="px-4 text-xs sm:text-xl font-bold text-white whitespace-nowrap">
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
              </CardContent>
            </Card>

            {/* Cards do funil (dados reais, todos clicáveis) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {(Object.keys(funnelMetricLabels) as FunnelMetricKey[]).map((key) => (
                <MetricCard
                  key={key}
                  label={funnelMetricLabels[key]}
                  value={funnelCardValue(key)}
                  change={funnelChange(key)?.label ?? null}
                  isPositive={funnelChange(key)?.isPositive ?? true}
                  selected={selectedFunnelMetric === key}
                  onClick={() => setSelectedFunnelMetric(key)}
                  onDetailsClick={
                    key === "abandonoCarrinho" || key === "desistenciaCheckout" || key === "taxaConversao"
                      ? () => setFunnelDetail(key)
                      : undefined
                  }
                />
              ))}
            </div>

            {/* Detalhamento mockado do funil */}
            <Dialog open={funnelDetail !== null} onOpenChange={(open) => !open && setFunnelDetail(null)}>
              <DialogContent className="[&>button]:hidden max-sm:fixed max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:h-screen max-sm:rounded-none max-sm:p-0 sm:max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto border-0 bg-card text-card-foreground">
                <DialogHeader className="relative border-b border-border p-6 pb-4">
                  <DialogTitle className="text-xl font-bold pr-10">
                    {funnelDetail ? funnelMetricLabels[funnelDetail] : "Detalhamento"}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                      : "Período selecionado"}
                  </DialogDescription>
                  <button
                    type="button"
                    onClick={() => setFunnelDetail(null)}
                    className="absolute right-4 top-4 rounded-full bg-destructive p-2 text-white shadow-lg hover:bg-destructive/90 transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </DialogHeader>
                <div className="p-6 pt-4 space-y-3">
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
                      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
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
                      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
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
                      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                        <span className="text-muted-foreground">Desistências no checkout</span>
                        <span className="font-bold text-destructive">
                          {Math.max(0, funnel.stages.beginCheckout - funnel.stages.purchases).toLocaleString("pt-BR")} ({funnelCardValue("desistenciaCheckout")})
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Evolução da métrica selecionada (mockup) */}
            <Card className="border-0 bg-card text-card-foreground">
              <CardContent className="p-5">
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
              </CardContent>
            </Card>
          </>
        ) : (
          <>
        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
            onDetailsClick={() => setBounceDetailsOpen(true)}
          />
          <MetricCard label="Scroll to Goals:" value="—" />
        </div>

        {/* Modal — detalhamento da Taxa de Rejeição */}
        <Dialog open={bounceDetailsOpen} onOpenChange={setBounceDetailsOpen}>
          <DialogContent className="[&>button]:hidden max-sm:fixed max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:h-screen max-sm:rounded-none max-sm:p-0 sm:max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto border-0 bg-card text-card-foreground">
            <DialogHeader className="relative border-b border-border p-6 pb-4">
              <DialogTitle className="text-xl font-bold pr-10">Detalhamento — Taxa de Rejeição</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Sessões que registraram apenas um evento no período.
              </DialogDescription>
              <button
                type="button"
                onClick={() => setBounceDetailsOpen(false)}
                className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogHeader>

            <div className="p-6 space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
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
            </div>
          </DialogContent>
        </Dialog>


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
          </>
        )}
      </div>
    </div>
  );
};

export default MarketingMetrics;
