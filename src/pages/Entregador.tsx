import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Bike as PageIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateOrder } from "@/services/orderService";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

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

const Entregador = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("pedidos_sabor_delivery")
      .select("*")
      .eq("status_atual", "delivering")
      .gte("criado_em", today.toISOString())
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("[Entregador] Erro na consulta:", error);
      setLoading(false);
      return;
    }
    setOrders((data ?? []).map(mapRow));
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("entregador-pedidos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos_sabor_delivery" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleConfirmEntrega = async (order: Order) => {
    const novoStatus = order.paymentMethod === "cash" ? "received" : "delivered";

    try {
      await updateOrder(order.id, { status: novoStatus });
      toast({
        title: "Status atualizado",
        description: `Pedido #${order.id.substring(0, 6)} marcado como ${translateStatus(novoStatus)}`,
      });
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido.",
        variant: "destructive",
      });
    }
  };

  const translateStatus = (status: Order["status"]) => {
    const statusMap: Record<Order["status"], string> = {
      pending: "Pendente",
      confirmed: "Aceito",
      preparing: "Em produção",
      ready: "Pronto para Entrega",
      delivering: "Saiu para entrega",
      received: "Recebido",
      delivered: "Entrega finalizada",
      cancelled: "Cancelado",
      to_deduct: "A descontar",
      paid: "Pago",
      completed: "Finalizado"
    };
    return statusMap[status] || status;
  };

  const formatFullDate = (input: string | Date) => {
    const date = typeof input === "string" ? new Date(input) : input;
    if (isNaN(date.getTime())) return "Data inválida";

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatItems = (items: any[]) => {
    return items.map((item, index) => {
      let variationsText = "";

      if (item.selectedVariations && Array.isArray(item.selectedVariations)) {
        const variations: string[] = [];
        item.selectedVariations.forEach((group: any) => {
          if (group.variations && Array.isArray(group.variations)) {
            group.variations.forEach((variation: any) => {
              const qty = variation.quantity && variation.quantity > 1 ? `${variation.quantity}x ` : "";
              variations.push(`${qty}${variation.name}`);
            });
          }
        });
        if (variations.length > 0) {
          variationsText = " + " + variations.join(" + ");
        }
      }

      return (
        <div key={index} className="text-sm text-gray-700">
          • {item.quantity}x {item.name}{variationsText}
        </div>
      );
    });
  };

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader title="Pedidos em Rota de Entrega" icon={PageIcon} iconBg="bg-purple-100" iconColor="text-purple-600" />

      {loading ? (
        <p className="text-gray-500">Carregando pedidos...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-500">Nenhum pedido em rota de entrega.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardHeader className="bg-gray-50 py-4">
                <div>
                  <p className="text-sm text-gray-500">
                    Pedido #{order.id.substring(0, 6)} - {formatFullDate(order.createdAt)}
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    Cliente: {order.customerName}
                  </p>
                  <p className="text-sm text-gray-500">Fone: {order.customerPhone}</p>
                  <p className="text-sm text-gray-500">Endereço: {order.address}</p>
                </div>
              </CardHeader>
              <CardContent className="py-4 space-y-2">
                <div>
                  <p className="text-sm font-medium mb-1">Itens:</p>
                  <div className="pl-2">{formatItems(order.items)}</div>
                </div>
                <p className="font-medium">Total: R$ {order.total.toFixed(2)}</p>
                <Button onClick={() => handleConfirmEntrega(order)} className="w-full mt-2">
                  Confirmar entrega
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Entregador;
