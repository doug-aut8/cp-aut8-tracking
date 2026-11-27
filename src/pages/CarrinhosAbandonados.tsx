import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { ShoppingCart, MessageCircle } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getAbandonedCartList } from "@/services/productEventService";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const waLink = (phone: string) => {
  let d = phone.replace(/\D/g, "");
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}`;
};

const CarrinhosAbandonados = () => {
  const [start, setStart] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [onlyIdentified, setOnlyIdentified] = useState(false);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["abandoned-cart-list", start, end],
    queryFn: () => getAbandonedCartList(start, end),
  });

  const rows = useMemo(() => (onlyIdentified ? data.filter((r) => r.customerPhone) : data), [data, onlyIdentified]);
  const total = data.reduce((s, r) => s + r.value, 0);
  const identified = data.filter((r) => r.customerPhone).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <AdminPageHeader title="Carrinhos Abandonados" icon={ShoppingCart} />

      <div className="flex flex-wrap items-end justify-center gap-4 mb-6">
        <div><Label htmlFor="ini">De</Label><Input id="ini" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><Label htmlFor="fim">Até</Label><Input id="fim" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <Button variant={onlyIdentified ? "default" : "outline"} onClick={() => setOnlyIdentified((v) => !v)}>
          Só clientes identificados
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Carrinhos abandonados</p><p className="text-2xl font-bold">{data.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Valor potencial perdido</p><p className="text-2xl font-bold text-destructive">{brl(total)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Com cliente identificado</p><p className="text-2xl font-bold">{identified}</p></CardContent></Card>
      </div>

      <p className="text-xs text-muted-foreground mb-4 text-center">
        Cada linha é o último carrinho de uma visita que não terminou em compra. O cliente só aparece quando o mesmo aparelho já fez um pedido antes.
      </p>

      {isLoading ? (
        <p className="text-center text-muted-foreground">Carregando…</p>
      ) : error ? (
        <p className="text-center text-destructive">Não foi possível carregar os carrinhos.</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-muted-foreground">Nenhum carrinho abandonado no período.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.key}>
              <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{format(new Date(r.createdAt), "dd/MM/yyyy HH:mm")}</p>
                  <p className="font-semibold">{r.customerName || "Cliente não identificado"}{r.customerPhone ? ` · ${r.customerPhone}` : ""}</p>
                  <ul className="text-sm mt-1">
                    {r.items.map((i, idx) => (
                      <li key={idx}>{i.quantity}x {i.name}{i.price ? ` — ${brl(i.price)}` : ""}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                  <span className="text-lg font-bold text-destructive">{brl(r.value)}</span>
                  {r.customerPhone && (
                    <Button asChild size="sm" className="gap-1">
                      <a href={waLink(r.customerPhone)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp</a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CarrinhosAbandonados;
