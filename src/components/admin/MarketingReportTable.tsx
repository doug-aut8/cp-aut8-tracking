import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export type MarketingTableRow = { id: string; label: string; detail?: string; quantity: number; revenue: number; status?: string; newCustomerPercent?: number | null; predominantProfile?: string | null; classifiedOrders?: number; mediaCost?: number; giftCost?: number; newCustomers?: number; cost?: number; cac?: number | null; roas?: number | null; ltv?: number | null; ltvRevenue?: number; ltvCac?: number | null };
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function MarketingReportTable({ rows, nameLabel, quantityLabel, revenueLabel, loading, campaignColumns = false, totalLabel = "Total não cancelado", onEditCampaign }: {
  rows: MarketingTableRow[]; nameLabel: string; quantityLabel: string; revenueLabel: string; loading?: boolean; totalLabel?: string; campaignColumns?: boolean; onEditCampaign?: (row: MarketingTableRow) => void;
}) {
  const campaignColSpan = 3 + (campaignColumns ? 9 : 0) + (onEditCampaign ? 1 : 0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"original" | "quantity" | "revenue">("original");
  const [ascending, setAscending] = useState(false);
  const filtered = useMemo(() => {
    const result = rows.filter(row => `${row.label} ${row.detail ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
    return sort === "original" ? result : result.sort((a, b) => (ascending ? 1 : -1) * (a[sort] - b[sort]));
  }, [rows, search, sort, ascending]);
  const maxPage = Math.max(0, Math.ceil(filtered.length / 25) - 1);
  const currentPage = Math.min(page, maxPage);
  const applySort = (key: "quantity" | "revenue") => { setAscending(sort === key ? !ascending : false); setSort(key); setPage(0); };
  return <div className="space-y-3 text-foreground">
    <Input aria-label={`Pesquisar ${nameLabel.toLowerCase()}`} placeholder="Pesquisar" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="max-w-sm" />
    <Table>
      <TableHeader><TableRow><TableHead>{nameLabel}</TableHead><TableHead className="text-right"><Button variant="ghost" size="sm" onClick={() => applySort("quantity")}>{quantityLabel}<ArrowUpDown className="ml-2 h-3 w-3" /></Button></TableHead><TableHead className="text-right"><Button variant="ghost" size="sm" onClick={() => applySort("revenue")}>{revenueLabel}<ArrowUpDown className="ml-2 h-3 w-3" /></Button></TableHead>{campaignColumns && <><TableHead className="text-right">Novos Clientes (%)</TableHead><TableHead>Perfil Predominante</TableHead><TableHead className="text-right whitespace-nowrap">Custo de Mídia</TableHead><TableHead className="text-right whitespace-nowrap">Custo Brindes</TableHead><TableHead className="text-right whitespace-nowrap">Custo Total</TableHead><TableHead className="text-right">CAC</TableHead><TableHead className="text-right">ROAS</TableHead><TableHead className="text-right" title="Faturamento médio acumulado até hoje dos novos clientes trazidos pela campanha">LTV</TableHead><TableHead className="text-right">LTV : CAC</TableHead></>}{onEditCampaign && <TableHead className="w-10" />}</TableRow></TableHeader>
      <TableBody>{loading ? <TableRow><TableCell colSpan={campaignColSpan}>Carregando…</TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={campaignColSpan} className="text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow> : filtered.slice(currentPage * 25, (currentPage + 1) * 25).map(row => <TableRow key={row.id} className={row.status === "cancelled" ? "text-muted-foreground" : ""}>
        <TableCell className="min-w-[180px]"><p className="font-medium break-words">{row.label}</p>{row.detail && <p className="text-xs text-muted-foreground">{row.detail}</p>}{row.status === "cancelled" && <p className="text-xs text-destructive">Cancelado · excluído dos totais</p>}</TableCell>
        <TableCell className="text-right tabular-nums">{row.quantity.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{money(row.revenue)}</TableCell>
        {campaignColumns && <><TableCell className="text-right tabular-nums">{row.newCustomerPercent == null ? "—" : `${row.newCustomerPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}{row.classifiedOrders !== row.quantity && <p className="text-xs text-muted-foreground">{row.classifiedOrders ?? 0}/{row.quantity} identificados</p>}</TableCell><TableCell><span className={row.predominantProfile === "Aquisição / CAC" ? "text-food-green text-xs font-medium whitespace-nowrap" : "text-muted-foreground text-xs font-medium whitespace-nowrap"}>{row.predominantProfile ?? "Sem identificação"}</span></TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{money(row.mediaCost ?? 0)}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{money(row.giftCost ?? 0)}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums font-medium">{money(row.cost ?? 0)}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{row.cac != null ? money(row.cac) : "—"}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{row.roas != null ? `${row.roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x` : "—"}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{row.ltv != null ? money(row.ltv) : "—"}{row.ltvRevenue ? <p className="text-xs text-muted-foreground">{money(row.ltvRevenue)} acumulado</p> : null}</TableCell><TableCell className="text-right whitespace-nowrap tabular-nums">{row.ltvCac != null ? `${row.ltvCac.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x` : "—"}</TableCell></>}{onEditCampaign && <TableCell className="w-10"><Button variant="ghost" size="icon" aria-label={`Editar custo de ${row.label}`} onClick={() => onEditCampaign(row)}><Pencil className="h-4 w-4" /></Button></TableCell>}
      </TableRow>)}</TableBody>
    </Table>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{filtered.length} registros · {quantityLabel}: {filtered.filter(row => row.status !== "cancelled").reduce((sum, row) => sum + row.quantity, 0).toLocaleString("pt-BR")} · {totalLabel}: {money(filtered.filter(row => row.status !== "cancelled").reduce((sum, row) => sum + row.revenue, 0))}{filtered.some(row => row.status) && ` · ${filtered.filter(row => row.status !== "cancelled").length} pedidos válidos · ${filtered.filter(row => row.status === "cancelled").length} cancelados`}</span>
      {maxPage > 0 && <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>{currentPage + 1} / {maxPage + 1}</span><Button variant="outline" size="icon" aria-label="Próxima página" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button></div>}
    </div>
  </div>;
}