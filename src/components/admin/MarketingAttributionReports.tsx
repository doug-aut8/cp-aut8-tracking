import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchSalesBySource, fetchSalesByCampaign, fetchSalesByMedium, fetchSalesByContent, fetchSalesByTerm } from "@/services/salesAnalyticsService";
import { fetchCampaignInvestments, fetchInvestmentsByCampaign, saveCampaignInvestment, deleteCampaignInvestment, fetchCampaignGiftCost, CampaignInvestment } from "@/services/campaignInvestmentService";
import { campaignInvestmentTotal } from "@/services/campaignInvestmentCalculation";
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
  const [includeGifts, setIncludeGifts] = useState(true);
  const validPeriod = Boolean(dataInicio && dataFim && dataFim >= dataInicio);
  const gifts = useQuery({
    queryKey: ["campaign-gift-cost", campaign, dataInicio, dataFim],
    enabled: open && includeGifts && validPeriod,
    queryFn: () => fetchCampaignGiftCost(dataInicio, dataFim, campaign),
    staleTime: 0,
  });
  const mediaCost = Number(valor.replace(",", "."));
  const totalCost = campaignInvestmentTotal(mediaCost, gifts.data ?? 0, includeGifts);
  const giftsReady = !includeGifts || (validPeriod && gifts.isSuccess && !gifts.isFetching);

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
      setIncludeGifts(true);
    }
  }, [open, periodStart, periodEnd]);

  const handleSave = async () => {
    const valorNumerico = totalCost;
    if (!dataInicio || !dataFim) {
      toast({ title: "Informe o período do investimento.", variant: "destructive" });
      return;
    }
    if (dataFim < dataInicio) {
      toast({ title: "A data final deve ser igual ou posterior à data inicial.", variant: "destructive" });
      return;
    }
    if (!giftsReady) {
      toast({ title: "Aguarde o cálculo dos brindes ou tente novamente.", variant: "destructive" });
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
      setIncludeGifts(true);
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
            <Label htmlFor="inv-valor">Valor investido (R$)</Label>
            <Input id="inv-valor" type="number" min="0" step="0.01" inputMode="decimal" placeholder="200,00" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="inv-brindes">Inserir custos de brindes</Label>
            <Switch id="inv-brindes" checked={includeGifts} onCheckedChange={setIncludeGifts} disabled={saving} />
          </div>
          {includeGifts && (
            <div className="space-y-2">
              <Label htmlFor="inv-custo-brindes">Custo dos produtos dados como brinde (R$)</Label>
              <Input id="inv-custo-brindes" readOnly value={!validPeriod ? "Período inválido" : gifts.isFetching || gifts.isPending ? "Calculando…" : gifts.isError ? "Cálculo indisponível" : money(gifts.data ?? 0)} />
              {gifts.isError && <div className="flex items-center justify-between gap-2 text-sm"><p className="text-destructive">Não foi possível consultar os brindes.</p><Button variant="outline" size="sm" onClick={() => gifts.refetch()}>Tentar novamente</Button></div>}
              {giftsReady && <div className="flex items-center justify-between gap-2 text-sm font-semibold"><span>Total do investimento</span><span className="tabular-nums">{money(totalCost)}</span></div>}
            </div>
          )}
          <Button onClick={handleSave} disabled={saving || !giftsReady} className="w-full">{saving ? "Salvando…" : "Salvar investimento"}</Button>
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
  const { isAdmin } = useUserRole();

  const report = useQuery({ queryKey: ["marketing-attribution", start, end, dimension], staleTime: 60_000, queryFn: async () => {
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
            cac: cost > 0 && row.newCustomers > 0 ? cost / row.newCustomers : null,
            roas: cost > 0 ? row.revenue / cost : null,
            ltv: row.avgLtv,
            ltvRevenue: row.ltvRevenue,
            ltvCac: cost > 0 && row.newCustomers > 0 && row.avgLtv != null ? row.avgLtv / (cost / row.newCustomers) : null,
          };
        });
      }
      case "medium": return (await fetchSalesByMedium(start, end)).map(row => ({ id: row.medium, label: row.medium, quantity: row.orders, revenue: row.revenue }));
      case "content": return (await fetchSalesByContent(start, end)).map(row => ({ id: row.content, label: row.content, quantity: row.orders, revenue: row.revenue }));
      case "term": return (await fetchSalesByTerm(start, end)).map(row => ({ id: row.term, label: row.term, quantity: row.orders, revenue: row.revenue }));
      default: return (await fetchSalesBySource(start, end)).map(row => ({ id: row.source, label: row.source === "(direto)" ? "Sem origem UTM registrada" : row.source, quantity: row.orders, revenue: row.revenue }));
    }
  } });
  return <section className="mt-8 space-y-4 border-t border-border pt-6">
    <div><h2 className="text-lg font-semibold">Atribuição das vendas · Pedidos</h2><p className="mt-1 text-xs text-muted-foreground">Até 10 maiores resultados por receita do período completo · busca e ordenação somente neste grupo · sem pedidos cancelados · independente dos filtros acima. Dimensões sem identificação UTM não aparecem, exceto em Origens.</p></div>
    <Tabs value={dimension} onValueChange={setDimension}><TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="source">Origens</TabsTrigger><TabsTrigger value="campaign">Campanhas</TabsTrigger><TabsTrigger value="medium">Meios</TabsTrigger><TabsTrigger value="content">Conteúdos</TabsTrigger><TabsTrigger value="term">Termos</TabsTrigger></TabsList></Tabs>
    {report.isError ? <div className="flex items-center gap-3 text-sm"><p>Não foi possível carregar a atribuição das vendas.</p><Button variant="outline" onClick={() => report.refetch()}>Tentar novamente</Button></div> : <MarketingReportTable key={dimension} rows={report.data ?? []} loading={report.isLoading} campaignColumns={dimension === "campaign"} nameLabel="Identificação UTM" quantityLabel="Pedidos" revenueLabel="Receita" onEditCampaign={dimension === "campaign" && isAdmin ? (row) => setEditingCampaign(row.id) : undefined} />}
    {editingCampaign && <CampaignInvestmentModal campaign={editingCampaign} periodStart={start} periodEnd={end} open onClose={() => setEditingCampaign(null)} />}
  </section>;
}
