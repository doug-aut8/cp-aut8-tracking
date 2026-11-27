import React, { useEffect, useState } from "react";
import { startOfDay, endOfDay, format } from "date-fns";
import { getVisitMetrics } from "@/services/productEventService";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface Row { kind: string; value: string; sessions: number; orders: number; revenue: number }

const LABELS: Record<string, string> = { mobile: "Celular", tablet: "Tablet", desktop: "Computador", desconhecido: "Sem dado" };
const TITLES: Record<string, string> = { device: "Tipo de aparelho", os: "Sistema", browser: "Navegador" };

const DeviceMetrics: React.FC<{ from: Date; to: Date; source?: string | null; campaign?: string | null; locField?: string | null; locValue?: string | null }> = ({ from, to, source = null, campaign = null, locField = null, locValue = null }) => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [menuVisits, setMenuVisits] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMenuVisits(null);
    getVisitMetrics(format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd"), source, campaign, locField === "cidade" && locValue ? locValue : null)
      .then((v: any) => { if (!cancelled) setMenuVisits(Number(v?.totalVisits ?? 0)); })
      .catch(() => { if (!cancelled) setMenuVisits(null); });
    return () => { cancelled = true; };
  }, [from, to, source, campaign, locField, locValue]);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    (supabase.rpc as any)("mkt_device_breakdown", {
      p_start: startOfDay(from).toISOString(),
      p_end: endOfDay(to).toISOString(),
      p_source: source, p_campaign: campaign, p_loc_field: locValue ? locField : null, p_loc_value: locValue || null,
    }).then(({ data, error }: any) => {
      if (cancelled) return;
      if (error) console.error("device breakdown", error);
      setRows(((data as Row[]) || []).map((r) => ({ ...r, sessions: Number(r.sessions), orders: Number(r.orders), revenue: Number(r.revenue) })));
    });
    return () => { cancelled = true; };
  }, [from, to, source, campaign, locField, locValue]);

  if (!rows) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(["device", "os", "browser"] as const).map((kind) => {
        const list = rows.filter((r) => r.kind === kind).sort((a, b) => b.sessions - a.sessions || b.orders - a.orders);
        const totalSessions = list.reduce((s, r) => s + r.sessions, 0);
        const total = totalSessions || 1;
        const direct = menuVisits != null ? Math.max(totalSessions - menuVisits, 0) : null;
        return (
          <Card key={kind}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">{TITLES[kind]}</p>
              {list.length === 0 && <p className="text-sm text-muted-foreground">Sem dados no período</p>}
              <div className="space-y-3">
                {list.map((r) => {
                  const pct = (r.sessions / total) * 100;
                  const conv = r.sessions ? (r.orders / r.sessions) * 100 : 0;
                  return (
                    <div key={r.value}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{LABELS[r.value] ?? r.value}</span>
                        <span>{r.sessions} sessões ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 rounded bg-muted mt-1">
                        <div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.orders} pedidos · {formatCurrency(r.revenue)} · conversão {conv.toFixed(1).replace(".", ",")}%
                        {r.orders ? ` · ticket ${formatCurrency(r.revenue / r.orders)}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
              {list.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-sm font-semibold">Total: {totalSessions} sessões ativas</p>
                  {menuVisits != null && (
                    <p className="text-xs text-muted-foreground">
                      ({Math.min(menuVisits, totalSessions)} visitas ao cardápio + {direct} acessos diretos/checkout)
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DeviceMetrics;
