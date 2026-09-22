import React, { createContext } from "react";
import type { AuthResponse, Session } from "@supabase/supabase-js";
import { useAuthState, type AuthUser } from "@/hooks/useAuthState";
import {
  signUp as authSignUp,
  signIn as authSignIn,
  logOut as authLogOut,
} from "@/services/authService";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  currentUser: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string, phone?: string) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, session, loading } = useAuthState();
  const { toast } = useToast();

  const signUp = async (email: string, password: string, name?: string, phone?: string) => {
    try {
      const result = await authSignUp(email, password, name, phone);
      toast({
        title: "Conta criada com sucesso",
        description: "Verifique seu email para confirmar a conta.",
      });
      return result;
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authSignIn(email, password);
      toast({ title: "Login realizado", description: "Você entrou com sucesso." });
      return result;
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const logOut = async () => {
    try {
      await authLogOut();
      toast({ title: "Logout realizado", description: "Você foi desconectado." });
    } catch (error: any) {
      toast({
        title: "Erro ao fazer logout",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, session, loading, signUp, signIn, logOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
