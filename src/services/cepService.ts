
import { supabase } from "@/integrations/supabase/client";

export interface CepResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
}

export async function fetchAddressByCep(cep: string): Promise<CepResponse> {
  // Remove any non-numeric characters
  const cleanCep = cep.replace(/\D/g, '');
  
  if (cleanCep.length !== 8) {
    throw new Error('CEP deve ter 8 dígitos');
  }
  
  const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
  
  if (!response.ok) {
    throw new Error('CEP não encontrado');
  }
  
  return await response.json();
}

export async function isDeliveryAreaValid(cep: string): Promise<boolean> {
  // Remove any non-numeric characters
  const cleanCep = cep.replace(/\D/g, '');
  
  if (cleanCep.length !== 8) {
    return false;
  }
  
  // Query the faixas_ceps_atendidos table to check if the CEP is within any range
  const { data, error } = await supabase
    .from('faixas_ceps_atendidos' as any)
    .select('*')
    .lte('cep_inicio', cleanCep)
    .gte('cep_fim', cleanCep);
  
  if (error) {
    console.error("Error checking delivery area:", error);
    return false;
  }
  
  // If we found at least one matching range, the CEP is valid for delivery
  return data && data.length > 0;
}
