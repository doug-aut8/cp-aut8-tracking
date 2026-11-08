import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MarketingReportTable } from "./MarketingReportTable";
import { fetchLocationSalesOrders, type LocationSalesFilters } from "@/services/locationSalesService";
import { aggregateLocationSales, aggregateLocationProducts, type LocationSalesField } from "@/services/locationSalesAggregation";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LocationSalesReport({ filters }: { filters: LocationSalesFilters | null }) {
  const [field, setField] = useState<LocationSalesField>("bairro");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filterKey = JSON.stringify(filters);
  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["location-sales", filterKey],
    queryFn: () => filters ? fetchLocationSalesOrders(filters) : Promise.resolve([]),
    enabled: !!filters,
    staleTime: 60_000,
  });
  useEffect(() => { setSelectedId(null); }, [filterKey, field]);
  const locations = useMemo(() => aggregateLocationSales(orders, field), [orders, field]);
  const visible = locations.filter(row => row.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const selected = locations.find(row => row.id === selectedId);
  const products = useMemo(() => aggregateLocationProducts(selected?.orders ?? []), [selected]);
  const nameLabel = field === "bairro" ? "Bairro" : "Cidade";
  const total = locations.reduce((sum, row) => sum + row.revenue, 0);

  return <section className="my-8 min-w-0 border-t border-border pt-6" aria-label="Localizações">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Localizações</h2>
      <Tabs value={field} onValueChange={value => { if (value === "bairro" || value === "cidade") { setField(value); setSearch(""); } }}>
        <TabsList aria-label="Ranking por localização"><TabsTrigger value="bairro">Bairros</TabsTrigger><TabsTrigger value="cidade">Cidades</TabsTrigger></TabsList>
      </Tabs>
    </div>
    <Input aria-label={`Pesquisar ${field === "bairro" ? "bairros" : "cidades"}`} placeholder="Pesquisar" value={search} onChange={event => setSearch(event.target.value)} className="mb-3 max-w-sm" />
    {isLoading ? <p className="py-4 text-sm text-muted-foreground">Carregando…</p> : isError ? <div className="flex flex-wrap items-center gap-3 py-4"><p className="text-sm text-destructive">Não foi possível carregar as localizações.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button></div> : visible.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nenhuma venda encontrada.</p> : <>
      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map(index => <div key={index} aria-hidden="true" className={`flex min-w-0 items-center justify-between gap-3 border-b border-border px-3 py-3 text-xs font-medium text-muted-foreground ${index === 1 ? "hidden sm:flex" : index === 2 ? "hidden xl:flex" : ""}`}><span>{nameLabel}</span><span className="text-right">Valor Total das Vendas</span></div>)}
      </div>
      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map(row => <Button key={row.id} variant="ghost" onClick={() => setSelectedId(row.id)} className="h-auto min-h-14 w-full min-w-0 justify-between gap-3 rounded-none border-b border-border px-3 py-3 text-left font-normal">
          <span className="min-w-0 flex-1 whitespace-normal break-words font-medium">{row.name}</span>
          <span className="flex shrink-0 items-center gap-1 text-right tabular-nums">{money(row.revenue)}<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /></span>
        </Button>)}
      </div>
    </>}
    {!isLoading && !isError && <p className="mt-3 text-xs text-muted-foreground">{locations.length} {field === "bairro" ? "bairros" : "cidades"} · Total não cancelado: {money(total)}</p>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelectedId(null); }}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle className="pr-6 break-words">Vendas — {selected?.name}</DialogTitle><DialogDescription>{filters ? `${format(new Date(`${filters.startDate}T12:00:00`), "dd/MM/yyyy")} a ${format(new Date(`${filters.endDate}T12:00:00`), "dd/MM/yyyy")}` : ""}</DialogDescription></DialogHeader>
        {selected && <>
          <div className="grid grid-cols-1 gap-4 border-b border-border pb-4 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Valor Total das Vendas</p><p className="text-lg font-semibold tabular-nums">{money(selected.revenue)}</p></div>
            <div><p className="text-xs text-muted-foreground">Pedidos</p><p className="text-lg font-semibold">{selected.orders.length}</p></div>
            <div><p className="text-xs text-muted-foreground">Ticket médio</p><p className="text-lg font-semibold tabular-nums">{money(selected.revenue / selected.orders.length)}</p></div>
          </div>
          <div className="min-w-0"><h3 className="mb-3 text-base font-semibold">Produtos vendidos</h3><MarketingReportTable key={`products-${field}-${selected.id}`} rows={products.map(row => ({ id: row.id, label: row.name, quantity: row.quantity, revenue: row.revenue }))} nameLabel="Produto" quantityLabel="Quantidade" revenueLabel="Valor total" totalLabel="Total dos produtos" /></div>
          <div className="min-w-0 border-t border-border pt-4"><h3 className="mb-3 text-base font-semibold">Pedidos</h3><MarketingReportTable key={`orders-${field}-${selected.id}`} rows={selected.orders.map(order => ({ id: order.id, label: order.nome_cliente || "—", detail: `${order.data_criacao ? format(new Date(order.data_criacao), "dd/MM/yyyy HH:mm") : "—"} · #${order.codigo_curto ?? order.id.slice(0, 6)}`, quantity: aggregateLocationProducts([order]).reduce((sum, product) => sum + product.quantity, 0), revenue: Number(order.valor_total ?? 0) }))} nameLabel="Cliente / Pedido" quantityLabel="Itens" revenueLabel="Valor" /></div>
        </>}
      </DialogContent>
    </Dialog>
  </section>;
}