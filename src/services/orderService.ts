import { supabase } from "@/integrations/supabase/client";
import { Order, CreateOrderRequest, UpdateOrderRequest } from "@/types/order";
import { getAllVariations } from "@/services/variationService";
import { verificarFidelidade } from "@/services/fidelidadeService";
import { phoneDigitsBr } from "@/utils/phoneUtils";

const TABLE = "pedidos_sabor_delivery";

// Obter o preço adicional de uma variação
const getVariationPrice = async (variationId: string): Promise<number> => {
  try {
    const variations = await getAllVariations();
    const variation = variations.find((v) => v.id === variationId);
    return variation?.additionalPrice || 0;
  } catch (error) {
    console.error("Erro ao obter preço da variação:", error);
    return 0;
  }
};

// Mapeia row do Supabase -> Order (formato esperado pelo app)
const rowToOrder = (row: any): Order => {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
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
    updatedAt: row.atualizado_em ?? row.atualizado_em_banco ?? new Date().toISOString(),
  } as Order;
};

// Gera os códigos do pedido DERIVADOS do próprio UUID do pedido,
// para que o valor salvo no banco seja idêntico ao exibido no app
// (OrderDetails e "Meus Pedidos" usam os primeiros caracteres do id).
const generateOrderCodes = (
  orderId: string
): { codigoPedido: string; codigoCurto: string } => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  // Mesmo trecho do id usado na exibição (primeiros 6 caracteres)
  const codigoCurto = orderId.substring(0, 6);
  const codigoPedido = `PED-${datePart}-${orderId.substring(0, 8).toUpperCase()}`;
  return { codigoPedido, codigoCurto };
};



// Criar um novo pedido
export const createOrder = async (
  orderData: CreateOrderRequest
): Promise<Order> => {
  console.log("=== CRIANDO PEDIDO (Supabase) ===");

  let total = 0;

  const orderItems = await Promise.all(
    orderData.items.map(async (item) => {
      const itemQty = item.quantity ?? 1;
      const isHalfPizza = !!item.isHalfPizza;

      const baseUnitPrice = isHalfPizza
        ? (item.combination?.price ?? item.price ?? 0)
        : (item.priceFrom ? 0 : (item.price ?? 0));

      let itemTotal = baseUnitPrice * itemQty;

      const processedVariations: any[] = [];
      if (item.selectedVariations && Array.isArray(item.selectedVariations)) {
        for (const group of item.selectedVariations) {
          const processedGroup = {
            groupId: group.groupId ?? null,
            groupName: group.groupName || group.groupId || "",
            variations: [] as any[],
          };

          if (group.variations && Array.isArray(group.variations)) {
            for (const variation of group.variations) {
              const variationAny = variation as any;
              const rawVariationId =
                variation.variationId ??
                variationAny.id ??
                variationAny.variation_id ??
                null;
              const variationId = rawVariationId ? String(rawVariationId) : null;

              let additionalPrice = variation.additionalPrice;
              if (additionalPrice === undefined && variationId) {
                additionalPrice = await getVariationPrice(variationId);
              }
              additionalPrice = additionalPrice ?? 0;

              const variationQty = variation.quantity ?? 1;
              const halfSel = variationAny.halfSelection ?? null;
              const halfMultiplier = isHalfPizza && halfSel === "whole" ? 2 : 1;

              const variationCost =
                additionalPrice * variationQty * halfMultiplier * itemQty;
              if (variationCost > 0) itemTotal += variationCost;

              processedGroup.variations.push({
                variationId,
                quantity: variationQty,
                name: variation.name || "",
                additionalPrice,
                halfSelection: halfSel,
              });
            }
          }

          if (processedGroup.variations.length > 0) {
            processedVariations.push(processedGroup);
          }
        }
      }

      const selectedBorder = (item as any).selectedBorder;
      if (selectedBorder && selectedBorder.additionalPrice > 0) {
        itemTotal += selectedBorder.additionalPrice * itemQty;
      }

      total += itemTotal;

      const giftProductId = (item as any).__couponGiftId || null;
      const isGift = !!giftProductId || (item as any).category === "brinde";

      const selectedSize = (item as any).selectedSize || null;

      return {
        menuItemId: item.menuItemId ?? (item as any).id ?? null,
        name: item.name,
        price: baseUnitPrice,
        quantity: itemQty,
        selectedVariations: processedVariations,
        priceFrom: item.priceFrom || false,
        isHalfPizza,
        combination: item.combination || null,
        selectedBorder: selectedBorder || null,
        selectedSize,
        subtotal: itemTotal,
        isGift,
        giftProductId,
      };
    })
  );

  // Usuário autenticado (Supabase Auth)
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id ?? null;

  const nowIso = new Date().toISOString();

  // Gera o id do pedido no cliente para que os códigos salvos sejam
  // derivados do MESMO id exibido no app (evita códigos divergentes)
  const orderId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { codigoPedido, codigoCurto } = generateOrderCodes(orderId);

  const insertPayload: any = {
    id: orderId,
    codigo_pedido: codigoPedido,
    codigo_curto: codigoCurto,
    nome_cliente: orderData.customerName,
    telefone_cliente: phoneDigitsBr(orderData.customerPhone) || null,
    user_id: currentUserId,
    user_name: orderData.userName ?? currentUser?.user_metadata?.name ?? null,
    user_email: orderData.userEmail ?? currentUser?.email ?? null,
    endereco_entrega: orderData.address,
    bairro: orderData.bairro ?? null,
    cidade: orderData.cidade ?? null,
    metodo_pagamento: orderData.paymentMethod,
    observacoes: orderData.observations ?? "",
    itens: orderItems,
    status_atual: orderData.status ?? "pending",
    subtotal: orderData.subtotal ?? total,
    frete: orderData.frete ?? 0,
    valor_total: orderData.total ?? total,
    desconto: orderData.discount ?? 0,
    cupom_desconto: orderData.couponCode ?? null,
    utm_source: orderData.utm_source ?? null,
    utm_medium: orderData.utm_medium ?? null,
    utm_campaign: orderData.utm_campaign ?? null,
    utm_content: orderData.utm_content ?? null,
    utm_term: orderData.utm_term ?? null,
    origem: "delivery",
    criado_em: nowIso,
    data_criacao: nowIso,
    atualizado_em: nowIso,
    atualizado_em_banco: nowIso,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar pedido:", error);
    throw error;
  }

  // Decrementa estoque dos itens vendidos (ignora itens sem estoque controlado)
  try {
    const aggregated = new Map<string, number>();
    for (const it of orderItems) {
      const id = (it as any).menuItemId;
      if (!id) continue;
      aggregated.set(id, (aggregated.get(id) || 0) + (it.quantity || 0));
    }
    await Promise.all(
      Array.from(aggregated.entries()).map(([itemId, qty]) =>
        (supabase as any).rpc("decrement_menu_item_stock", {
          _item_id: itemId,
          _qty: qty,
        })
      )
    );
  } catch (stockErr) {
    console.error("Erro ao baixar estoque:", stockErr);
  }

  return rowToOrder(data);
};

