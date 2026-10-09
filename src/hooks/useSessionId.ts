// src/hooks/useSessionId.ts
import { useState } from "react";
import { getSessionId } from "@/utils/sessionId";

/**
 * Hook React para obter o sessionId da aba atual.
 */
export function useSessionId() {
  const [sessionId] = useState<string>(() => getSessionId());
  return sessionId;
}
