import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, format, startOfDay } from "date-fns";
import { Download, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchCustomerLtv } from "@/services/customerLtvService";
import { invalidateQueryCache } from "@/services/queryCache";
import { customerLtvCsv, customerStatusLabels, filterCustomerLtv, summarizeCustomerLtv, type CustomerLtvFilters } from "@/services/customerLtvAggregation";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percent = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const phoneLabel = (phone: string) => phone.length === 11 ? phone.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")
  : phone.length === 10 ? phone.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3") : phone;
const PAGE_SIZE = 25;

export function CustomerLtvReport({ from, to }: { from?: Date; to?: Date }) {
  const { data, isPending, isFetching, isError, refetch } = useQuery({ queryKey: ["customer-ltv"], queryFn: fetchCustomerLtv, staleTime: 5 * 60_000 });
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [status, setStatus] = useState<CustomerLtvFilters["status"]>("all");
  const [sort, setSort] = useState<CustomerLtvFilters["sort"]>("ltv");
  const [allHistory, setAllHistory] = useState(false);
  const [page, setPage] = useState(0);
  const customers = data?.customers ?? [];
  const sources = [...new Set(customers.map(row => row.source))].sort();
  const campaigns = [...new Set(customers.map(row => row.campaign))].sort();
  const rows = useMemo(() => filterCustomerLtv(data?.customers ?? [], {
    search, source: source === "all" ? undefined : source, campaign: campaign === "all" ? undefined : campaign,
    status, sort, start: allHistory || !from ? undefined : startOfDay(from), end: allHistory || !to ? undefined : endOfDay(to),
  }), [data, search, source, campaign, status, sort, allHistory, from, to]);
  const summary = summarizeCustomerLtv(rows);
  // Changing any filter presents the first page without an intermediate stale page.
  const filterKey = JSON.stringify([search, source, campaign, status, sort, allHistory, from, to]);
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  if (previousFilterKey !== filterKey) { setPreviousFilterKey(filterKey); setPage(0); }
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const refresh = () => { invalidateQueryCache("customer-ltv|"); void refetch(); };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([customerLtvCsv(rows)], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `clientes-ltv-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const health = (count: number) => `${count} · ${percent(summary.total ? count / summary.total * 100 : 0)}`;
  const metrics = [
    { label: "LTV médio", value: money(summary.avgLtv) },
    { label: "Clientes únicos", value: String(summary.total) },
    { label: "Taxa de recompra", value: percent(summary.repeatRate) },
    { label: "Ativos · até 30 dias", value: health(summary.active) },
    { label: "Em risco · 31–60 dias", value: health(summary.risk) },
    { label: "Inativos · mais de 60 dias", value: health(summary.inactive) },
  ];
  return <section className="min-w-0 space-y-6" aria-label="Clientes e LTV">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-semibold">Clientes & LTV</h2>
        <p className="mt-1 text-xs text-muted-foreground">Aquisição: primeira compra no histórico disponível. LTV acumulado até hoje, incluindo compras posteriores de outras campanhas. Pedidos cancelados excluídos.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={refresh} disabled={isFetching} aria-label="Atualizar clientes" title="Atualizar clientes"><RefreshCw className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={exportCsv} disabled={isPending || isError || !rows.length}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
      </div>
    </div>
    <div className="flex items-center gap-2"><Checkbox id="ltv-all-history" checked={allHistory} onCheckedChange={value => setAllHistory(value === true)} />
      <label htmlFor="ltv-all-history" className="text-sm">Todo o histórico de aquisição</label>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map(metric => <Card key={metric.label} className="min-w-0 bg-card text-card-foreground"><CardContent className="p-4"><p className="min-h-8 text-xs text-muted-foreground">{metric.label}</p><p className="mt-2 break-words text-lg font-semibold tabular-nums">{isPending ? "…" : isError ? "—" : metric.value}</p></CardContent></Card>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar cliente por nome ou telefone" placeholder="Nome ou telefone" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div>
      <Select value={source} onValueChange={setSource}><SelectTrigger aria-label="Origem de aquisição"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as origens de aquisição</SelectItem>{sources.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
      <Select value={campaign} onValueChange={setCampaign}><SelectTrigger aria-label="Campanha de aquisição"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as campanhas de aquisição</SelectItem>{campaigns.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={value => setStatus(value as CustomerLtvFilters["status"])}><SelectTrigger aria-label="Status do cliente"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="active">Ativos</SelectItem><SelectItem value="risk">Em risco</SelectItem><SelectItem value="inactive">Inativos</SelectItem></SelectContent></Select>
      <Select value={sort} onValueChange={value => setSort(value as CustomerLtvFilters["sort"])}><SelectTrigger aria-label="Ordenar clientes"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ltv">Maior LTV</SelectItem><SelectItem value="orders">Mais pedidos</SelectItem><SelectItem value="recent">Compra mais recente</SelectItem><SelectItem value="oldest">Há mais tempo sem comprar</SelectItem></SelectContent></Select>
    </div>
    {isError ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">Não foi possível carregar os clientes.<Button variant="outline" onClick={refresh}>Tentar novamente</Button></div> :
      <><div className="overflow-x-auto border-y border-border"><Table className="min-w-[1100px]"><TableHeader><TableRow>
        {["Cliente / Telefone", "Origem / Campanha de aquisição", "Primeira compra", "Pedidos", "LTV acumulado", "Ticket médio", "Última compra", "Status"].map(label => <TableHead key={label}>{label}</TableHead>)}
      </TableRow></TableHeader><TableBody>
        {isPending || !rows.length ? <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">{isPending ? "Carregando clientes…" : "Nenhum cliente encontrado para estes filtros."}</TableCell></TableRow> : visible.map(row => <TableRow key={row.phone}>
          <TableCell><span className="block max-w-56 truncate font-medium" title={row.name}>{row.name}</span><span className="text-xs text-muted-foreground">{phoneLabel(row.phone)}</span></TableCell>
          <TableCell><span className="block max-w-48 truncate" title={row.source}>{row.source}</span><span className="block max-w-48 truncate text-xs text-muted-foreground" title={row.campaign}>{row.campaign}</span></TableCell>
          <TableCell className="whitespace-nowrap">{format(new Date(row.acquiredAt), "dd/MM/yyyy")}</TableCell>
          <TableCell className="tabular-nums">{row.orders}</TableCell><TableCell className="whitespace-nowrap font-semibold tabular-nums">{money(row.ltv)}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{money(row.avgTicket)}</TableCell>
          <TableCell className="whitespace-nowrap">{format(new Date(row.lastOrderAt), "dd/MM/yyyy")}<span className="block text-xs text-muted-foreground">há {row.daysSinceLastOrder} dias</span></TableCell>
          <TableCell><Badge variant="outline" className={row.status === "active" ? "border-food-green text-food-green" : row.status === "inactive" ? "border-destructive text-destructive" : "border-primary text-primary"}>{customerStatusLabels[row.status]}</Badge></TableCell>
        </TableRow>)}
      </TableBody></Table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{rows.length} clientes · Página {currentPage + 1} de {pageCount}</span><div className="flex gap-2"><Button variant="outline" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>Anterior</Button><Button variant="outline" onClick={() => setPage(currentPage + 1)} disabled={currentPage + 1 >= pageCount}>Próxima</Button></div></div></>}
    {!!data?.unidentifiedOrders && <p className="text-xs text-muted-foreground">{data.unidentifiedOrders} pedidos sem telefone não entram no cálculo por cliente. Origem ou campanha ausente é exibida como “Não informada”.</p>}
  </section>;
}