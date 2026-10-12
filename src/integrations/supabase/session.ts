// Sessão de login unificada: um único listener de auth para toda a aplicação.
// Evita chamadas repetidas de getUser()/getSession() (cada uma pode disparar
// renovação de token) espalhadas pelos serviços e componentes.
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './client';

let cachedSession: Session | null = null;
let ready: Promise<Session | null> | null = null;

function init(): Promise<Session | null> {
  if (!ready) {
    supabase.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
    });
    ready = supabase.auth.getSession().then(({ data: { session } }) => {
      cachedSession = session;
      return session;
    });
  }
  return ready;
}

// Inicia assim que o módulo é importado.
init();

/** Sessão atual (aguarda apenas a primeira leitura; depois é síncrona/cacheada). */
export async function getSessionOnce(): Promise<Session | null> {
  await init();
  return cachedSession;
}

/** Usuário atual, sem round-trip extra na rede. */
export async function getCurrentUser(): Promise<User | null> {
  return (await getSessionOnce())?.user ?? null;
}

/** ID do usuário atual, ou null. */
export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

/** Leitura síncrona (pode ser null antes da sessão inicial resolver). */
export function peekUserId(): string | null {
  return cachedSession?.user?.id ?? null;
}
