import { useState, useEffect } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Capture recovery before the Supabase client clears the URL fragment.
const recoveryFromUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';

// Compatibility shim: expose Firebase-style fields (uid, displayName, phoneNumber)
// derived from Supabase user, so existing components work without refactor.
export type AuthUser = User & {
  uid: string;
  displayName: string | null;
  phoneNumber: string | null;
};

function toAuthUser(u: User | null | undefined): AuthUser | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, any>;
  return Object.assign({}, u, {
    uid: u.id,
    displayName: (meta.name ?? meta.full_name ?? meta.displayName ?? null) as string | null,
    phoneNumber: (meta.phone ?? u.phone ?? null) as string | null,
  }) as AuthUser;
}

export function useAuthState() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(recoveryFromUrl);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (_event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
        if (_event === "SIGNED_OUT") setIsPasswordRecovery(false);
        setSession(newSession);
        setCurrentUser(toAuthUser(newSession?.user));
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setCurrentUser(toAuthUser(existing?.user));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { currentUser, session, loading, isPasswordRecovery };
}
