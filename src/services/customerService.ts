import { supabase } from '@/integrations/supabase/client';
import { phoneVariants, phoneDigitsBr } from '@/utils/phoneUtils';

export interface CustomerData {
  id?: string;
  name: string;
  phone: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
}

// Salvar ou atualizar dados do cliente
export const saveCustomerData = async (customerData: CustomerData): Promise<CustomerData | null> => {
  try {
    console.log('Salvando dados do cliente:', customerData);
    
    if (!customerData.name || !customerData.phone) {
      console.error('Nome e telefone são obrigatórios');
      return null;
    }

    // Normaliza o telefone para o formato padrão (somente dígitos: 5511912345678)
    customerData = { ...customerData, phone: phoneDigitsBr(customerData.phone) || customerData.phone };

    // Verificar se já existe um cliente com esse telefone
    const { data: existingCustomer, error: searchError } = await supabase
      .from('customer_data')
      .select('*')
      .eq('phone', customerData.phone)
      .maybeSingle();

    if (searchError) {
      console.error('Erro ao buscar cliente existente:', searchError);
      return null;
    }

    if (existingCustomer) {
      // Atualizar cliente existente
      const { data, error } = await supabase
        .from('customer_data')
        .update({
          name: customerData.name,
          cep: customerData.cep || null,
          street: customerData.street || null,
          number: customerData.number || null,
          complement: customerData.complement || null,
          neighborhood: customerData.neighborhood || null,
          city: customerData.city || null,
          state: customerData.state || null,
        })
        .eq('id', existingCustomer.id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar cliente:', error);
        return null;
      }

      console.log('Cliente atualizado com sucesso:', data);
      return data;
    } else {
      // Vincula o registro à conta logada (quando houver sessão).
      // O id vem da sessão do Supabase, nunca de dados do formulário.
      const { data: { user } } = await supabase.auth.getUser();

      // Criar novo cliente
      const { data, error } = await supabase
        .from('customer_data')
        .insert({
          name: customerData.name,
          phone: customerData.phone,
          user_id: user?.id ?? null,
          cep: customerData.cep || null,
          street: customerData.street || null,
          number: customerData.number || null,
          complement: customerData.complement || null,
          neighborhood: customerData.neighborhood || null,
          city: customerData.city || null,
          state: customerData.state || null,
        })
        .select()
        .single();


      if (error) {
        console.error('Erro ao criar cliente:', error);
        return null;
      }

      console.log('Cliente criado com sucesso:', data);
      return data;
    }
  } catch (error) {
    console.error('Erro ao salvar dados do cliente:', error);
    return null;
  } finally {
    // Espelhar endereço na tabela users (usada por admin-metrics: Top 5 bairros)
    try {
      const variants = phoneVariants(customerData.phone);
      if (variants.length > 0) {
        const addressPayload = {
          name: customerData.name,
          cep: customerData.cep || null,
          rua: customerData.street || null,
          numero: customerData.number || null,
          complemento: customerData.complement || null,
          bairro: customerData.neighborhood || null,
          cidade: customerData.city || null,
        };
        const { data: usersFound, error: usersErr } = await supabase
          .from('users')
          .select('id')
          .in('phone', variants);
        if (!usersErr && usersFound && usersFound.length > 0) {
          await supabase
            .from('users')
            .update(addressPayload as any)
            .in('id', usersFound.map((u: any) => u.id));
        }
      }
    } catch (err) {
      console.error('Erro ao espelhar endereço em users:', err);
    }
  }
};

// Buscar dados do cliente por telefone
export const getCustomerByPhone = async (phone: string): Promise<CustomerData | null> => {
  try {
    console.log('Buscando cliente por telefone:', phone);

    if (!phone) {
      console.error('Telefone não fornecido');
      return null;
    }

    const variants = phoneVariants(phone);
    if (variants.length === 0) return null;

    const { data, error } = await supabase
      .from('customer_data')
      .select('*')
      .in('phone', variants)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar cliente:', error);
      return null;
    }

    if (data) {
      console.log('Cliente encontrado:', data);
      return data;
    }
    console.log('Cliente não encontrado');
    return null;
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    return null;
  }
};