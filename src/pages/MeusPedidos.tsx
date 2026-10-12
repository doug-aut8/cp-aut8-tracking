import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, MapPin, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Order } from "@/types/order";
import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/services/profileService";
import { getAllMenuItems } from "@/services/menuItemService";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { phoneVariants } from "@/utils/phoneUtils";
import { ptBR } from "date-fns/locale";
import type { MenuItem } from "@/types/menu";

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
  createdAt: row.criado_em ?? row.data_criacao ?? new Date().toISOString(),
  updatedAt: row.atualizado_em ?? new Date().toISOString(),
}) as Order;


const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  delivering: "bg-purple-100 text-purple-800",
  delivered: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  received: "bg-emerald-100 text-emerald-800",
};

const statusLabels: Record<string, string> = {
  pending: "Recebido",
  confirmed: "Confirmado",
  preparing: "Em Produção",
  ready: "Pronto",
  delivering: "Em Entrega",
  delivered: "Entregue",
  completed: "Concluído",
  cancelled: "Cancelado",
  received: "Recebido",
};

const MeusPedidos = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { addItem, setIsCartOpen } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [menuMap, setMenuMap] = useState<Map<string, MenuItem>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const setup = async () => {
      try {
        // Telefone do usuário: profile → users → metadata do auth
        // (não usar customer_data por nome, pois pode bater com outro cliente)
        const profileData = await getProfile(currentUser.id);

        let phone: string | null = profileData?.phone || currentUser.phoneNumber || null;

        if (!phone) {
          const { data: userRow } = await supabase
            .from("users")
            .select("phone")
            .eq("id", currentUser.id)
            .maybeSingle();
          phone = userRow?.phone || null;
        }

        const variants = phone ? phoneVariants(phone) : [];

        // Cardápio em memória para o "Pedir Novamente"
        getAllMenuItems()
          .then((items) => {
            if (!cancelled) {
              setMenuMap(new Map(items.map((m: MenuItem) => [m.id, m] as [string, MenuItem])));
            }
          })
          .catch(() => {});

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const buildFilter = <T,>(q: T): T => {
          // Filtro: pelo user_id do auth OU pelas variantes de telefone
          if (variants.length > 0) {
            return (q as any).or(
              `user_id.eq.${currentUser.id},telefone_cliente.in.(${variants.slice(0, 30).map((v) => `"${v}"`).join(",")})`
            );
          }
          return (q as any).eq("user_id", currentUser.id);
        };

        const fetchOrders = async () => {
          const q = buildFilter(
            supabase
              .from("pedidos_sabor_delivery")
              .select("*")
              .gte("criado_em", today.toISOString())
              .order("criado_em", { ascending: false })
          );

          const { data, error } = await q;
          if (error) {
            console.error("Erro ao buscar pedidos:", error);
            if (!cancelled) setLoading(false);
            return;
          }

          const activeOrders = (data ?? [])
            .map(mapRow)
            .filter((order) => !["delivered", "completed", "cancelled"].includes(order.status));

          if (!cancelled) {
            setOrders(activeOrders);
            setLoading(false);
          }
        };

        const fetchPastOrders = async () => {
          const q = buildFilter(
            supabase
              .from("pedidos_sabor_delivery")
              .select("*")
              .in("status_atual", ["delivered", "completed", "received"])
              .order("criado_em", { ascending: false })
              .limit(5)
          );

          const { data, error } = await q;
          if (error) {
            console.error("Erro ao buscar pedidos anteriores:", error);
            return;
          }
          if (!cancelled) setPastOrders((data ?? []).map(mapRow));
        };

        await fetchOrders();
        await fetchPastOrders();

        channel = supabase
          .channel(`meus-pedidos-${currentUser.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "pedidos_sabor_delivery" },
            () => {
              fetchOrders();
              fetchPastOrders();
            }
          )
          .subscribe();
      } catch (error) {
        console.error("Erro ao configurar listener:", error);
        if (!cancelled) setLoading(false);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    return format(date, "dd/MM/yyyy  -  HH:mm", { locale: ptBR });
  };

  const formatOrderId = (id: string) => {
    return id.substring(0, 6);
  };

  const summarizeItems = (order: Order) => {
    const parts = (order.items || []).map((i) => `${i.quantity}x ${i.name}`);
    if (parts.length <= 3) return parts.join(" + ");
    return parts.slice(0, 3).join(" + ") + ` +${parts.length - 3} item(ns)`;
  };

  const handleRepetir = (order: Order) => {
    let added = 0;
    for (const it of order.items || []) {
      const anyIt = it as any;
      const isHalf = !!anyIt.isHalfPizza;
      const combination = anyIt.combination || null;
      const mi =
        menuMap.get(it.menuItemId) ||
        (isHalf && combination
          ? menuMap.get(combination?.sabor1?.id) || menuMap.get(combination?.sabor2?.id)
          : undefined);
      if (!mi) continue;
      const selectedBorder = anyIt.selectedBorder
        ? mi.pizzaBorders?.find((b: any) => b.id === anyIt.selectedBorder.id) || anyIt.selectedBorder
        : undefined;
      const selectedSize = anyIt.selectedSize
        ? mi.pizzaSizes?.find((s: any) => s.id === anyIt.selectedSize.id) || anyIt.selectedSize
        : undefined;
      const basePrice =
        isHalf && combination?.price != null
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
    setIsCartOpen(false);
    navigate("/checkout");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Meus Pedidos</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {!currentUser ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Faça login para ver seus pedidos</h2>
            <p className="text-muted-foreground mb-4">
              Você precisa estar logado para acompanhar seus pedidos.
            </p>
            <Button onClick={() => navigate("/login")}>Fazer Login</Button>
          </div>
        ) : orders.length === 0 && pastOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Nenhum pedido ativo</h2>
            <p className="text-muted-foreground mb-4">
              Você não possui pedidos em andamento no momento.
            </p>
            <Button onClick={() => navigate("/")}>Ver Cardápio</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-4">
                  {/* Data e hora */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Clock className="h-4 w-4" />
                    <span>{formatDate(order.createdAt)}</span>
                  </div>

                  {/* ID do Pedido + Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-lg">
                      ID Pedido: {formatOrderId(order.id)}
                    </div>
                    <Badge className={statusColors[order.status] || "bg-muted text-muted-foreground"}>
                      {statusLabels[order.status] || order.status}
                    </Badge>
                  </div>

                  {/* Endereço */}
                  <div className="flex items-start gap-2 mb-4">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm">{order.address}</span>
                  </div>

                  {/* Itens */}
                  <div className="mb-4">
                    <div className="text-sm font-medium mb-2">Itens:</div>
                    <ul className="space-y-2">
                      {order.items.map((item, index) => (
                        <li key={index} className="text-sm text-muted-foreground border-b border-dashed pb-2 last:border-0">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-foreground">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="text-green-600 font-semibold">
                              R$ {(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                          
                          {/* Variações/Adicionais */}
                          {item.selectedVariations && item.selectedVariations.length > 0 && (
                            <div className="ml-3 mt-1 space-y-0.5">
                              {item.selectedVariations.flatMap((group) =>
                                group.variations.map((v, vIndex) => (
                                  <div key={`${group.groupId}-${vIndex}`} className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">
                                      + <span className="font-semibold text-foreground">{v.quantity || 1}x</span> {v.name}
                                    </span>
                                    {v.additionalPrice && v.additionalPrice > 0 && (
                                      <span className="text-green-600">
                                        +R$ {((v.additionalPrice || 0) * (v.quantity || 1) * item.quantity).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                          
                          {/* Borda recheada */}
                          {(item as any).selectedBorder && (
                            <div className="ml-3 mt-1 flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                + Borda: {(item as any).selectedBorder.name}
                              </span>
                              {(item as any).selectedBorder.additionalPrice > 0 && (
                                <span className="text-green-600">
                                  +R$ {((item as any).selectedBorder.additionalPrice * item.quantity).toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Frete */}
                  {typeof order.frete === "number" && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Frete:</span>
                      <span className="font-medium">R$ {order.frete.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="pt-3 border-t">
                    <div className="font-bold text-lg">
                      Total: R$ {order.total.toFixed(2)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pedidos Anteriores */}
        {currentUser && pastOrders.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Pedidos Anteriores</h2>
            <div className="space-y-3">
              {pastOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Clock className="h-4 w-4 flex-shrink-0" />
                          <span>{formatDate(order.createdAt)}</span>
                          <Badge className={statusColors[order.status] || "bg-muted text-muted-foreground"}>
                            {statusLabels[order.status] || order.status}
                          </Badge>
                        </div>
                        <p className="text-sm truncate">{summarizeItems(order)}</p>
                        <p className="text-sm font-semibold mt-1">
                          Total: R$ {order.total.toFixed(2)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0"
                        onClick={() => handleRepetir(order)}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Pedir Novamente
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusPedidos;
