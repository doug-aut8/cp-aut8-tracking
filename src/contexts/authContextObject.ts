import { createContext } from "react";
import type { AuthResponse, Session } from "@supabase/supabase-js";
import type { AuthUser } from "@/hooks/useAuthState";

export interface AuthContextType {
  currentUser: AuthUser | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signUp: (email: string, password: string, name?: string, phone?: string) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  logOut: () => Promise<void>;
}

// Kept in its own module so hot reloads of the provider never recreate the context.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
