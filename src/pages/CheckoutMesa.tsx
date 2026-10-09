import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { createOrder } from "@/services/orderService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Minus, Plus, Trash2 } from "lucide-react";
import { getOrderItemDisplayName } from "@/utils/orderItemDisplay";
import TableBadge from "@/components/TableBadge";
import {
  getStoredTable, getStoredTableCustomer, setStoredTableCustomer, clearStoredTableCustomer,
  hasOpenTableOrder, useTableSettings,
} from "@/hooks/useTableSettings";

const maskBirthday = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
const isValidBirthday = (v: string) => {
  const m = /^(\d{2})\/(\d{2})$/.exec(v);
  if (!m) return false;
  const day = +m[1], month = +m[2];
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return month >= 1 && month <= 12 && day >= 1 && day <= (max ?? 0);
};

const CheckoutMesa = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cartItems, finalTotal, increaseQuantity, decreaseQuantity, removeFromCart, clearCart } = useCart();
  const { settings } = useTableSettings();
  const [mesa] = useState<string | null>(getStoredTable());
  const initial = (() => {
    const s = getStoredTableCustomer();
    return s && s.mesa === mesa ? s : null;
  })();
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [birth, setBirth] = useState(initial?.birthday ?? "");
  const [submitted, setSubmitted] = useState(!!initial?.submitted);
  const [obs, setObs] = useState("");
  const [payment, setPayment] = useState<"pix_mesa" | "cobranca_mesa" | "">("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const methods = [
    settings.mesas_pix_ativo && { id: "pix_mesa", label: "Receber por PIX" },
    settings.mesas_cobranca_ativo && { id: "cobranca_mesa", label: "Cobrança na Mesa" },
  ].filter(Boolean) as { id: "pix_mesa" | "cobranca_mesa"; label: string }[];
  const selectedPayment = payment || methods[0]?.id || "";

  // Se a mesa foi fechada pelo admin (concluído/cancelado + pago), limpa os dados para o próximo cliente.
  useEffect(() => {
    if (!mesa || !initial?.submitted || !initial.phone) return;
    hasOpenTableOrder(mesa, initial.phone).then((open) => {
      if (!open) {
        clearStoredTableCustomer();
        setName(""); setPhone(""); setBirth(""); setSubmitted(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persiste os dados enquanto o cliente digita.
  useEffect(() => {
    if (!mesa) return;
    setStoredTableCustomer({ mesa, name, phone, birthday: birth, submitted });
  }, [mesa, name, phone, birth, submitted]);

  const submit = async () => {
    if (!mesa) return toast({ title: "Informe sua mesa", variant: "destructive" });
    if (name.trim().length < 2) return toast({ title: "Informe seu nome", variant: "destructive" });
    if (phone.replace(/\D/g, "").length < 10) return toast({ title: "Informe um WhatsApp válido", variant: "destructive" });
    if (birth && !isValidBirthday(birth)) return toast({ title: "Aniversário inválido", description: "Use dia/mês, ex.: 25/12", variant: "destructive" });
    if (!selectedPayment) return toast({ title: "Nenhuma forma de pagamento disponível", variant: "destructive" });
    setSending(true);
    try {
      const order = await createOrder({
        customerName: name.trim(),
        customerPhone: phone,
        address: `Consumo no Local - Mesa ${mesa}`,
        paymentMethod: selectedPayment,
        observations: obs,
        items: cartItems.map((i) => ({
          menuItemId: i.id, name: i.name, price: i.price, quantity: i.quantity,
          selectedVariations: i.selectedVariations || [], selectedBorder: i.selectedBorder || null,
          selectedSize: i.selectedSize || null, itemObservation: i.itemObservation,
          priceFrom: i.priceFrom || false, isHalfPizza: i.isHalfPizza || false, combination: i.combination || null,
          category: (i as any).category,
        } as any)),
        total: finalTotal,
        frete: 0,
        origem: "salao",
        mesa,
        aniversario: birth || null,
      });
      setSubmitted(true);
      clearCart();
      setObs("");
      setDone(order.id.substring(0, 6));
    } catch (e: any) {
      toast({ title: "Erro ao enviar pedido", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-primary" />
        <h1 className="text-2xl font-bold">Pedido enviado!</h1>
        <p className="text-muted-foreground">Pedido #{done} para a Mesa {mesa}. Já estamos preparando.</p>
        {selectedPayment === "pix_mesa" && settings.mesas_pix_chave && (
          <Card className="w-full max-w-sm"><CardContent className="pt-4 text-sm">
            <p className="font-semibold">Chave PIX</p>
            <p className="break-all select-all">{settings.mesas_pix_chave}</p>
          </CardContent></Card>
        )}
        {settings.mesas_mensagem && <p className="text-sm max-w-sm">{settings.mesas_mensagem}</p>}
        <Button size="lg" onClick={() => navigate("/cardapio-qr")}>Pedir mais itens</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <TableBadge mesa={mesa} />
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/cardapio-qr")}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao cardápio</Button>

        <Card>
          <CardHeader><CardTitle className="text-lg">Seu pedido</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cartItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>}
            {cartItems.map((i) => (
              <div key={i.id} className="flex items-center gap-2 border-b pb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{getOrderItemDisplayName(i as any)}</p>
                  {i.itemObservation && <p className="text-xs text-muted-foreground">Obs: {i.itemObservation}</p>}
                </div>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => decreaseQuantity(i.id)}><Minus className="h-3 w-3" /></Button>
                <span className="w-5 text-center text-sm">{i.quantity}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => increaseQuantity(i.id)}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFromCart(i.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(finalTotal)}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Seus dados</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>WhatsApp</Label><Input inputMode="tel" placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Aniversário (opcional)</Label><Input inputMode="numeric" placeholder="DD/MM" maxLength={5} value={birth} onChange={(e) => setBirth(maskBirthday(e.target.value))} /></div>
            <div><Label>Observações do pedido</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Pagamento</CardTitle></CardHeader>
          <CardContent>
            {methods.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chame um garçom para pagar.</p>
            ) : (
              <RadioGroup value={selectedPayment} onValueChange={(v) => setPayment(v as any)} className="space-y-2">
                {methods.map((m) => (
                  <Label key={m.id} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer">
                    <RadioGroupItem value={m.id} /> {m.label}
                  </Label>
                ))}
              </RadioGroup>
            )}
          </CardContent>
        </Card>

        <Button className="w-full h-12 text-base" disabled={sending || cartItems.length === 0} onClick={submit}>
          {sending ? "Enviando..." : `Enviar pedido • ${formatCurrency(finalTotal)}`}
        </Button>
      </div>
    </div>
  );
};

export default CheckoutMesa;