// Obter um pedido pelo ID
export const getOrderById = async (orderId: string): Promise<Order | null> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao obter pedido:", error);
    throw error;
  }
  return data ? rowToOrder(data) : null;
};

// Obter pedidos por número de telefone
export const getOrdersByPhone = async (phone: string): Promise<Order[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("telefone_cliente", phone)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("Erro ao obter pedidos por telefone:", error);
    throw error;
  }
  return (data ?? []).map(rowToOrder);
};

// Obter todos os pedidos de hoje com filtro opcional de status
export const getTodayOrders = async (status?: string): Promise<Order[]> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let query = supabase
    .from(TABLE)
    .select("*")
    .gte("criado_em", today.toISOString())
    .order("criado_em", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status_atual", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao obter pedidos do dia:", error);
    throw error;
  }
  return (data ?? []).map(rowToOrder);
};

// Obter pedidos por intervalo de datas e status opcional
export const getOrdersByDateRange = async (
  startDate: Date,
  endDate: Date,
  status?: string
): Promise<Order[]> => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  let query = supabase
    .from(TABLE)
    .select("*")
    .gte("criado_em", start.toISOString())
    .lte("criado_em", end.toISOString())
    .order("criado_em", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status_atual", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao obter pedidos por intervalo de datas:", error);
    throw error;
  }
  return (data ?? []).map(rowToOrder);
};

// Atualizar um pedido
export const updateOrder = async (
  orderId: string,
  updates: UpdateOrderRequest
): Promise<Order | null> => {
  // Carrega estado anterior (para detectar transição -> delivered)
  const previous = await getOrderById(orderId);
  if (!previous) return null;

  const updatePayload: any = {
    atualizado_em: new Date().toISOString(),
    atualizado_em_banco: new Date().toISOString(),
  };
  if (updates.status !== undefined) updatePayload.status_atual = updates.status;
  if (updates.paymentStatus !== undefined) updatePayload.payment_status = updates.paymentStatus;
  if ((updates as any).cancellationReason !== undefined) {
    updatePayload.motivo_cancelamento = (updates as any).cancellationReason;
  }

  const { error } = await supabase
    .from(TABLE)
    .update(updatePayload)
    .eq("id", orderId);

  if (error) {
    console.error("Erro ao atualizar pedido:", error);
    throw error;
  }

  // Verificar fidelidade na transição para "delivered"
      if (updates.status === "delivered" && previous.status !== "delivered") {
        try {
          const customerName = previous.customerName || "";
          const customerPhone = previous.customerPhone || "";
          const items = previous.items || [];
          if (customerPhone && items.length > 0) {
            console.log("🍕 Pedido entregue! Verificando fidelidade...");
            await verificarFidelidade(customerName, customerPhone, items, previous.userId);
          }
        } catch (fidelidadeError) {
          console.error("Erro ao verificar fidelidade na entrega:", fidelidadeError);
        }
      }

  return getOrderById(orderId);
};
