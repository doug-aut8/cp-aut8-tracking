

import { createOrder, getOrderById, getOrdersByPhone, updateOrder } from "@/services/orderService";
import { CreateOrderRequest, UpdateOrderRequest } from "@/types/order";

// Função para verificar token de API
const verifyApiKey = (apiKey: string): boolean => {
  // Para fins de demonstração, usamos uma chave fixa
  // Em produção, você deve armazenar isso de forma segura (como no Firestore)
  const VALID_API_KEY = "mex-food-api-12345";
  return apiKey === VALID_API_KEY;
};

// Handler para pedidos via API
export const handleApiRequest = async (endpoint: string, method: string, data: any, headers: any): Promise<any> => {
  // Verificar API key
  const apiKey = headers["x-api-key"];
  if (!apiKey || !verifyApiKey(apiKey)) {
    throw new Error("Chave de API inválida ou ausente");
  }

  // Roteamento de endpoints
  switch (endpoint) {
    case "/api/orders":
      if (method === "POST") {
        return createOrder(data as CreateOrderRequest);
      } else if (method === "GET") {
        if (data.phone) {
          return getOrdersByPhone(data.phone);
        }
        throw new Error("Parâmetros insuficientes para buscar pedidos");
      }
      break;
    
    case "/api/orders/status":
      if (method === "PUT" && data.orderId) {
        return updateOrder(data.orderId, data.updates as UpdateOrderRequest);
      }
      break;
      
    case "/api/orders/detail":
      if (method === "GET" && data.orderId) {
        return getOrderById(data.orderId);
      }
      break;
      
    default:
      throw new Error(`Endpoint não encontrado: ${endpoint}`);
  }
  
  throw new Error(`Método ${method} não suportado para ${endpoint}`);
};
