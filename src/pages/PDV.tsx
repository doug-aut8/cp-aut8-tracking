import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Calculator as PageIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAllMenuItems } from "@/services/menuItemService";
import { getAllCategories } from "@/services/categoryService";
import { getAllVariations } from "@/services/variationService";
import { getAllVariationGroups } from "@/services/variationGroupService";
import { createOrder } from "@/services/orderService";
import { MenuItem, Category, Variation, VariationGroup } from "@/types/menu";
import { CreateOrderRequest, Order } from "@/types/order";
import { Trash2, Plus, Minus, User, UserPlus, ClipboardList, Check, ChevronsUpDown, Printer, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProductVariationDialog from "@/components/ProductVariationDialog";
import { cn } from "@/lib/utils";
import { printOrder } from "@/utils/printUtils";

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
}

const PDV = () => {
  const { cartItems, addItem, removeFromCart, increaseQuantity, decreaseQuantity, clearCart, cartTotal } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Estados para dados
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [variationGroups, setVariationGroups] = useState<VariationGroup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para busca e filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Estados para cliente
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [openCustomerSelect, setOpenCustomerSelect] = useState(false);
  
  // Estados para pedido
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "pix" | "payroll_discount">("cash");
  const [observations, setObservations] = useState("");
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  
  // Estado para modal de sucesso
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  
  // Estados para variações
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showVariationDialog, setShowVariationDialog] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      try {
        const [itemsData, categoriesData, variationsData, variationGroupsData] = await Promise.all([
          getAllMenuItems(),
          getAllCategories(),
          getAllVariations(),
          getAllVariationGroups()
        ]);
        
        setMenuItems(itemsData);
        setCategories(categoriesData);
        setVariations(variationsData);
        setVariationGroups(variationGroupsData);
        
        // Carregar clientes do localStorage
        const savedCustomers = localStorage.getItem('pdv-customers');
        if (savedCustomers) {
          setCustomers(JSON.parse(savedCustomers));
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do sistema",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast]);

  // Filtrar e ordenar itens do menu por categoria e ordem alfabética
  const filteredItems = menuItems
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      // Primeiro, ordenar por categoria (usando a ordem da categoria)
      const categoryA = categories.find(c => c.id === a.category);
      const categoryB = categories.find(c => c.id === b.category);
      const orderA = categoryA?.order ?? 999;
      const orderB = categoryB?.order ?? 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Depois, ordenar alfabeticamente pelo nome
      return a.name.localeCompare(b.name, 'pt-BR');
    });

  // Criar mapeamento de variações por grupo
  const groupVariations = React.useMemo(() => {
    const mapping: {[groupId: string]: Variation[]} = {};
    
    variationGroups.forEach(group => {
      if (group.variations && Array.isArray(group.variations)) {
        mapping[group.id] = group.variations
          .map(variationId => variations.find(v => v.id === variationId))
          .filter((v): v is Variation => v !== undefined);
      }
    });
    
    return mapping;
  }, [variations, variationGroups]);

  // Função para adicionar item ao carrinho
  const handleAddItem = (item: MenuItem) => {
    // Se o item tem variações, abrir diálogo
    if (item.hasVariations && item.variationGroups && item.variationGroups.length > 0) {
      setSelectedItem(item);
      setShowVariationDialog(true);
    } else {
      // Adicionar diretamente ao carrinho
      addItem(item);
    }
  };

  // Função para adicionar item com variações ao carrinho
  const handleAddItemWithVariations = (item: MenuItem, selectedVariationGroups: any[]) => {
    addItem({
      ...item,
      selectedVariations: selectedVariationGroups
    });
    setShowVariationDialog(false);
    setSelectedItem(null);
  };

  // Salvar cliente
  const saveCustomer = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: "Erro",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const newCustomer: Customer = {
      id: Date.now().toString(),
      name: customerName.trim(),
      phone: customerPhone.trim(),
      address: customerAddress.trim()
    };

    const updatedCustomers = [...customers, newCustomer];
    setCustomers(updatedCustomers);
    localStorage.setItem('pdv-customers', JSON.stringify(updatedCustomers));
    
    setSelectedCustomer(newCustomer);
    setShowNewCustomerForm(false);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    
    toast({
      title: "Cliente salvo",
      description: "Cliente adicionado com sucesso"
    });
  };

  // Processar pedido - PDV finaliza direto sem status intermediários
  const processOrder = async () => {
    if (cartItems.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione itens ao carrinho antes de finalizar o pedido",
        variant: "destructive"
      });
      return;
    }

    if (!selectedCustomer) {
      toast({
        title: "Cliente não selecionado",
        description: "Selecione ou cadastre um cliente",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingOrder(true);

    try {
      const orderData: CreateOrderRequest = {
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        address: selectedCustomer.address,
        paymentMethod: paymentMethod,
        observations,
        status: "completed", // PDV já finaliza o pedido direto
        items: cartItems.map(item => ({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          selectedVariations: item.selectedVariations || [],
          selectedBorder: item.selectedBorder || null,
          priceFrom: item.priceFrom || false,
          isHalfPizza: item.isHalfPizza || false,
          combination: item.combination || null,
        }))
      };

      const order = await createOrder(orderData);
      
      // Salvar o pedido para possível impressão
      setLastOrder(order);
      setShowSuccessModal(true);
      
      // Limpar formulário
      clearCart();
      setSelectedCustomer(null);
      setObservations("");
      setPaymentMethod("cash");
      
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o pedido",
        variant: "destructive"
      });
    } finally {
      setIsProcessingOrder(false);
    }
  };
  
  // Função para imprimir e fechar modal
  const handlePrintOrder = () => {
    if (lastOrder) {
      printOrder(lastOrder);
    }
  };
  
  // Fechar modal de sucesso
  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setLastOrder(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Carregando PDV...</p>
        </div>
      </div>
    );
  }

  return (
<div className="container mx-auto p-4 max-w-7xl">
<AdminPageHeader title="PDV - Ponto de Venda" icon={PageIcon} iconBg="bg-purple-100" iconColor="text-purple-600" />
<div className="flex justify-end mb-6">
  <Badge
    variant="outline"
    className="text-base font-semibold md:text-lg px-3 py-1"
  >
    Total: R$ {cartTotal.toFixed(2)}
  </Badge>
</div>


<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Painel de Produtos */}
  <div className="lg:col-span-2">
    <Card>
      <CardHeader>
        <CardTitle>Produtos</CardTitle>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[32rem] lg:max-h-[40rem] overflow-y-auto">
                {filteredItems.map(item => (
                  <Card key={item.id} className="cursor-pointer hover:bg-gray-50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-sm">{item.name}</h3>
                        <Badge variant="secondary">
                          {item.priceFrom ? `A partir de ` : ''}R$ {item.price.toFixed(2)}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-xs text-gray-600 mb-3">{item.description}</p>
                      )}
                      {item.hasVariations && (
                        <p className="text-xs text-blue-600 mb-2">
                          Produto com variações disponíveis
                        </p>
                      )}
                      <Button
                        onClick={() => handleAddItem(item)}
                        size="sm"
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel do Carrinho e Cliente */}
        <div className="space-y-6">
          {/* Seleção de Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCustomer ? (
                <div className="p-3 bg-green-50 rounded-lg border">
                  <p className="font-semibold">{selectedCustomer.name}</p>
                  <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                  {selectedCustomer.address && (
                    <p className="text-sm text-gray-600">{selectedCustomer.address}</p>
                  )}
                  <Button
                    onClick={() => setSelectedCustomer(null)}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Alterar Cliente
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Popover open={openCustomerSelect} onOpenChange={setOpenCustomerSelect}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCustomerSelect}
                        className="w-full justify-between"
                      >
                        Selecionar cliente existente
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.name}
                                onSelect={() => {
                                  setSelectedCustomer(customer);
                                  setOpenCustomerSelect(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div>
                                  <div className="font-medium">{customer.name}</div>
                                  <div className="text-sm text-gray-600">{customer.phone}</div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  
                  <Button
                    onClick={() => setShowNewCustomerForm(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Novo Cliente
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Carrinho */}
          <Card>
            <CardHeader>
              <CardTitle>Carrinho ({cartItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {cartItems.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Carrinho vazio</p>
                ) : (
                  cartItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-gray-600">
                          R$ {item.price.toFixed(2)} x {item.quantity}
                        </p>
                        {item.selectedVariations && item.selectedVariations.length > 0 && (
                          <div className="text-xs text-blue-600 mt-1">
                            {item.selectedVariations.map(group => (
                              <div key={group.groupId}>
                                {group.groupName}: {group.variations.map(v => v.name).join(', ')}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => decreaseQuantity(item.id)}
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          onClick={() => increaseQuantity(item.id)}
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => removeFromCart(item.id)}
                          size="sm"
                          variant="destructive"
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="payment-method">Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="payroll_discount">Desconto em Folha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="observations">Observações</Label>
                  <Textarea
                    id="observations"
                    placeholder="Observações do pedido..."
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                  />
                </div>
                
                <div className="text-lg font-bold">
                  Total: R$ {cartTotal.toFixed(2)}
                </div>
                
                <Button
                  onClick={processOrder}
                  disabled={isProcessingOrder || cartItems.length === 0}
                  className="w-full"
                  size="lg"
                >
                  {isProcessingOrder ? "Processando..." : "Finalizar Pedido"}
                </Button>

                <Button
                  onClick={() => navigate('/admin-orders')}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Ver Pedidos
                </Button>


              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Novo Cliente */}
      <Dialog open={showNewCustomerForm} onOpenChange={setShowNewCustomerForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="customer-name">Nome *</Label>
              <Input
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <Label htmlFor="customer-phone">Telefone *</Label>
              <Input
                id="customer-phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label htmlFor="customer-address">Endereço</Label>
              <Textarea
                id="customer-address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Endereço completo"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setShowNewCustomerForm(false)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button onClick={saveCustomer}>
                Salvar Cliente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Variações */}
      {selectedItem && (
        <ProductVariationDialog
          item={selectedItem}
          isOpen={showVariationDialog}
          onClose={() => {
            setShowVariationDialog(false);
            setSelectedItem(null);
          }}
          onAddToCart={handleAddItemWithVariations}
          availableVariations={variations}
          groupVariations={groupVariations}
        />
      )}
      
      {/* Modal de Sucesso */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              Pedido Finalizado!
            </DialogTitle>
            <DialogDescription>
              Pedido #{lastOrder?.id.substring(0, 6)} criado com sucesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {lastOrder && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p><strong>Cliente:</strong> {lastOrder.customerName}</p>
                <p><strong>Total:</strong> R$ {lastOrder.total.toFixed(2)}</p>
                <p><strong>Itens:</strong> {lastOrder.items.length}</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCloseSuccessModal}
              className="flex-1"
            >
              Fechar
            </Button>
            <Button
              onClick={handlePrintOrder}
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PDV;
