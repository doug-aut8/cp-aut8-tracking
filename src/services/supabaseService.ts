//supabaseService.ts
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export interface UserProfile {
  id: string; // ID do Firebase
  uuid?: string; // UUID compatível com Supabase
  email: string;
  created_at?: string;
  last_sign_in?: string;
  name?: string;
  phone?: string;
  firebase_id?: string;
}

// Função para gerar um UUID válido a partir de um ID do Firebase
function generateUUID(firebaseId: string): string {
  // Se já for um UUID válido, retorna o mesmo
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(firebaseId)) {
    return firebaseId;
  }
  
  // Caso contrário, gera um novo UUID
  return uuidv4();
}

// Função para salvar um novo usuário no Supabase
export async function saveUserToSupabase(user: UserProfile) {
  try {
    console.log('Salvando usuário no Supabase:', user);
    
    // Verificar se o usuário foi fornecido com todos os dados obrigatórios
    if (!user.id || !user.email) {
      console.error('Erro: ID e email são obrigatórios para salvar usuário');
      return null;
    }
    
    // Gerar UUID compatível com Supabase se não foi fornecido
    const uuid = user.uuid || generateUUID(user.id);
    
    const userData = {
      id: uuid, // Usar UUID compatível com Supabase
      user_id: user.id, // ID do Firebase para auth.uid()
      firebase_id: user.id, // Armazenar o ID original do Firebase
      email: user.email,
      created_at: user.created_at || new Date().toISOString(),
      last_sign_in_at: user.last_sign_in || new Date().toISOString(),
      name: user.name || null,
      phone: user.phone || null
    };
    
    console.log('Dados formatados para inserção:', userData);
    
    // Tenta inserir o usuário na tabela users
    const { data, error } = await supabase
      .from('users')
      .upsert(userData, { onConflict: 'id' });

    if (error) {
      console.error('Erro ao salvar usuário no Supabase:', error);
      return null;
    }

    console.log('Usuário salvo com sucesso no Supabase:', data);
    return data;
  } catch (error) {
    console.error('Erro ao conectar com Supabase:', error);
    return null;
  }
}

// Função para buscar um usuário por ID do Firebase
export async function getUserByFirebaseId(firebaseId: string) {
  try {
    console.log('Buscando usuário no Supabase com Firebase ID:', firebaseId);
    
    if (!firebaseId) {
      console.error('ID de usuário não fornecido');
      return null;
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_id', firebaseId)
      .single();

    if (error) {
      // Se o erro for "não encontrado", não é um erro crítico, apenas não encontrou
      if (error.code === 'PGRST116') {
        console.log('Usuário não encontrado no Supabase.');
        return null;
      }
      
      console.error('Erro ao buscar usuário no Supabase:', error);
      return null;
    }

    console.log('Usuário encontrado no Supabase:', data);
    return data as UserProfile;
  } catch (error) {
    console.error('Erro ao conectar com Supabase:', error);
    return null;
  }
}

// Função para atualizar o último login de um usuário
export async function updateUserLastSignIn(firebaseId: string) {
  try {
    console.log('Atualizando último login para usuário Firebase ID:', firebaseId);
    
    if (!firebaseId) {
      console.error('ID de usuário não fornecido');
      return false;
    }
    
    // Primeiro precisamos obter o UUID do Supabase correspondente ao Firebase ID
    const user = await getUserByFirebaseId(firebaseId);
    
    if (!user) {
      console.log('Usuário não encontrado, não é possível atualizar o último login');
      return false;
    }
    
    const { error } = await supabase
      .from('users')
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq('id', user.id);
      
    if (error) {
      console.error('Erro ao atualizar último login:', error);
      return false;
    }
    
    console.log('Último login atualizado com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao conectar com Supabase para atualizar login:', error);
    return false;
  }
}

// Função auxiliar para buscar um usuário por UUID do Supabase
export async function getUserById(uuid: string) {
  try {
    console.log('Buscando usuário no Supabase com UUID:', uuid);
    
    if (!uuid) {
      console.error('UUID não fornecido');
      return null;
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', uuid)
      .single();

    if (error) {
      console.error('Erro ao buscar usuário no Supabase por UUID:', error);
      return null;
    }

    console.log('Usuário encontrado no Supabase por UUID:', data);
    return data as UserProfile;
  } catch (error) {
    console.error('Erro ao conectar com Supabase:', error);
    return null;
  }
}

export default supabase;
