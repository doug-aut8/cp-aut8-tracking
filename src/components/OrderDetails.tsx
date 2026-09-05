import React, { useState, useEffect } from "react";
import { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  ClipboardList,
  CheckCircle2,
  ChefHat,
  Package,
  Truck,
  XCircle,
  Check,
  DollarSign,
  Printer
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { getNextStatusOptions, hasReceivedPayment } from "@/services/orderStatusService";
import { printOrder } from "@/utils/printUtils";

// 🟢 Import do Supabase client
import { supabase } from "@/integrations/supabase/client";

interface OrderDetailsProps {
  order: Order;
  onUpdateStatus: (
    orderId: string,
    status: Order["status"],
    cancellationReason?: string,
    paymentStatus?: "a_receber" | "recebido"
  ) => void;
  onClose?: () => void;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ order, onUpdateStatus, onClose }) => {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isDeliveredConfirmOpen, setIsDeliveredConfirmOpen] = useState(false);

  // 🟢 Código curto exibido ao admin — mesmo padrão salvo em codigo_curto (primeiros 6 caracteres do ID)
  const shortCode = order?.id ? String(order.id).substring(0, 6) : null;
  const [webhookStatusUrl, setWebhookStatusUrl] = useState<string | null>(null);


  // 🟢 Buscar URL do webhook de status nas configurações
  useEffect(() => {
    const fetchWebhookUrl = async () => {
      try {
        const { data, error } = await supabase
          .from("configuracoes")
          .select("valor")
          .eq("chave", "webhook_status_pedido")
          .maybeSingle();
        if (!error && data?.valor) {
          setWebhookStatusUrl(data.valor);
        }
      } catch (err) {
        console.warn("⚠️ Erro ao buscar webhook de status:", err);
      }
    };
    fetchWebhookUrl();
  }, []);

  // Debug do pedido completo
  console.log("=== ORDER DETAILS DEBUG ===");
  console.log("Pedido completo:", order);
  console.log("Status de pagamento:", order.paymentStatus);

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

  const translatePaymentMethod = (method: Order["paymentMethod"]) => {
    const methodMap: Record<Order["paymentMethod"], string> = {
      card: "Cartão",
      cash: "Dinheiro",
      pix: "PIX",
      payroll_discount: "Desconto em Folha"
    };
    return methodMap[method] || method;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "confirmed": return "bg-blue-100 text-blue-800";
      case "preparing": return "bg-purple-100 text-purple-800";
      case "ready": return "bg-green-100 text-green-800";
      case "delivering": return "bg-blue-100 text-blue-800";
      case "received": return "bg-blue-200 text-blue-800";
      case "delivered": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      case "to_deduct": return "bg-orange-100 text-orange-800";
      case "paid": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "pending": return <ClipboardList className="h-5 w-5" />;
      case "confirmed": return <CheckCircle2 className="h-5 w-5" />;
      case "preparing": return <ChefHat className="h-5 w-5" />;
      case "ready": return <Package className="h-5 w-5" />;
      case "delivering": return <Truck className="h-5 w-5" />;
      case "received": return <DollarSign className="h-5 w-5" />;
      case "delivered": return <CheckCircle2 className="h-5 w-5" />;
      case "cancelled": return <XCircle className="h-5 w-5" />;
      case "to_deduct": return <DollarSign className="h-5 w-5" />;
      case "paid": return <CheckCircle2 className="h-5 w-5" />;
      default: return <ClipboardList className="h-5 w-5" />;
    }
  };

  const calculateItemSubtotal = (item: any) => {
    if (item.isHalfPizza) {
      return (item.price || 0) * (item.quantity || 1);
    }

    let basePrice = (item.priceFrom ? 0 : (item.price || 0)) * item.quantity;
    let variationsTotal = 0;

    if (item.selectedVariations && Array.isArray(item.selectedVariations)) {
      item.selectedVariations.forEach((group: any) => {
        if (group.variations && Array.isArray(group.variations)) {
          group.variations.forEach((variation: any) => {
            const additionalPrice = variation.additionalPrice || 0;
            const quantity = variation.quantity || 1;
            if (additionalPrice > 0) {
              variationsTotal += additionalPrice * quantity * item.quantity;
            }
          });
        }
      });
    }

    // Incluir preço da borda recheada
    const borderPrice = item.selectedBorder?.additionalPrice || 0;

    return basePrice + variationsTotal + (borderPrice * item.quantity);
  };

