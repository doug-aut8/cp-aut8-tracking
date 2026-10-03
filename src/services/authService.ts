import { supabase } from "@/integrations/supabase/client";
import type { AuthResponse } from "@supabase/supabase-js";
import { phoneDigitsBr } from "@/utils/phoneUtils";

export async function signUp(
  email: string,
  password: string,
  name?: string,
  phone?: string
): Promise<AuthResponse> {
  const redirectUrl = `${window.location.origin}/`;
  const result = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        name: name ?? "",
        phone: phoneDigitsBr(phone) ?? "",
      },
    },
  });

  if (result.error) throw result.error;
  // Profile + default role are created by the handle_new_user trigger.
  return result;
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return result;
}

export async function logOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}
