import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "@/hooks/use-toast";
import { getOrderById } from "@/services/orderService";
import { printOrderWithCategories } from "@/utils/printUtils";

const PRINTED_ORDERS_KEY = "auto_printed_order_ids";
const ADMIN_ROLES = ["admin", "moderator", "super-admin"];

const getPrintedIds = (): Set<string> => {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(PRINTED_ORDERS_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
const markPrinted = (id: string) => {
  const ids = getPrintedIds();
  ids.add(id);
  sessionStorage.setItem(PRINTED_ORDERS_KEY, JSON.stringify(Array.from(ids).slice(-200)));
};

/**
 * Monitor global de novos pedidos para perfis administrativos.
 * Toca som, imprime automaticamente e exibe toast em qualquer tela.
 */
export const useAdminOrderWatcher = () => {
  const { role } = useUserRole();
  const enabled = !!role && ADMIN_ROLES.includes(role);

  const settings = useRef({ autoPrint: true, soundEnabled: false, soundUrl: "" });

  useEffect(() => {
    if (!enabled) return;

    const loadSettings = () =>
      supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", ["auto_print_on_new_order", "som_novo_pedido_enabled", "som_novo_pedido_url"])
        .then(({ data }) => {
          (data ?? []).forEach((row: any) => {
            if (row.chave === "auto_print_on_new_order") settings.current.autoPrint = row.valor !== "false";
            if (row.chave === "som_novo_pedido_enabled") settings.current.soundEnabled = row.valor === "true";
            if (row.chave === "som_novo_pedido_url") settings.current.soundUrl = row.valor ?? "";
          });
        });
    loadSettings();

    const channel = supabase
      .channel("global-admin-order-watcher")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos_sabor_delivery" },
        (payload) => {
          const row: any = payload.new;
          if (!row?.id) return;
          const createdAt = new Date(row.criado_em ?? Date.now());
          if (Date.now() - createdAt.getTime() > 60000) return;
          if (getPrintedIds().has(row.id)) return;
          markPrinted(row.id);

          const s = settings.current;
          if (s.soundEnabled && s.soundUrl) {
            try {
              new Audio(s.soundUrl).play().catch((e) => console.warn("Som do pedido bloqueado:", e));
            } catch (e) {
              console.warn("Som do pedido falhou:", e);
            }
          }

          toast({
            title: "Novo pedido recebido!",
            description: `Cliente: ${row.nome_cliente ?? ""}`,
          });

          if (s.autoPrint) {
            getOrderById(row.id)
              .then((full) => { if (full) printOrderWithCategories(full); })
              .catch((e) => console.error("Erro ao imprimir pedido automaticamente:", e));
          }
        }
      )
      .subscribe();

    // Recarrega configurações a cada 2 min para refletir mudanças.
    const interval = setInterval(loadSettings, 120000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [enabled]);
};