const sendOrderStatusWebhook = async (orderData: Order & { cancellationReason?: string }) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUser = user;

    const payload = {
      codigo_pedido: orderData.id,
      status_atual: orderData.status,    
      nome_cliente: orderData.customerName,
      telefone_cliente: orderData.customerPhone,
      endereco_entrega: orderData.address,
      observacoes: orderData.observations || null,
      metodo_pagamento: orderData.paymentMethod,
      status_pagamento: orderData.paymentStatus,
      valor_total: orderData.total,
      cupom_desconto: (orderData as any).couponCode || null,
      data_criacao: orderData.createdAt,
      horario_recebido: (orderData as any).receivedAt || null,
      motivo_cancelamento: orderData.cancellationReason || null,
      itens: orderData.items.map((item: any) => ({
        nome: item.name,
        quantidade: item.quantity,
        preco_unitario: item.price,
        subtotal: item.subtotal ?? calculateItemSubtotal(item),
        variacoes: item.selectedVariations?.map((group: any) => ({
          grupo: group.groupName,
          opcoes: group.variations?.map((variation: any) => ({
            nome: variation.name,
            preco_adicional: variation.additionalPrice || 0,
            quantidade: variation.quantity || 1,
          })) || []
        })) || []
      })),
      atualizado_em: new Date().toISOString(),
      origem: "AppDelivery",
      firebase_id: currentUser?.id || null,
      user_name: (currentUser?.user_metadata as any)?.name || null,
      user_email: currentUser?.email || null,
    };

    console.log("📦 Enviando payload do pedido para webhook n8n:", payload);

    if (!webhookStatusUrl) {
      console.warn("⚠️ Webhook de status não configurado. Pulando envio.");
      return;
    }

    const { withComunicacaoMeta } = await import("@/utils/webhookPayload");
    const enriched = await withComunicacaoMeta(payload);

    const response = await fetch(webhookStatusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enriched),
    });

    if (!response.ok) {
      console.error("❌ Falha ao enviar webhook:", await response.text());
    } else {
      console.log("✅ Webhook enviado com sucesso!");
    }
  } catch (err) {
    console.error("⚠️ Erro ao enviar webhook de status:", err);
  }
};


  const handleUpdateStatus = async (orderId: string, status: Order["status"], cancellationReasonValue?: string) => {
    if (status === "confirmed") {
      try {
        const { data } = await supabase
          .from("configuracoes")
          .select("valor")
          .eq("chave", "auto_print_on_accept")
          .maybeSingle();
        const enabled = !data || data.valor !== "false";
        if (enabled) printOrder(order);
      } catch (e) {
        console.error("Erro ao verificar config de impressão:", e);
        printOrder(order);
      }
    }
    const updatedOrder: Order & { cancellationReason?: string } = { ...order, status };
    if (status === "cancelled" && cancellationReasonValue) {
      updatedOrder.cancellationReason = cancellationReasonValue;
    }
    sendOrderStatusWebhook(updatedOrder);
    onUpdateStatus(orderId, status, cancellationReasonValue);
  };

  const handleUpdatePaymentStatus = (orderId: string, paymentStatus: "a_receber" | "recebido") => {
    const updatedOrder: Order = { ...order, paymentStatus };
    sendOrderStatusWebhook(updatedOrder);
    onUpdateStatus(orderId, order.status, undefined, paymentStatus);
  };

  const handleConfirmCancelDialogYes = () => {
    setIsConfirmDialogOpen(false);
    setIsReasonDialogOpen(true);
  };

  const handleCloseReasonDialog = () => {
    setIsReasonDialogOpen(false);
    setCancellationReason("");
  };

  const handleSubmitReason = () => {
    handleUpdateStatus(order.id, "cancelled", cancellationReason);
    setIsReasonDialogOpen(false);
    setCancellationReason("");
  };

  const paymentReceived = hasReceivedPayment(order);
  const nextStatusOptions = getNextStatusOptions(order.status, paymentReceived, order.paymentMethod);

  const nextStatusButtons = nextStatusOptions.map(status => {
    const icon = getStatusIcon(status);
    const label = translateStatus(status);

    if (status === "cancelled") {
      return (
        <>
          <AlertDialog key={status} open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex items-center gap-1">
                {icon}
                {label}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar o Pedido?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O pedido será marcado como cancelado.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsConfirmDialogOpen(false)}>Não</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleConfirmCancelDialogYes}
                >
                  Sim
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Dialog open={isReasonDialogOpen} onOpenChange={setIsReasonDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Motivo do cancelamento</DialogTitle>
                <DialogDescription>
                  Por favor, informe o motivo desse cancelamento. Isso será salvo nos detalhes do pedido.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <Textarea
                  value={cancellationReason}
                  onChange={e => setCancellationReason(e.target.value)}
                  placeholder="Digite o motivo do cancelamento..."
                  className="w-full"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseReasonDialog} type="button">
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSubmitReason}
                  type="button"
                  disabled={!cancellationReason.trim()}
                >
                  Confirmar Cancelamento
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      );
    }

    let buttonVariant: "default" | "secondary" | "outline" = "default";
    let buttonClass = "flex items-center gap-1";

    if (status === "received") {
      buttonVariant = "secondary";
      buttonClass = "flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-800 border-green-300";
    } else if (status === "to_deduct") {
      buttonClass = "flex items-center gap-1 bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300";
    } else if (status === "paid") {
      buttonClass = "flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300";
    }

    // Intercept "delivered" status: check if payment received
    if (status === "delivered") {
      return (
        <Button
          key={status}
          onClick={() => {
            if (order.paymentStatus !== "recebido") {
              setIsDeliveredConfirmOpen(true);
            } else {
              handleUpdateStatus(order.id, "delivered");
            }
          }}
          variant={buttonVariant}
          className={buttonClass}
        >
          {icon}
          {label}
        </Button>
      );
    }

    return (
      <Button
        key={status}
        onClick={() => handleUpdateStatus(order.id, status)}
        variant={buttonVariant}
        className={buttonClass}
      >
        {icon}
        {label}
      </Button>
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Coluna Esquerda: Detalhes + Status + Ações */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Detalhes do Pedido</h2>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <h3 className="text-sm font-medium text-gray-500">ID do Pedido</h3>
            <p className="mt-1">
              {shortCode ? (
                <>
                  <span className="font-semibold text-lg">{shortCode}</span>
                  <span className="ml-2 text-xs text-gray-400">({order.id})</span>
                </>
              ) : (
                order.id
              )}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Data do Pedido</h3>
            <p className="mt-1">{formatDate(order.createdAt as string)}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Cliente</h3>
            <p className="mt-1">{order.customerName}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Telefone</h3>
            <p className="mt-1">{order.customerPhone}</p>
          </div>
          <div className="col-span-2">
            <h3 className="text-sm font-medium text-gray-500">Endereço</h3>
            <p className="mt-1">{order.address}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Forma de Pagamento</h3>
            <p className="mt-1 font-medium">{translatePaymentMethod(order.paymentMethod)}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">
              {((order as any).discount && (order as any).discount > 0) || (order.frete && order.frete > 0) ? 'Resumo' : 'Total'}
            </h3>
            <div className="mt-1 space-y-1">
              {(((order as any).discount && (order as any).discount > 0) || (order.frete && order.frete > 0)) && (
                <p className="text-sm text-gray-600">
                  Subtotal: R$ {(order.subtotal || (order.total + ((order as any).discount || 0) - (order.frete || 0))).toFixed(2)}
                </p>
              )}
              {(order as any).discount && (order as any).discount > 0 && (
                <p className="text-sm text-green-600">
                  Desconto ({(order as any).couponCode}): - R$ {((order as any).discount).toFixed(2)}
                </p>
              )}
              {order.frete !== undefined && order.frete !== null && order.frete === 0 ? (
                <p className="text-sm text-green-600">Frete: 🚚 Grátis!</p>
              ) : order.frete && order.frete > 0 ? (
                <p className="text-sm text-blue-600">Frete: + R$ {order.frete.toFixed(2)}</p>
              ) : null}
              <p className="font-semibold text-lg">Total: R$ {order.total.toFixed(2)}</p>
            </div>
          </div>
          {order.observations && (
            <div className="col-span-2">
              <h3 className="text-sm font-medium text-gray-500">Observações</h3>
              <p className="mt-1">{order.observations}</p>
            </div>
          )}
        </div>

        {/* Status + Ações */}
        <div>
          <h3 className="text-md font-medium mb-2">Status</h3>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm ${getStatusColor(order.status)}`}>
              {getStatusIcon(order.status)}
              {translateStatus(order.status)}
            </span>
            {nextStatusButtons}
            <Button
              variant="outline"
              className="flex items-center gap-1"
              onClick={() => printOrder(order)}
            >
              <Printer className="h-5 w-5" />
              Imprimir
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            )}
          </div>
        </div>

        {/* Status de Pagamento */}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
          <h3 className="text-md font-medium mb-3 text-blue-800">Status de Pagamento</h3>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <span className="font-medium">
                Status: {order.paymentStatus === "recebido" ? "Recebido" : "A Receber"}
              </span>
            </div>
            {order.paymentStatus !== "recebido" && (
              <Button
                onClick={() => handleUpdatePaymentStatus(order.id, "recebido")}
                variant="default"
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <DollarSign className="h-4 w-4" />
                Marcar como Recebido
              </Button>
            )}
          </div>
        </div>

        {/* Motivo do cancelamento */}
        {order.status === "cancelled" && (order.cancellationReason || cancellationReason) && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-md">
            <div className="text-sm font-semibold text-red-700">Motivo do cancelamento:</div>
            <div className="text-sm text-gray-800 mt-1">
              {order.cancellationReason || cancellationReason}
            </div>
          </div>
        )}
      </div>

      {/* Coluna Direita: Itens do Pedido */}
      <div className="lg:border-l lg:pl-6">
        <h3 className="text-md font-medium mb-3">Itens do Pedido</h3>

        <div className="hidden md:grid md:grid-cols-[minmax(200px,1fr)_80px_40px_90px] gap-x-4 items-end pb-2 border-b text-[11px] uppercase tracking-wide text-gray-500">
          <div>Item</div>
          <div className="text-right w-[80px]">Preço Base</div>
          <div className="text-right w-[40px]">Qtd</div>
          <div className="text-right w-[90px]">Subtotal</div>
        </div>

        <div className="divide-y">
          {order.items.map((item, index) => (
            <div key={index} className="py-3">
              {/* Linha principal */}
              <div className="flex flex-col md:grid md:grid-cols-[minmax(200px,1fr)_80px_40px_90px] md:gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center justify-center min-w-[30px] px-1.5 py-0.5 rounded bg-primary/10 text-primary text-sm font-bold shrink-0">
                      {item.quantity}x
                    </span>
                    <div className="min-w-0">
                      <div className="text-base font-semibold leading-tight break-words">
                        {item.name}
                        {item.selectedSize && (
                          <span className="ml-2 text-sm text-amber-700 font-medium">
                            ({item.selectedSize.name})
                          </span>
                        )}
                        {item.priceFrom && (
                          <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            a partir de
                          </span>
                        )}
                      </div>
                      {item.isHalfPizza && (item.combination as any)?.sabor1 && (
                        <div className="mt-0.5 text-sm text-orange-700 font-medium">
                          1/2 {(item.combination as any).sabor1?.name} + 1/2 {(item.combination as any).sabor2?.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex md:block justify-between items-center text-sm">
                  <span className="md:hidden text-gray-500">Preço Base</span>
                  <span className="md:text-right md:w-[80px] tabular-nums">
                    R$ {(item.price || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex md:block justify-between items-center text-sm">
                  <span className="md:hidden text-gray-500">Qtd</span>
                  <span className="md:text-right md:w-[40px] tabular-nums">{item.quantity}</span>
                </div>
                <div className="flex md:block justify-between items-center text-sm font-semibold">
                  <span className="md:hidden text-gray-500">Subtotal</span>
                  <span className="md:text-right md:w-[90px] tabular-nums">
                    R$ {(item.subtotal ?? calculateItemSubtotal(item)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Adicionais / variações */}
              {item.selectedVariations && Array.isArray(item.selectedVariations) && item.selectedVariations.length > 0 ? (
                <div className="mt-2 ml-[38px] space-y-2">
                  {item.selectedVariations.map((group, groupIndex) => (
                    <div key={groupIndex}>
                      {group.groupName && (
                        <div className="text-xs font-medium text-gray-500 mb-0.5">{group.groupName}:</div>
                      )}
                      {group.variations && Array.isArray(group.variations) && group.variations.length > 0 ? (
                        <div className="space-y-0.5">
                          {group.variations.map((variation, varIndex) => {
                            const additionalPrice = variation.additionalPrice || 0;
                            const quantity = variation.quantity || 1;
                            const half = (variation as any).halfSelection as string | undefined;
                            const isWhole = half === "whole";
                            const variationTotal = additionalPrice * quantity * (item.isHalfPizza && isWhole ? 2 : 1);
                            const comb: any = item.combination;
                            const halfLabel = !item.isHalfPizza || !half
                              ? ""
                              : isWhole
                                ? "Pizza inteira"
                                : half === "half1"
                                  ? `1/2 ${comb?.sabor1?.name ?? "Metade 1"}`
                                  : half === "half2"
                                    ? `1/2 ${comb?.sabor2?.name ?? "Metade 2"}`
                                    : "";
                            return (
                              <div
                                key={varIndex}
                                className="flex flex-col sm:grid sm:grid-cols-[1fr_auto] sm:gap-x-4 gap-y-0.5 text-sm text-gray-700"
                              >
                                <span className="min-w-0 break-words">
                                  <span className="font-semibold">{quantity}x</span> {variation.name}
                                  {halfLabel && (
                                    <span className="ml-2 text-orange-600 font-medium">— {halfLabel}</span>
                                  )}
                                </span>
                                <span className="sm:text-right sm:w-[90px] text-gray-500 tabular-nums">
                                  {variationTotal > 0 ? `+R$ ${variationTotal.toFixed(2)}` : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">Nenhuma variação</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 ml-[38px] text-sm text-gray-500 italic">Sem variações</div>
              )}

              {/* Borda recheada */}
              {item.selectedBorder && (
                <div className="mt-2 ml-[38px] flex flex-col sm:grid sm:grid-cols-[1fr_auto] sm:gap-x-4 gap-y-0.5 text-sm">
                  <span className="text-amber-700 font-medium">
                    Borda Recheada: <span className="text-gray-800">{item.selectedBorder.name}</span>
                  </span>
                  <span className="sm:text-right sm:w-[90px] text-green-600 font-semibold tabular-nums">
                    {item.selectedBorder.additionalPrice > 0
                      ? `+R$ ${(item.selectedBorder.additionalPrice * item.quantity).toFixed(2)}`
                      : ""}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Resumo */}
        <div className="mt-3 pt-3 border-t space-y-1">
          {(order.frete && order.frete > 0) ? (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="tabular-nums">R$ {(order.subtotal || (order.total - order.frete)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-blue-600">
                <span>Frete</span>
                <span className="tabular-nums">+ R$ {order.frete.toFixed(2)}</span>
              </div>
            </>
          ) : null}
          <div className="flex justify-between items-baseline pt-2 border-t">
            <span className="text-base font-semibold">Total</span>
            <span className="text-lg font-bold tabular-nums">R$ {order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>


      {/* Diálogo de confirmação: Entrega finalizada sem pagamento */}
      <Dialog open={isDeliveredConfirmOpen} onOpenChange={setIsDeliveredConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">⚠️ ATENÇÃO: Pedido não pago</DialogTitle>
            <DialogDescription>
              Este pedido ainda não foi marcado como recebido. Deseja finalizar a entrega mesmo assim?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeliveredConfirmOpen(false);
                handleUpdateStatus(order.id, "delivered");
              }}
            >
              Finalizar mesmo assim
            </Button>
            <Button
              onClick={() => {
                setIsDeliveredConfirmOpen(false);
                // Dispara um único webhook já com status=delivered e paymentStatus=recebido
                const updatedOrder: Order = {
                  ...order,
                  status: "delivered",
                  paymentStatus: "recebido",
                };
                sendOrderStatusWebhook(updatedOrder);
                // Persiste a alteração no banco sem disparar webhooks adicionais
                onUpdateStatus(order.id, "delivered", undefined, "recebido");
              }}
            >
              Marcar como recebido e finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDetails;
