
import { Order } from "@/types/order";

// Definir a sequência natural dos status
const STATUS_SEQUENCE: Order["status"][] = [
  "pending",
  "confirmed", 
  "preparing",
  "ready",
  "delivering",
  "delivered"
];

// Sequência específica para desconto em folha
const PAYROLL_DISCOUNT_SEQUENCE: Order["status"][] = [
  "pending",
  "confirmed", 
  "preparing",
  "ready",
  "to_deduct",
  "paid",
  "delivered"
];

// Obter próximos status possíveis com base no status atual
export const getNextStatusOptions = (
  currentStatus: Order["status"], 
  hasReceivedPayment: boolean = false,
  paymentMethod?: Order["paymentMethod"]
): Order["status"][] => {
  // Se o pedido está cancelado ou entregue, não há próximos status
  if (currentStatus === "cancelled" || currentStatus === "delivered") {
    return [];
  }

  const nextStatuses: Order["status"][] = [];

  // Lógica específica para desconto em folha
  if (paymentMethod === "payroll_discount") {
    switch (currentStatus) {
      case "pending":
        nextStatuses.push("confirmed", "cancelled");
        break;
      case "confirmed":
        nextStatuses.push("preparing", "cancelled");
        break;
      case "preparing":
        nextStatuses.push("ready", "cancelled");
        break;
      case "ready":
        nextStatuses.push("to_deduct", "cancelled");
        break;
      case "to_deduct":
        nextStatuses.push("paid", "cancelled");
        break;
      case "paid":
        nextStatuses.push("delivered", "cancelled");
        break;
      default:
        nextStatuses.push("cancelled");
    }
    return nextStatuses;
  }

  // Lógica para outras formas de pagamento
  switch (currentStatus) {
    case "pending":
      nextStatuses.push("confirmed", "cancelled");
      break;
    case "confirmed":
      nextStatuses.push("preparing", "cancelled");
      break;
    case "preparing":
      nextStatuses.push("ready", "cancelled");
      break;
    case "ready":
      nextStatuses.push("delivering", "cancelled");
      break;
    case "delivering":
      nextStatuses.push("delivered", "cancelled");
      break;
    case "received":
      // Status "received" é independente - pode ir para "delivered"
      nextStatuses.push("delivered", "cancelled");
      break;
    default:
      break;
  }

  return nextStatuses;
};

// Verificar se um status pode ser aplicado ao pedido atual
export const canTransitionToStatus = (
  currentStatus: Order["status"],
  targetStatus: Order["status"],
  hasReceivedPayment: boolean = false,
  paymentMethod?: Order["paymentMethod"]
): boolean => {
  const allowedNextStatuses = getNextStatusOptions(currentStatus, hasReceivedPayment, paymentMethod);
  return allowedNextStatuses.includes(targetStatus);
};

// Obter o próximo status na sequência natural
export const getNextNaturalStatus = (currentStatus: Order["status"]): Order["status"] | null => {
  const currentIndex = STATUS_SEQUENCE.indexOf(currentStatus);
  
  if (currentIndex === -1 || currentIndex === STATUS_SEQUENCE.length - 1) {
    return null;
  }
  
  return STATUS_SEQUENCE[currentIndex + 1];
};

// Verificar se o pedido já recebeu pagamento (agora baseado no paymentStatus)
export const hasReceivedPayment = (order: Order): boolean => {
  // Verificar se o paymentStatus é "recebido" ou se o método de pagamento é cartão
  return order.paymentStatus === "recebido" || 
         order.paymentMethod === "card";
};
