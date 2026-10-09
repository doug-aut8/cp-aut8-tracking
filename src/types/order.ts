
export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  categoryName?: string;
  itemObservation?: string;
  selectedVariations?: SelectedVariationGroup[];
  priceFrom?: boolean;
  subtotal?: number;
  isHalfPizza?: boolean;
  combination?: any;
  selectedBorder?: {
    id: string;
    name: string;
    additionalPrice: number;
  };
  selectedSize?: {
    id: string;
    name: string;
    price: number;
  };
}

export interface SelectedVariationGroup {
  groupId: string;
  groupName: string;
  variations: SelectedVariation[];
}

export interface SelectedVariation {
  variationId: string;
  quantity: number;
  name?: string;
  additionalPrice?: number;
}

export interface Order {
  id: string;
  userId?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  paymentMethod: "card" | "cash" | "pix" | "payroll_discount" | "pix_mesa" | "cobranca_mesa";
  observations?: string;
  items: OrderItem[];
  status: "pending" | "confirmed" | "preparing" | "ready" | "delivering" | "received" | "delivered" | "cancelled" | "to_deduct" | "paid" | "completed";
  paymentStatus?: "a_receber" | "recebido";
  total: number;
  subtotal?: number;
  frete?: number;
  discount?: number;
  couponCode?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  cancellationReason?: string;
  changeFor?: number | null;
  origem?: string | null;
  mesa?: string | null;
  dataNascimento?: string | null;
  aniversario?: string | null;
}

export interface CreateOrderRequest {
  customerName: string;
  customerPhone: string;
  address: string;
  bairro?: string;
  cidade?: string;
  paymentMethod: "card" | "cash" | "pix" | "payroll_discount" | "pix_mesa" | "cobranca_mesa";
  observations?: string;
  status?: "pending" | "confirmed" | "preparing" | "ready" | "delivering" | "received" | "delivered" | "cancelled" | "to_deduct" | "paid" | "completed";
  items: {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    itemObservation?: string;
    selectedVariations?: SelectedVariationGroup[];
    selectedBorder?: {
      id: string;
      name: string;
      additionalPrice: number;
    } | null;
    selectedSize?: {
      id: string;
      name: string;
      price: number;
    } | null;
    priceFrom?: boolean;
    subtotal?: number;
    isHalfPizza?: boolean;
    combination?: any;
  }[];
  total?: number;
  subtotal?: number;
  frete?: number;
  discount?: number;
  couponCode?: string | null;
  firebaseId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  trocoPara?: number | null;
  origem?: string;
  mesa?: string | null;
  dataNascimento?: string | null;
  /** Dia e mês no formato DD/MM (sem ano). */
  aniversario?: string | null;
}

export interface UpdateOrderRequest {
  status?: "pending" | "confirmed" | "preparing" | "ready" | "delivering" | "received" | "delivered" | "cancelled" | "to_deduct" | "paid" | "completed";
  paymentStatus?: "a_receber" | "recebido";
}
