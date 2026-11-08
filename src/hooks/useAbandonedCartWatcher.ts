import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { trackAbandonedCart } from "@/utils/trackingEvents";
import { fireAbandonedCartWebhook } from "@/utils/abandonedCartWebhook";

const ACTIVITY_KEY = "lov_cart_last_activity";
const FIRED_KEY = "lov_abandoned_cart_fired_at";
const DEFAULT_MINUTES = 25;
const CHECK_INTERVAL_MS = 10_000;

const readNumber = (key: string): number => {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const writeNumber = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
};

const clearKey = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

/**
 * Observa o carrinho em toda a aplicação e dispara o evento "abandoned_cart"
 * (+ o Webhook Eventos) quando o carrinho fica inativo pelo tempo configurado
 * em "tempo_disparo_abandoned_cart".
 *
 * A contagem é baseada em timestamp persistido no localStorage, então continua
 * valendo mesmo se o usuário sair do checkout, navegar por outras páginas,
 * recarregar ou fechar e reabrir a aba.
 */
export const useAbandonedCartWatcher = () => {
  const { cartItems, finalTotal } = useCart();
  const { currentUser } = useAuth();

  const abandonMsRef = useRef<number>(DEFAULT_MINUTES * 60 * 1000);
  const cartRef = useRef(cartItems);
  const totalRef = useRef(finalTotal);
  const userRef = useRef(currentUser);
  const firingRef = useRef(false);

  cartRef.current = cartItems;
  totalRef.current = finalTotal;
  userRef.current = currentUser;

  // Carrega o tempo configurado (minutos)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("configuracoes")
          .select("valor")
          .eq("chave", "tempo_disparo_abandoned_cart")
          .maybeSingle();
        const minutes = parseFloat(data?.valor || "");
        if (!isNaN(minutes) && minutes > 0) abandonMsRef.current = minutes * 60 * 1000;
      } catch {
        // mantém o padrão
      }
    })();
  }, []);

  // Marca atividade sempre que o conteúdo do carrinho muda
  const signature = cartItems.map((i) => `${i.id}:${i.quantity}`).join("|");
  useEffect(() => {
    if (cartItems.length === 0) {
      clearKey(ACTIVITY_KEY);
      clearKey(FIRED_KEY);
      return;
    }
    writeNumber(ACTIVITY_KEY, Date.now());
    clearKey(FIRED_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Verifica periodicamente (e ao voltar para a aba) se o tempo expirou
  useEffect(() => {
    const check = () => {
      if (firingRef.current) return;
      const items = cartRef.current;
      if (!items || items.length === 0) return;
      if (readNumber(FIRED_KEY) > 0) return;

      const last = readNumber(ACTIVITY_KEY);
      if (!last) {
        writeNumber(ACTIVITY_KEY, Date.now());
        return;
      }
      if (Date.now() - last < abandonMsRef.current) return;

      firingRef.current = true;
      writeNumber(FIRED_KEY, Date.now());
      try {
        trackAbandonedCart([...items], totalRef.current);
        fireAbandonedCartWebhook(userRef.current);
      } catch (e) {
        console.error("Erro ao disparar abandoned_cart:", e);
      } finally {
        firingRef.current = false;
      }
    };

    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
};

/** Chamar ao finalizar um pedido para cancelar a contagem de abandono. */
export const resetAbandonedCartTimer = () => {
  clearKey(ACTIVITY_KEY);
  clearKey(FIRED_KEY);
};
