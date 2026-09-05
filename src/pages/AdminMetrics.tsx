import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BarChart3 as PageIcon } from "lucide-react";
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { subDays, format, parseISO, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { ArrowLeft, DollarSign, ShoppingBag, TrendingUp, Package, Users, MapPin, Eye, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { getOrdersByDateRange } from "@/services/orderService";
import { getProductMetrics, type ProductMetric } from "@/services/productEventService";
import { getAllMenuItems } from "@/services/menuItemService";
import { supabase } from "@/integrations/supabase/client";
import { phoneDigits } from "@/utils/phoneUtils";
import { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/DateRangePicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

const ordersChartConfig: ChartConfig = {
  pedidos: { label: "Pedidos", color: "hsl(var(--primary))" },
};

const revenueChartConfig: ChartConfig = {
  faturamento: { label: "Faturamento", color: "hsl(142, 76%, 36%)" },
};

const topProductsChartConfig: ChartConfig = {
  quantidade: { label: "Quantidade", color: "hsl(var(--primary))" },
};

const topProductsValueChartConfig: ChartConfig = {
  valor: { label: "Valor (R$)", color: "hsl(142, 76%, 36%)" },
};

const topBuyersChartConfig: ChartConfig = {
  pedidos: { label: "Pedidos", color: "hsl(262, 83%, 58%)" },
};

const topBuyersValueChartConfig: ChartConfig = {
  valor: { label: "Valor (R$)", color: "hsl(262, 83%, 45%)" },
};

const topNeighborhoodsChartConfig: ChartConfig = {
  pedidos: { label: "Pedidos", color: "hsl(25, 95%, 53%)" },
};

const topNeighborhoodsValueChartConfig: ChartConfig = {
  valor: { label: "Valor (R$)", color: "hsl(25, 95%, 40%)" },
};

const AdminMetrics = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-metrics-orders-firebase", dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) return [];
      const result = await getOrdersByDateRange(dateRange.from, dateRange.to);
      return result.filter((o) => o.status !== "cancelled");
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
  });

  const { data: productMetrics = [] } = useQuery({
    queryKey: ["product-metrics"],
    queryFn: getProductMetrics,
  });

  const { data: usersBairroMap = new Map<string, string>() } = useQuery({
    queryKey: ["users-bairro-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("phone, bairro")
        .not("bairro", "is", null);
      const map = new Map<string, string>();
      if (error || !data) return map;
      data.forEach((u: any) => {
        const key = phoneDigits(u.phone);
        if (key && u.bairro) map.set(key, u.bairro);
      });
      return map;
    },
  });
  const { data: menuItems = [] } = useQuery({
    queryKey: ["menu-items-cost"],
    queryFn: getAllMenuItems,
  });

  const mostViewed = useMemo(() => {
    if (!productMetrics.length) return null;
    return productMetrics.reduce((best, curr) => curr.views > best.views ? curr : best, productMetrics[0]);
  }, [productMetrics]);

  const mostSold = useMemo(() => {
    if (!productMetrics.length) return null;
    return productMetrics.reduce((best, curr) => curr.sales > best.sales ? curr : best, productMetrics[0]);
  }, [productMetrics]);

  const top5MostViewed = useMemo(() => {
    return [...productMetrics]
      .filter(p => p.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }, [productMetrics]);

  const top5MostSold = useMemo(() => {
    return [...productMetrics]
      .filter(p => p.sales > 0)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
  }, [productMetrics]);

  const [viewedDialogOpen, setViewedDialogOpen] = useState(false);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);

  const totalVendas = useMemo(
    () => orders.reduce((sum, o) => sum + (o.total || 0), 0),
    [orders]
  );

  const custoProduto = useMemo(() => {
    const itemMap = new Map<string, any>();
    menuItems.forEach((mi) => itemMap.set(mi.id, mi));
    const resolveCost = (item: any): number => {
      const mi = itemMap.get(item.menuItemId);
      const sizeCost = item?.selectedSize?.cost;
      if (mi?.priceFrom && typeof sizeCost === "number") return sizeCost;
      return mi?.cost || 0;
    };
    return orders.reduce((sum, o) => {
      if (!Array.isArray(o.items)) return sum;
      return sum + o.items.reduce((s, item: any) => {
        if (item?.isGift) return s; // brindes contam em "Custo Brindes"
        return s + resolveCost(item) * (item.quantity || 1);
      }, 0);
    }, 0);
  }, [orders, menuItems]);

  const custoBrindes = useMemo(() => {
    const itemMap = new Map<string, any>();
    menuItems.forEach((mi) => itemMap.set(mi.id, mi));
    return orders.reduce((sum, o) => {
      if (!Array.isArray(o.items)) return sum;
      return sum + o.items.reduce((s, item: any) => {
        if (!item?.isGift) return s;
        const productId = item.giftProductId || item.menuItemId;
        const mi = itemMap.get(productId);
        const sizeCost = item?.selectedSize?.cost;
        const cost = (mi?.priceFrom && typeof sizeCost === "number")
          ? sizeCost
          : (mi?.cost || 0);
        return s + cost * (item.quantity || 1);
      }, 0);
    }, 0);
  }, [orders, menuItems]);

  const custoFrete = useMemo(
    () => orders.reduce((sum, o) => sum + ((o as any).frete || 0), 0),
    [orders]
  );

  const custoTotal = useMemo(
    () => custoProduto + custoFrete + custoBrindes,
    [custoProduto, custoFrete, custoBrindes]
  );

  const lucratividade = useMemo(() => totalVendas - custoTotal, [totalVendas, custoTotal]);

  const totalPedidos = orders.length;

  const pedidosPorDia = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const map = new Map<string, number>();
    days.forEach((d) => map.set(format(d, "yyyy-MM-dd"), 0));
    orders.forEach((o) => {
      if (o.createdAt) {
        const key = format(parseISO(o.createdAt as string), "yyyy-MM-dd");
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([date, pedidos]) => ({
      date: format(parseISO(date), "dd/MM", { locale: ptBR }),
      pedidos,
    }));
  }, [orders, dateRange]);

  const faturamentoPorDia = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const map = new Map<string, number>();
    days.forEach((d) => map.set(format(d, "yyyy-MM-dd"), 0));
    orders.forEach((o) => {
      if (o.createdAt) {
        const key = format(parseISO(o.createdAt as string), "yyyy-MM-dd");
        map.set(key, (map.get(key) || 0) + (o.total || 0));
      }
    });
    return Array.from(map.entries()).map(([date, faturamento]) => ({
      date: format(parseISO(date), "dd/MM", { locale: ptBR }),
      faturamento: Number(faturamento.toFixed(2)),
    }));
  }, [orders, dateRange]);

  const top5Produtos = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
          if (item?.isGift) return;
          const name = item.name || "Desconhecido";
          const qty = item.quantity || 1;
          map.set(name, (map.get(name) || 0) + qty);
        });
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, quantidade]) => ({ name, quantidade }));
  }, [orders]);

  const top5ProdutosValor = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      if (Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
          if (item?.isGift) return;
          const name = item.name || "Desconhecido";
          const qty = item.quantity || 1;
          const subtotal = (item as any).subtotal || (item.price || 0) * qty;
          map.set(name, (map.get(name) || 0) + subtotal);
        });
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, valor]) => ({ name, valor: Number(valor.toFixed(2)) }));
  }, [orders]);

  const top5Compradores = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      const name = o.customerName?.trim() || "Desconhecido";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, pedidos]) => ({ name, pedidos }));
  }, [orders]);

  const top5CompradoresValor = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      const name = o.customerName?.trim() || "Desconhecido";
      map.set(name, (map.get(name) || 0) + (o.total || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, valor]) => ({ name, valor: Number(valor.toFixed(2)) }));
  }, [orders]);

  const resolveBairro = (o: any): string => {
    const direct = (o.bairro as string | undefined)?.trim();
    if (direct) return direct;
    const key = phoneDigits(o.customerPhone);
    const fromUsers = key ? usersBairroMap.get(key) : undefined;
    return fromUsers?.trim() || "Não informado";
  };

  const top5Bairros = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      const bairro = resolveBairro(o);
      map.set(bairro, (map.get(bairro) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, pedidos]) => ({ name, pedidos }));
  }, [orders, usersBairroMap]);

  const top5BairrosValor = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      const bairro = resolveBairro(o);
      map.set(bairro, (map.get(bairro) || 0) + (o.total || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, valor]) => ({ name, valor: Number(valor.toFixed(2)) }));
  }, [orders, usersBairroMap]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <AdminPageHeader title="Performance do Restaurante" icon={PageIcon} iconBg="bg-teal-100" iconColor="text-teal-600" />
      <div className="flex justify-end mb-8">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          className="w-full sm:w-auto"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total das Vendas</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  R$ {totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Pedidos</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalPedidos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  R$ {totalPedidos > 0
                    ? (totalVendas / totalPedidos).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                    : "0,00"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custo do Produto</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">
                  R$ {custoProduto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custo de Frete</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">
                  R$ {custoFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custo Brindes</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">
                  R$ {custoBrindes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custo Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">
                  R$ {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Lucratividade</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${lucratividade >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  R$ {lucratividade.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Produto mais visto & mais vendido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Produto Mais Visto</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {mostViewed && mostViewed.views > 0 ? (
                  <>
                    <p className="text-lg font-bold truncate">{mostViewed.product_name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      👁 {mostViewed.views} visualizações · 🛒 {mostViewed.sales} vendas
                    </p>
                    <button
                      type="button"
                      onClick={() => setViewedDialogOpen(true)}
                      className="text-xs text-primary hover:underline mt-2"
                    >
                      Mais Detalhes
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados ainda</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Produto Mais Vendido</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {mostSold && mostSold.sales > 0 ? (
                  <>
                    <p className="text-lg font-bold truncate">{mostSold.product_name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      🛒 {mostSold.sales} unidades vendidas · 👁 {mostSold.views} visualizações
                    </p>
                    <button
                      type="button"
                      onClick={() => setSoldDialogOpen(true)}
                      className="text-xs text-primary hover:underline mt-2"
                    >
                      Mais Detalhes
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados ainda</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Dialog open={viewedDialogOpen} onOpenChange={setViewedDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Top 5 Produtos Mais Vistos</DialogTitle>
              </DialogHeader>
              <div className="divide-y">
                {top5MostViewed.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Sem dados ainda</p>
                ) : (
                  top5MostViewed.map((p, idx) => (
                    <div key={p.product_id} className="flex items-center justify-between py-2 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-muted-foreground w-5">{idx + 1}.</span>
                        <span className="text-sm font-medium truncate">{p.product_name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        👁 {p.views} · 🛒 {p.sales}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={soldDialogOpen} onOpenChange={setSoldDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Top 5 Produtos Mais Vendidos</DialogTitle>
              </DialogHeader>
              <div className="divide-y">
                {top5MostSold.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Sem dados ainda</p>
                ) : (
                  top5MostSold.map((p, idx) => (
                    <div key={p.product_id} className="flex items-center justify-between py-2 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-muted-foreground w-5">{idx + 1}.</span>
                        <span className="text-sm font-medium truncate">{p.product_name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        🛒 {p.sales} · 👁 {p.views}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pedidos por dia</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={ordersChartConfig} className="h-[300px] w-full">
                  <LineChart data={pedidosPorDia} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="pedidos" stroke="var(--color-pedidos)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Faturamento por dia</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
                  <LineChart data={faturamentoPorDia} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="faturamento" stroke="var(--color-faturamento)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top 5 Produtos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> Top 5 Produtos
              </CardTitle>
              <p className="text-xs font-bold text-muted-foreground">Por Número de Pedidos</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={topProductsChartConfig} className="h-[300px] w-full">
                <BarChart data={top5Produtos} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={90} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="quantidade" fill="var(--color-quantidade)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Top 5 Produtos por Valor */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> Top 5 Produtos
              </CardTitle>
              <p className="text-xs font-bold text-muted-foreground">Por Valor de Vendas</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={topProductsValueChartConfig} className="h-[300px] w-full">
                <BarChart data={top5ProdutosValor} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={90} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="valor" fill="var(--color-valor)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Top 5 Compradores e Top 5 Bairros - Por Pedidos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Top 5 Compradores
                </CardTitle>
                <p className="text-xs font-bold text-muted-foreground">Por número de Pedidos</p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={topBuyersChartConfig} className="h-[300px] w-full">
                  <BarChart data={top5Compradores} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={90} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="pedidos" fill="var(--color-pedidos)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Top 5 Bairros
                </CardTitle>
                <p className="text-xs font-bold text-muted-foreground">Por número de Pedidos</p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={topNeighborhoodsChartConfig} className="h-[300px] w-full">
                  <BarChart data={top5Bairros} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={90} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="pedidos" fill="var(--color-pedidos)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top 5 Compradores e Top 5 Bairros - Por Valor */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Top 5 Compradores
                </CardTitle>
                <p className="text-xs font-bold text-muted-foreground">Por Valor de Vendas</p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={topBuyersValueChartConfig} className="h-[300px] w-full">
                  <BarChart data={top5CompradoresValor} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={90} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="valor" fill="var(--color-valor)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Top 5 Bairros
                </CardTitle>
                <p className="text-xs font-bold text-muted-foreground">Por Valor de Vendas</p>
              </CardHeader>
              <CardContent>
                <ChartContainer config={topNeighborhoodsValueChartConfig} className="h-[300px] w-full">
                  <BarChart data={top5BairrosValor} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={90} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="valor" fill="var(--color-valor)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminMetrics;
