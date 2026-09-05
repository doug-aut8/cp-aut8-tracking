import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ClipboardList as PageIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { updateOrder, getOrdersByDateRange, getOrderById } from "@/services/orderService";
import OrderDetails from "@/components/OrderDetails";
import { printOrder } from "@/utils/printUtils";

const PRINTED_ORDERS_KEY = "auto_printed_order_ids";
const getPrintedIds = (): Set<string> => {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(PRINTED_ORDERS_KEY) || "[]"));
  } catch { return new Set(); }
};
const markPrinted = (id: string) => {
  const ids = getPrintedIds();
  ids.add(id);
  sessionStorage.setItem(PRINTED_ORDERS_KEY, JSON.stringify(Array.from(ids).slice(-200)));
};
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/DateRangePicker";

const AdminOrders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeStatus, setActiveStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchField, setSearchField] = useState("orderNumber");
  const [searchTerm, setSearchTerm] = useState("");

  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: today,
    to: today
  });

  const loadOrders = async (status: string, dateRange: DateRange | undefined) => {
    try {
      setLoading(true);
      setError(null);

      if (!dateRange?.from) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const startDate = dateRange.from;
      const endDate = dateRange.to || dateRange.from;

      const orders = await getOrdersByDateRange(startDate, endDate, status === "all" ? undefined : status);
      setOrders(orders);
      setLoading(false);
    } catch (err) {
      console.error("Erro ao carregar pedidos:", err);
      setError("Não foi possível carregar os pedidos. Tente novamente.");
      setLoading(false);

      toast({
        title: "Erro",
        description: "Não foi possível carregar os pedidos. Tente novamente.",
        variant: "destructive",
      });
    }
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
    paymentStatus: row.payment_status ?? undefined,
    total: Number(row.valor_total ?? 0),
    subtotal: row.subtotal != null ? Number(row.subtotal) : undefined,
    frete: row.frete != null ? Number(row.frete) : undefined,
    discount: row.desconto != null ? Number(row.desconto) : undefined,
    couponCode: row.cupom_desconto ?? null,
    cancellationReason: row.motivo_cancelamento ?? undefined,
    createdAt: row.criado_em ?? row.data_criacao ?? new Date().toISOString(),
    updatedAt: row.atualizado_em ?? new Date().toISOString(),
  }) as Order;

  useEffect(() => {
    if (!dateRange?.from) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const start = new Date(dateRange.from);
    start.setHours(0, 0, 0, 0);

    const end = new Date(dateRange.to || dateRange.from);
    end.setHours(23, 59, 59, 999);

    const fetchOrders = async () => {
      const { data, error: err } = await supabase
        .from("pedidos_sabor_delivery")
        .select("*")
        .gte("criado_em", start.toISOString())
        .lte("criado_em", end.toISOString())
        .order("criado_em", { ascending: false });

      if (err) {
        console.error("Erro no listener:", err);
        setError("Não foi possível carregar os pedidos. Tente novamente.");
        setLoading(false);
        toast({
          title: "Erro",
          description: "Não foi possível monitorar novos pedidos.",
          variant: "destructive",
        });
        return;
      }

      const newOrders = (data ?? []).map(mapRow);
      const filteredOrders =
        activeStatus === "all"
          ? newOrders
          : newOrders.filter((order) => order.status === activeStatus);
      setOrders(filteredOrders);
      setLoading(false);
    };

    fetchOrders();

    const channel = supabase
      .channel(`admin-orders-${start.getTime()}-${end.getTime()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos_sabor_delivery" },
        (payload) => {
          fetchOrders();
          if (payload.eventType === "INSERT") {
            const row: any = payload.new;
            const createdAt = new Date(row.criado_em ?? Date.now());
            const isRecent = Date.now() - createdAt.getTime() < 60000;
            if (isRecent) {
              const printed = getPrintedIds();
              if (!printed.has(row.id)) {
                markPrinted(row.id);
                if (row.status_atual === "pending") {
                  toast({
                    title: "Novo pedido recebido!",
                    description: `Cliente: ${row.nome_cliente}`,
                  });
                }
                // Auto-impressão
                getOrderById(row.id)
                  .then((full) => { if (full) printOrder(full); })
                  .catch((e) => console.error("Erro ao imprimir pedido automaticamente:", e));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStatus, dateRange, toast]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleUpdateOrderStatus = async (
    orderId: string, 
    newStatus?: Order["status"], 
    cancellationReason?: string, 
    paymentStatus?: "a_receber" | "recebido"
  ) => {
    try {
      console.log("AdminOrders - Atualizando pedido:", { orderId, newStatus, paymentStatus });
      
      const updateData: any = {};
      
      if (newStatus) {
        updateData.status = newStatus;
      }
      
      if (paymentStatus) {
        updateData.paymentStatus = paymentStatus;
      }

      const updatedOrder = await updateOrder(orderId, updateData);

      if (updatedOrder) {
        setOrders(prev =>
          prev.map(order => order.id === orderId ? updatedOrder : order)
        );

        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(updatedOrder);
        }

        const statusMessage = newStatus ? 
          `Status alterado para ${translateStatus(newStatus)}` :
          `Status de pagamento alterado para ${paymentStatus === "recebido" ? "Recebido" : "A Receber"}`;

        toast({
          title: "Pedido atualizado",
          description: statusMessage,
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o pedido. Tente novamente.",
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

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const statusOptions = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Pendentes" },
    { value: "confirmed", label: "Aceitos" },
    { value: "preparing", label: "Em Produção" },
    { value: "ready", label: "Prontos" },
    { value: "delivering", label: "Em Entrega" },
    { value: "received", label: "Recebidos" },
    { value: "delivered", label: "Finalizados" },
    { value: "cancelled", label: "Cancelados" },
    { value: "to_deduct", label: "A descontar" },
    { value: "paid", label: "Pagos" }
  ];

  const handleRetryLoad = () => {
    loadOrders(activeStatus, dateRange);
  };

  const searchOptions = [
    { value: "orderNumber", label: "Nº do Pedido" },
    { value: "customerName", label: "Nome do Cliente" },
    { value: "customerPhone", label: "Telefone" },
  ];

  const filteredOrders = orders.filter((order) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    switch (searchField) {
      case "orderNumber":
        return order.id.toLowerCase().includes(term);
      case "customerName":
        return order.customerName?.toLowerCase().includes(term);
      case "customerPhone":
        return order.customerPhone?.toLowerCase().includes(term);
      default:
        return true;
    }
  });

  const deliveredOrders = filteredOrders.filter(o => o.status === "delivered");
  const totalOrders = filteredOrders.length;
  const totalRecebidos = deliveredOrders.filter(o => o.paymentStatus === "recebido").reduce((sum, o) => sum + o.total, 0);
  const totalNaoRecebidos = deliveredOrders.filter(o => o.paymentStatus !== "recebido").reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <AdminPageHeader title="Gerenciamento de Pedidos" icon={PageIcon} iconBg="bg-blue-100" iconColor="text-blue-600" />

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Buscar por:</label>
            <div className="flex gap-2">
              <Select value={searchField} onValueChange={setSearchField}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {searchOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite para buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Filtrar por status:</label>
            <Select value={activeStatus} onValueChange={setActiveStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Filtrar por período:</label>
            <DateRangePicker 
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {filteredOrders.map((order) => (
          <Card key={order.id} className="overflow-hidden">
            <CardHeader className="bg-gray-50 py-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Pedido #{order.id.substring(0, 6)}
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    {formatFullDate(order.createdAt as string)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-1 rounded-full text-xs flex items-center ${getStatusColor(order.status)}`}>
                    {translateStatus(order.status)}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${order.paymentStatus === "recebido" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}`}>
                    {order.paymentStatus === "recebido" ? "Recebido" : "Não Recebido"}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <div className="font-semibold">{order.customerName}</div>
                <div className="text-sm text-gray-500">{order.customerPhone}</div>
              </div>
            </CardHeader>
            <CardContent className="py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Itens: {order.items.length}</p>
                {(order as any).discount && (order as any).discount > 0 ? (
                  <div>
                    <p className="text-xs text-gray-500">
                      Subtotal: R$ {((order.total + (order as any).discount)).toFixed(2)}
                    </p>
                    <p className="text-xs text-green-600">
                      Desconto ({(order as any).couponCode}): - R$ {((order as any).discount).toFixed(2)}
                    </p>
                    <p className="font-medium">Total: R$ {order.total.toFixed(2)}</p>
                  </div>
                ) : (
                  <p className="font-medium">Total: R$ {order.total.toFixed(2)}</p>
                )}
                <Button
                  onClick={() => handleViewOrder(order)} 
                  variant="outline"
                  className="w-full mt-2"
                >
                  Ver detalhes
                </Button>
                {order.status !== "received" && order.status !== "delivered" && (
                  <Button
                    onClick={() => {
                      const novoStatus = order.status === "delivering" ? "delivered" : "received";
                      handleUpdateOrderStatus(order.id, novoStatus);
                    }}
                    variant="secondary"
                    className="w-full mt-2"
                  >
                    ✅ Marcar como Recebido
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded-lg border-t-4 border-blue-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total de Pedidos no Período</p>
            <p className="text-2xl font-bold text-blue-600">{totalOrders}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Vendas totais (Finalizados):</p>
            <p className="text-lg font-bold text-green-600">Recebidos: R$ {totalRecebidos.toFixed(2)}</p>
            <p className="text-lg font-bold text-red-600">Não recebidos: R$ {totalNaoRecebidos.toFixed(2)}</p>
          </div>
        </div>
        {dateRange?.from && (
          <div className="text-center mt-2 text-sm text-gray-500">
            Período: {dateRange.from.toLocaleDateString('pt-BR')} 
            {dateRange.to && dateRange.to !== dateRange.from && ` até ${dateRange.to.toLocaleDateString('pt-BR')}`}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] xl:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
            <DialogDescription>
              Visualize e atualize o status do pedido
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <OrderDetails 
              order={selectedOrder} 
              onUpdateStatus={handleUpdateOrderStatus}
              onClose={() => setDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
