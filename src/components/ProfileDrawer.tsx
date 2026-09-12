import React, { useEffect, useState } from "react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, UserCog, Gift, Package, RotateCcw, TicketPercent, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/services/profileService";
import { getAllMenuItems } from "@/services/menuItemService";
import { fetchAddressByCep } from "@/services/cepService";
import { getRegrasAtivas, FidelidadeRegra, getRecompensasCliente, FidelidadeRecompensa } from "@/services/fidelidadeService";
import { phoneVariants, phoneDigitsBr } from "@/utils/phoneUtils";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { Order } from "@/types/order";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MenuItem } from "@/types/menu";
import { getFirstPurchaseCouponBlockMessage, validateFirstPurchaseCoupon } from "@/services/couponEligibilityService";

interface ProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRewardsCountChange?: (count: number) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  delivering: "bg-purple-100 text-purple-800",
  delivered: "bg-gray-100 text-gray-800",
  completed: "bg-emerald-100 text-emerald-800",
  received: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  pending: "Recebido",
  confirmed: "Confirmado",
  preparing: "Em produção",
  ready: "Pronto",
  delivering: "Em entrega",
  delivered: "Entregue",
  completed: "Concluído",
  received: "Recebido",
  cancelled: "Cancelado",
};

const mapRow = (row: any): Order => ({
  id: row.id,
  customerName: row.nome_cliente ?? "",
  customerPhone: row.telefone_cliente ?? "",
  address: row.endereco_entrega ?? "",
  paymentMethod: row.metodo_pagamento ?? "cash",
  observations: row.observacoes ?? "",
  items: Array.isArray(row.itens) ? row.itens : [],
  status: row.status_atual ?? "pending",
  total: Number(row.valor_total ?? 0),
  frete: row.frete != null ? Number(row.frete) : undefined,
  subtotal: row.subtotal != null ? Number(row.subtotal) : undefined,
  createdAt: row.criado_em ?? new Date().toISOString(),
  updatedAt: row.atualizado_em ?? new Date().toISOString(),
}) as Order;

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ open, onOpenChange, onRewardsCountChange }) => {
  const { currentUser, logOut } = useAuth();
  const navigate = useNavigate();
  const { addItem, setIsCartOpen, setAppliedCoupon } = useCart();

  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string>("");
  const [regra, setRegra] = useState<FidelidadeRegra | null>(null);
  const [progressoAtual, setProgressoAtual] = useState<number>(0);
  const [menuMap, setMenuMap] = useState<Map<string, MenuItem>>(new Map());
  const [rewards, setRewards] = useState<FidelidadeRecompensa[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
  });
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const openEdit = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from("users")
      .select("name, email, phone, cep, rua, numero, complemento, bairro, cidade")
      .eq("id", currentUser.id)
      .maybeSingle();
    setEditForm({
      name: data?.name || profileName || "",
      email: data?.email || currentUser.email || "",
      phone: data?.phone || "",
      cep: (data as any)?.cep || "",
      rua: (data as any)?.rua || "",
      numero: (data as any)?.numero || "",
      complemento: (data as any)?.complemento || "",
      bairro: (data as any)?.bairro || "",
      cidade: (data as any)?.cidade || "",
    });
    setEditOpen(true);
  };

  const handleCepChange = async (value: string) => {
    const masked = value.replace(/\D/g, "").slice(0, 8);
    setEditForm((f) => ({ ...f, cep: masked }));
    if (masked.length === 8) {
      setCepLoading(true);
      try {
        const info = await fetchAddressByCep(masked);
        if (info) {
          setEditForm((f) => ({
            ...f,
            rua: info.street || f.rua,
            bairro: info.neighborhood || f.bairro,
            cidade: info.city || f.cidade,
          }));
        }
      } catch (e: any) {
        toast({ title: "CEP não encontrado", description: e.message, variant: "destructive" });
      } finally {
        setCepLoading(false);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!currentUser) return;
    if (!editForm.numero.trim()) {
      toast({ title: "Número é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const emailKey = (currentUser.email || editForm.email || "").toLowerCase();
      if (!emailKey) {
        toast({ title: "Email não encontrado", variant: "destructive" });
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("users")
        .update({
          name: editForm.name || null,
          phone: phoneDigitsBr(editForm.phone) || null,
          cep: editForm.cep || null,
          rua: editForm.rua || null,
          numero: editForm.numero || null,
          complemento: editForm.complemento || null,
          bairro: editForm.bairro || null,
          cidade: editForm.cidade || null,
          firebase_id: currentUser.id,
        })
        .or(`id.eq.${currentUser.id},firebase_id.eq.${currentUser.id},email.ilike.${emailKey}`);
      if (error) throw error;


      // Também atualiza profiles (usado em outras telas)
      await supabase
        .from("profiles")
        .update({
          name: editForm.name || null,
          phone: phoneDigitsBr(editForm.phone) || null,
        })
        .eq("id", currentUser.id);

      setProfileName(editForm.name);
      toast({ title: "Dados atualizados com sucesso!" });
      setEditOpen(false);
    } catch (e: any) {
      toast({
        title: "Erro ao atualizar dados",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!open || !currentUser) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [profile, menuItems, regras] = await Promise.all([
          getProfile(currentUser.id).catch(() => null),
          getAllMenuItems().catch(() => []),
          getRegrasAtivas().catch(() => []),
        ]);

        if (cancelled) return;
        setProfileName(profile?.name || currentUser.displayName || "");
        setMenuMap(new Map(menuItems.map((m: MenuItem) => [m.id, m] as [string, MenuItem])));

        const phone = profile?.phone || currentUser.phoneNumber || null;
        const variants = phone ? phoneVariants(phone) : [];

        // Recompensas de fidelidade (cupons-prêmio) do cliente
        try {
          const recompensas = await getRecompensasCliente(variants.length ? variants : phone ? [phone] : []);
          if (!cancelled) {
            setRewards(recompensas);
            onRewardsCountChange?.(recompensas.length);
          }
        } catch (e) {
          console.error("Erro ao carregar recompensas:", e);
        }

        let q = supabase
          .from("pedidos_sabor_delivery")
          .select("*")
          .order("criado_em", { ascending: false })
          .limit(20);

        if (variants.length > 0) {
          q = q.or(
            `user_id.eq.${currentUser.id},telefone_cliente.in.(${variants
              .slice(0, 30)
              .map((v) => `"${v}"`)
              .join(",")})`
          );
        } else {
          q = q.eq("user_id", currentUser.id);
        }

        const { data } = await q;
        const all = (data ?? []).map(mapRow);
        const active = all.filter((o) => !["delivered", "completed", "cancelled"].includes(o.status));
        const past = all
          .filter((o) => ["delivered", "completed", "received"].includes(o.status))
          .slice(0, 5);
        if (!cancelled) {
          setActiveOrders(active);
          setOrders(past);
        }

        // Loyalty: usa a primeira regra ativa e conta pedidos concluídos
        if (regras.length > 0) {
          const r = regras[0];
          setRegra(r);
          // Lê o progresso persistido (que é zerado ao conceder a recompensa),
          // em vez de recomputar sobre todo o histórico.
          let count = 0;
          try {
            const phones = variants.length ? variants : phone ? [phone] : [];
            if (phones.length) {
              const { data: prog } = await (supabase.from("fidelidade_progresso") as any)
                .select("contagem_pizzas")
                .eq("regra_id", r.id)
                .in("telefone_cliente", phones)
                .order("ultima_atualizacao", { ascending: false })
                .limit(1);
              count = Number(prog?.[0]?.contagem_pizzas ?? 0) || 0;
            }
          } catch (e) {
            console.error("Erro ao carregar progresso de fidelidade:", e);
          }
          if (!cancelled) setProgressoAtual(count);
        } else {
          setRegra(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, currentUser]);

  const handleRepetir = (order: Order) => {
    let added = 0;
    for (const it of order.items || []) {
      const anyIt = it as any;
      const isHalf = !!anyIt.isHalfPizza;
      const combination = anyIt.combination || null;
      // Para pizza meio a meio, tenta localizar o item base por qualquer um dos sabores
      const mi =
        menuMap.get(it.menuItemId) ||
        (isHalf && combination
          ? menuMap.get(combination?.sabor1?.id) || menuMap.get(combination?.sabor2?.id)
          : undefined);
      if (!mi) continue;
      const selectedBorder = (it as any).selectedBorder
        ? mi.pizzaBorders?.find((b: any) => b.id === (it as any).selectedBorder.id) ||
          (it as any).selectedBorder
        : undefined;
      const selectedSize = (it as any).selectedSize
        ? mi.pizzaSizes?.find((s: any) => s.id === (it as any).selectedSize.id) ||
          (it as any).selectedSize
        : undefined;
      const basePrice = isHalf && combination?.price != null
        ? combination.price
        : selectedSize
        ? selectedSize.price
        : it.price ?? mi.price;
      addItem({
        ...mi,
        name: it.name || mi.name,
        price: basePrice,
        priceFrom: isHalf ? false : selectedSize ? false : mi.priceFrom,
        quantity: it.quantity || 1,
        selectedVariations: it.selectedVariations,
        selectedBorder,
        selectedSize,
        isHalfPizza: isHalf,
        combination: combination || undefined,
      } as any);
      added++;
    }
    if (added === 0) {
      toast({
        title: "Não foi possível repetir",
        description: "Os itens deste pedido não estão mais disponíveis.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Itens adicionados!", description: "Seguindo para o checkout." });
    onOpenChange(false);
    setIsCartOpen(false);
    navigate("/checkout");
  };

  const meta = regra?.quantidade_necessaria || 0;
  const progressoClamp = Math.min(progressoAtual, meta || progressoAtual);
  const percent = meta > 0 ? Math.min(100, Math.round((progressoAtual / meta) * 100)) : 0;
  const faltam = meta > 0 ? Math.max(0, meta - progressoAtual) : 0;

  const summarizeItems = (order: Order) => {
    const parts = (order.items || []).map((i) => `${i.quantity}x ${i.name}`);
    if (parts.length <= 3) return parts.join(" + ");
    return parts.slice(0, 3).join(" + ") + ` +${parts.length - 3} item(ns)`;
  };

  const handleUsarCupom = async (codigo: string | null) => {
    if (!codigo) return;
    try {
      const { data: cupom, error } = await supabase
        .from("cupons" as any)
        .select("*")
        .ilike("nome", codigo.trim())
        .maybeSingle();
      if (error || !cupom) {
        toast({ title: "Cupom indisponível", description: "Não foi possível localizar este cupom.", variant: "destructive" });
        return;
      }
      const c: any = cupom;
      if (!c.ativo) {
        toast({ title: "Cupom inativo", variant: "destructive" });
        return;
      }
      if (c.primeira_compra_apenas) {
        const validation = await validateFirstPurchaseCoupon(c, currentUser);
        if (!validation.eligible) {
          toast({
            title: validation.reason === "login_required" ? "Login necessário" : "Cupom indisponível",
            description: getFirstPurchaseCouponBlockMessage(validation.reason),
            variant: "destructive",
          });
          return;
        }
      }
      setAppliedCoupon({
        id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        valor: c.valor,
        descricao: c.descricao ?? null,
        usos: c.usos,
        limite_uso: c.limite_uso,
        data_inicio: c.data_inicio,
        data_fim: c.data_fim,
        produtos_requeridos: c.produtos_requeridos ?? null,
        produto_brinde: c.produto_brinde ?? null,
        primeira_compra_apenas: c.primeira_compra_apenas ?? false,
      });
      toast({ title: "Cupom aplicado!", description: codigo });
      onOpenChange(false);
      setIsCartOpen(true);
    } catch (e: any) {
      toast({ title: "Erro ao aplicar cupom", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen sm:max-w-full p-0 overflow-y-auto [&>button]:hidden"
      >
        <SheetHeader className="px-4 py-4 border-b bg-gradient-to-br from-green-600 to-green-700 text-white">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-white text-xl">Minha Conta</SheetTitle>
            <SheetClose asChild>
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-md"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </SheetClose>
          </div>
          <div className="mt-2">
            <div className="text-lg font-semibold">
              {profileName || currentUser?.email?.split("@")[0] || "Cliente"}
            </div>
            <div className="text-sm text-green-100 break-all">{currentUser?.email}</div>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="secondary"
                className="bg-white text-green-700 hover:bg-green-50"
                onClick={openEdit}
              >
                <UserCog className="h-4 w-4 mr-1" /> Editar dados
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/70 text-white bg-transparent hover:bg-white/10 hover:text-white"
                onClick={async () => {
                  await logOut();
                  onOpenChange(false);
                }}
              >
                <LogOut className="h-4 w-4 mr-1" /> Sair
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="px-4 py-4 space-y-6">
          {/* Pedidos em andamento */}
          {activeOrders.length > 0 && (
            <div>
              <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" /> Pedidos em andamento
                <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-orange-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {activeOrders.length}
                </span>
              </h3>
              <div className="space-y-3">
                {activeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border border-orange-200 bg-orange-50 p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={statusColors[order.status] || "bg-muted"}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      ID: <span className="font-mono font-semibold text-foreground">{order.id.substring(0, 6)}</span>
                    </p>
                    <p className="text-sm text-foreground mb-2 line-clamp-2">
                      {summarizeItems(order)}
                    </p>
                    <div className="font-bold text-green-700">
                      R$ {order.total.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bloco Fidelidade */}
          {regra && meta > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-5 w-5 text-green-700" />
                <h3 className="font-bold text-green-800">{regra.nome || "Programa de Fidelidade"}</h3>
              </div>
              {faltam > 0 ? (
                <p className="text-sm text-green-900 font-semibold mb-3">
                  Faltam apenas <span className="text-green-700">{faltam}</span> pedido
                  {faltam > 1 ? "s" : ""} para você ganhar seu prêmio!
                </p>
              ) : (
                <p className="text-sm text-green-900 font-semibold mb-3">
                  🎉 Parabéns! Você já tem direito ao prêmio.
                </p>
              )}
              <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-green-800 mt-1 font-medium">
                <span>{progressoClamp}/{meta}</span>
                <span>{percent}%</span>
              </div>

              {/* Cupons-prêmio disponíveis */}
              {rewards.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-800">
                    Cupons de prêmio disponíveis
                  </p>
                  {rewards.map((rw) => (
                    <div
                      key={rw.id}
                      className="flex items-center justify-between rounded-lg border border-green-200 bg-white px-3 py-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TicketPercent className="h-4 w-4 shrink-0 text-green-600" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-green-900 truncate">
                            {rw.cupom_codigo}
                          </p>
                          {rw.premio_descricao && (
                            <p className="text-xs text-green-700 truncate">
                              {rw.premio_descricao}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-green-600 text-green-700 hover:bg-green-50 px-2 text-xs"
                        onClick={() => handleUsarCupom(rw.cupom_codigo)}
                      >
                        Usar Cupom
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Histórico dos últimos 5 pedidos */}
          <div>
            <h3 className="font-bold text-base mb-3 flex items-center gap-2">
              <Package className="h-5 w-5" /> Últimos pedidos
            </h3>
            {loading ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Você ainda não tem pedidos concluídos.
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={statusColors[order.status] || "bg-muted"}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mb-2 line-clamp-2">
                      {summarizeItems(order)}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-green-700">
                        R$ {order.total.toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleRepetir(order)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" /> Pedir Novamente
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>

    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar dados</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="edit-name">Nome</Label>
            <Input
              id="edit-name"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={100}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-cep">CEP</Label>
            <Input
              id="edit-cep"
              value={editForm.cep}
              onChange={(e) => handleCepChange(e.target.value)}
              maxLength={8}
              placeholder="Somente números"
              disabled={cepLoading}
            />
            {cepLoading && <p className="text-xs text-gray-500">Buscando CEP...</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-rua">Rua</Label>
            <Input
              id="edit-rua"
              value={editForm.rua}
              onChange={(e) => setEditForm((f) => ({ ...f, rua: e.target.value }))}
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="edit-numero">Número *</Label>
              <Input
                id="edit-numero"
                value={editForm.numero}
                onChange={(e) => setEditForm((f) => ({ ...f, numero: e.target.value }))}
                maxLength={20}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-complemento">Complemento</Label>
              <Input
                id="edit-complemento"
                value={editForm.complemento}
                onChange={(e) => setEditForm((f) => ({ ...f, complemento: e.target.value }))}
                maxLength={100}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="edit-bairro">Bairro</Label>
              <Input
                id="edit-bairro"
                value={editForm.bairro}
                onChange={(e) => setEditForm((f) => ({ ...f, bairro: e.target.value }))}
                maxLength={100}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-cidade">Cidade</Label>
              <Input
                id="edit-cidade"
                value={editForm.cidade}
                onChange={(e) => setEditForm((f) => ({ ...f, cidade: e.target.value }))}
                maxLength={100}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={editForm.email}
              readOnly
              disabled
              className="bg-muted cursor-not-allowed"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-phone">WhatsApp</Label>
            <Input
              id="edit-phone"
              value={editForm.phone}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              maxLength={20}
              placeholder="(11) 99999-9999"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={handleSaveEdit}
            disabled={saving}
          >
            {saving ? "Atualizando..." : "Atualizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default ProfileDrawer;
