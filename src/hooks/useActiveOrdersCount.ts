import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { phoneVariants } from "@/utils/phoneUtils";
import { getProfile } from "@/services/profileService";

export const useActiveOrdersCount = () => {
  const { currentUser } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setCount(0);
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const profileData = await getProfile(currentUser.id);

        let phone = profileData?.phone || currentUser.phoneNumber;
        if (!phone && currentUser.email) {
          const { data: customerData } = await supabase
            .from("customer_data")
            .select("phone")
            .eq("name", currentUser.displayName || currentUser.email)
            .maybeSingle();
          phone = customerData?.phone;
        }

        const variants = phone ? phoneVariants(phone) : [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const fetchCount = async () => {
          let q = supabase
            .from("pedidos_sabor_delivery")
            .select("id, status_atual", { count: "exact" })
            .gte("criado_em", today.toISOString())
            .not("status_atual", "in", '("delivered","cancelled")');

          if (variants.length > 0) {
            q = q.or(
              `user_id.eq.${currentUser.id},telefone_cliente.in.(${variants
                .slice(0, 30)
                .map((v) => `"${v}"`)
                .join(",")})`
            );
          } else {
            q = q.eq("user_id", currentUser.id);
          }

          const { data, error } = await q;
          if (error) {
            console.error("useActiveOrdersCount erro:", error);
            return;
          }
          if (!cancelled) setCount((data ?? []).length);
        };

        await fetchCount();

        if (cancelled) return;

        channel = supabase
          .channel(`active-orders-${currentUser.id}-${Math.random().toString(36).slice(2, 10)}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "pedidos_sabor_delivery" },
            () => fetchCount()
          )
          .subscribe();
      } catch (e) {
        console.error("useActiveOrdersCount erro:", e);
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUser]);

  return count;
};
