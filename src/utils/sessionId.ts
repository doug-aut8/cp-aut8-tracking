// src/utils/sessionId.ts
/**
 * Identidade do visitante e da sessão.
 *
 * - visitor_id: UUID persistente em localStorage. Identifica o navegador/dispositivo
 *   ao longo do tempo (mesmo após fechar a aba ou reload).
 * - session_id: UUID renovado após SESSION_TIMEOUT_MS de inatividade (sliding window).
 *   Reload dentro da janela mantém a mesma sessão.
 *
 * Janela: 30 minutos (padrão GA4).
 */

const VISITOR_KEY = "lov_visitor_id";
const SESSION_KEY = "lov_session_id";
const SESSION_LAST_ACTIVITY_KEY = "lov_session_last_activity";

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Gera um UUID seguro.
 */
function generateId(): string {
  if (typeof window !== "undefined" && window.crypto && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
}

function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

/**
 * Retorna o visitor_id persistente (cria se não existir).
 */
export function getVisitorId(): string {
  let id = safeLocalGet(VISITOR_KEY);
  if (!id) {
    id = generateId();
    safeLocalSet(VISITOR_KEY, id);
  }
  return id;
}

/**
 * Resultado da resolução de sessão.
 */
export interface SessionInfo {
  sessionId: string;
  /** True se uma nova sessão foi criada agora (primeira visita ou janela expirou). */
  isNewSession: boolean;
  /** True se o visitor_id já existia antes desta chamada. */
  isReturningVisitor: boolean;
}

/**
 * Resolve a sessão atual aplicando a regra de sliding window.
 * Atualiza o timestamp de última atividade.
 */
export function resolveSession(): SessionInfo {
  const hadVisitor = safeLocalGet(VISITOR_KEY) !== null;
  getVisitorId(); // garante criação

  const now = Date.now();
  const existingSession = safeLocalGet(SESSION_KEY);
  const lastActivityRaw = safeLocalGet(SESSION_LAST_ACTIVITY_KEY);
  const lastActivity = lastActivityRaw ? parseInt(lastActivityRaw, 10) : 0;

  const expired = !existingSession || !lastActivity || (now - lastActivity) > SESSION_TIMEOUT_MS;

  let sessionId: string;
  let isNewSession: boolean;

  if (expired) {
    sessionId = generateId();
    safeLocalSet(SESSION_KEY, sessionId);
    isNewSession = true;
  } else {
    sessionId = existingSession!;
    isNewSession = false;
  }

  safeLocalSet(SESSION_LAST_ACTIVITY_KEY, String(now));

  return {
    sessionId,
    isNewSession,
    isReturningVisitor: hadVisitor,
  };
}

/**
 * Retorna apenas o sessionId atual, renovando se necessário e atualizando atividade.
 * Mantido por compatibilidade com chamadas existentes.
 */
export function getSessionId(): string {
  return resolveSession().sessionId;
}
