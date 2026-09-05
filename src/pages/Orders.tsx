import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getOrdersByPhone, updateOrder } from "@/services/orderService";
import { Order } from "@/types/order";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Search, RefreshCw } from "lucide-react";
import OrderDetails from "@/components/OrderDetails";

const Orders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchPhone, setSearchPhone] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSearch = async () => {
    if (!searchPhone.trim()) {
      toast({
        title: "Telefone necessário",
        description: "Digite um número de telefone para buscar os pedidos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const fetchedOrders = await getOrdersByPhone(searchPhone);
      setOrders(fetchedOrders);
      
      if (fetchedOrders.length === 0) {
        toast({
          title: "Nenhum pedido encontrado",
          description: `Não há pedidos para o telefone ${searchPhone}`,
        });
      } else {
        toast({
          title: "Pedidos encontrados",
          description: `${fetchedOrders.length} pedidos encontrados`,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível buscar os pedidos. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order["status"]) => {
    try {
      const updatedOrder = await updateOrder(orderId, { status: newStatus });
      if (updatedOrder) {
        setOrders(orders.map(order => 
          order.id === orderId ? updatedOrder : order
        ));
        
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(updatedOrder);
        }
        
        toast({
          title: "Pedido atualizado",
          description: `Status alterado para ${translateStatus(newStatus)}`,
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Buscar Pedidos de Cliente</h1>
        <Button onClick={() => navigate("/admin-orders")} variant="outline">
          Ver Todos os Pedidos
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Buscar Pedidos</CardTitle>
          <CardDescription>
            Digite o número de telefone do cliente para buscar seus pedidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Telefone (ex: 11999999999)"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Encontrados</CardTitle>
            <CardDescription>
              {orders.length} pedidos para o telefone {searchPhone}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="bg-gray-50 py-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-500">Pedido #{order.id.substring(0, 8)}</p>
                        <h3 className="font-semibold">{order.customerName}</h3>
                      </div>
                      <Button onClick={() => handleViewOrder(order)} variant="outline" size="sm">
                        Ver detalhes
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
            />
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
