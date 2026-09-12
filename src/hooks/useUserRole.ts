import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedUserId = useRef<string | null>(null);

  const userId = currentUser?.id ?? null;

  useEffect(() => {
    const getUserRole = async () => {
      if (authLoading) return;

      if (!userId) {
        lastFetchedUserId.current = null;
        setRole(null);
        setLoading(false);
        return;
      }

      // Evita recarregar a role quando o Supabase apenas renova o token
      // (mesmo usuário, novo objeto de sessão).
      if (lastFetchedUserId.current === userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (error) {
          console.error("Erro ao buscar role no Supabase:", error);
          setRole("user");
        } else {
          const roles = (data ?? []).map((r: any) => r.role as string);
          const priority = ["super-admin", "admin", "moderator", "user"];
          const best = priority.find((p) => roles.includes(p)) ?? "user";
          console.log("Roles encontradas:", roles, "→", best);
          setRole(best);
        }
        lastFetchedUserId.current = userId;
      } catch (err) {
        console.error("Erro ao consultar role:", err);
        setRole("user");
      } finally {
        setLoading(false);
      }
    };

    getUserRole();
  }, [userId, authLoading]);

  return {
    role,
    loading,
    isAdmin: role === "admin" || role === "super-admin",
    isSuperAdmin: role === "super-admin",
  };
};
