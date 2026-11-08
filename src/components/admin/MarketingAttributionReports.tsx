import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchSalesBySource, fetchSalesByCampaign, fetchSalesByMedium, fetchSalesByContent, fetchSalesByTerm } from "@/services/salesAnalyticsService";
import { fetchCampaignInvestments, fetchInvestmentsByCampaign, saveCampaignInvestment, deleteCampaignInvestment, fetchCampaignGiftCosts, CampaignInvestment } from "@/services/campaignInvestmentService";
import { campaignCostMetrics, DEFAULT_INCLUDE_CAMPAIGN_GIFTS } from "@/services/campaignInvestmentCalculation";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MarketingReportTable, MarketingTableRow } from "./MarketingReportTable";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function CampaignInvestmentModal({ campaign, periodStart, periodEnd, open, onClose }: {
  campaign: string; periodStart: string; periodEnd: string; open: boolean; onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dataInicio, setDataInicio] = useState(periodStart);
  const [dataFim, setDataFim] = useState(periodEnd);
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);
  const mediaCost = Number(valor.replace(",", "."));

  const investments = useQuery({
    queryKey: ["campaign-investments", campaign],
    enabled: open,
    queryFn: () => fetchInvestmentsByCampaign(campaign),
  });

  useEffect(() => {
    if (open) {
      setDataInicio(periodStart);
      setDataFim(periodEnd);
      setValor("");
    }
  }, [open, periodStart, periodEnd]);

  const handleSave = async () => {
    const valorNumerico = mediaCost;
    if (!dataInicio || !dataFim) {
      toast({ title: "Informe o período do investimento.", variant: "destructive" });
      return;
    }
    if (dataFim < dataInicio) {
      toast({ title: "A data final deve ser igual ou posterior à data inicial.", variant: "destructive" });
      return;
    }
    if (!isFinite(mediaCost) || mediaCost < 0 || !isFinite(valorNumerico) || valorNumerico <= 0) {
      toast({ title: "Informe um valor investido maior que zero.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveCampaignInvestment({ utm_campaign: campaign, data_inicio: dataInicio, data_fim: dataFim, valor_investido: valorNumerico });
      toast({ title: "Investimento salvo.", description: `${campaign} · ${formatDate(dataInicio)} a ${formatDate(dataFim)} · ${money(valorNumerico)}` });
      await queryClient.invalidateQueries({ queryKey: ["campaign-investments"] });
      await queryClient.invalidateQueries({ queryKey: ["marketing-attribution"] });
      setValor("");
    } catch (err: any) {
      toast({ title: "Não foi possível salvar o investimento.", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCampaignInvestment(id);
      await queryClient.invalidateQueries({ queryKey: ["campaign-investments"] });
      await queryClient.invalidateQueries({ queryKey: ["marketing-attribution"] });
    } catch (err: any) {
      toast({ title: "Não foi possível remover o investimento.", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custo da campanha</DialogTitle>
          <DialogDescription className="break-words">{campaign}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-inicio">Início</Label>
              <Input id="inv-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-fim">Fim</Label>
              <Input id="inv-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-valor">Custo de Mídia (R$)</Label>
            <Input id="inv-valor" type="number" min="0" step="0.01" inputMode="decimal" placeholder="200,00" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Salvando…" : "Salvar investimento"}</Button>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Investimentos cadastrados</p>
            {investments.isLoading ? (
              <p className="text-xs text-muted-foreground">Carregando…</p>
            ) : (investments.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum investimento cadastrado para esta campanha.</p>
            ) : (
              <ul className="space-y-1.5">
                {(investments.data ?? []).map((inv: CampaignInvestment) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                    <span>{formatDate(inv.data_inicio)} a {formatDate(inv.data_fim)}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums font-medium">{money(inv.valor_investido)}</span>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => handleDelete(inv.id)}>Remover</Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MarketingAttributionReports({ start, end }: { start: string; end: string }) {
  const [dimension, setDimension] = useState("source");
  const [editingCampaign, setEditingCampaign] = useState<string | null>(null);
  const [includeGifts, setIncludeGifts] = useState(DEFAULT_INCLUDE_CAMPAIGN_GIFTS);
  const { isAdmin } = useUserRole();

  const report = useQuery<MarketingTableRow[]>({ queryKey: ["marketing-attribution", start, end, dimension], staleTime: 60_000, queryFn: async () => {
    switch (dimension) {
      case "campaign": {
        const [rows, investments] = await Promise.all([fetchSalesByCampaign(start, end), fetchCampaignInvestments(start, end)]);
        const costByCampaign = new Map<string, number>();
        investments.forEach((inv) => costByCampaign.set(inv.utm_campaign, (costByCampaign.get(inv.utm_campaign) ?? 0) + inv.valor_investido));
        return rows.map((row): MarketingTableRow => {
          const cost = costByCampaign.get(row.campaign) ?? 0;
          return {
            id: row.campaign,
            label: row.campaign,
            quantity: row.orders,
            revenue: row.revenue,
            newCustomerPercent: row.newCustomerPercent,
            predominantProfile: row.predominantProfile,
            classifiedOrders: row.classifiedOrders,
            cost,
            mediaCost: cost,
            newCustomers: row.newCustomers,
            ltv: row.avgLtv,
            ltvRevenue: row.ltvRevenue,
          };
        });
      }
      case "medium": return (await fetchSalesByMedium(start, end)).map(row => ({ id: row.medium, label: row.medium, quantity: row.orders, revenue: row.revenue }));
      case "content": return (await fetchSalesByContent(start, end)).map(row => ({ id: row.content, label: row.content, quantity: row.orders, revenue: row.revenue }));
      case "term": return (await fetchSalesByTerm(start, end)).map(row => ({ id: row.term, label: row.term, quantity: row.orders, revenue: row.revenue }));
      default: return (await fetchSalesBySource(start, end)).map(row => ({ id: row.source, label: row.source === "(direto)" ? "Sem origem UTM registrada" : row.source, quantity: row.orders, revenue: row.revenue }));
    }
  } });
  const campaigns = (report.data ?? []).map(row => row.id);
  const gifts = useQuery({
    queryKey: ["campaign-gift-costs", start, end, campaigns],
    enabled: dimension === "campaign" && includeGifts && report.isSuccess && campaigns.length > 0,
    staleTime: 60_000,
    queryFn: () => fetchCampaignGiftCosts(start, end, campaigns),
  });
  const needsGifts = dimension === "campaign" && includeGifts && campaigns.length > 0;
  const rows = dimension === "campaign" ? (report.data ?? []).map(row => ({
    ...row,
    ...campaignCostMetrics(row.mediaCost ?? 0, gifts.data?.[row.id] ?? 0, includeGifts, row.revenue, row.newCustomers ?? 0, row.ltv ?? null),
  })) : report.data ?? [];
  return <section className="mt-8 space-y-4 border-t border-border pt-6">
    <div><h2 className="text-lg font-semibold">Atribuição das vendas · Pedidos</h2><p className="mt-1 text-xs text-muted-foreground">Até 10 maiores resultados por receita do período completo · busca e ordenação somente neste grupo · sem pedidos cancelados · independente dos filtros acima. Dimensões sem identificação UTM não aparecem, exceto em Origens.</p></div>
    <Tabs value={dimension} onValueChange={setDimension}><TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="source">Origens</TabsTrigger><TabsTrigger value="campaign">Campanhas</TabsTrigger><TabsTrigger value="medium">Meios</TabsTrigger><TabsTrigger value="content">Conteúdos</TabsTrigger><TabsTrigger value="term">Termos</TabsTrigger></TabsList></Tabs>
    {dimension === "campaign" && <div className="flex items-center gap-3"><Switch id="campaign-brindes" checked={includeGifts} onCheckedChange={setIncludeGifts} /><Label htmlFor="campaign-brindes">Inserir custos de brindes</Label></div>}
    {report.isError || (needsGifts && gifts.isError) ? <div className="flex items-center gap-3 text-sm"><p>{report.isError ? "Não foi possível carregar a atribuição das vendas." : "Não foi possível calcular os custos de brindes."}</p><Button variant="outline" onClick={() => { if (report.isError) void report.refetch(); if (needsGifts && gifts.isError) void gifts.refetch(); }}>Tentar novamente</Button></div> : <MarketingReportTable key={dimension} rows={rows} loading={report.isLoading || (needsGifts && gifts.isPending)} campaignColumns={dimension === "campaign"} nameLabel="Identificação UTM" quantityLabel="Pedidos" revenueLabel="Receita" onEditCampaign={dimension === "campaign" && isAdmin ? (row) => setEditingCampaign(row.id) : undefined} />}
    {editingCampaign && <CampaignInvestmentModal campaign={editingCampaign} periodStart={start} periodEnd={end} open onClose={() => setEditingCampaign(null)} />}
  </section>;
}
