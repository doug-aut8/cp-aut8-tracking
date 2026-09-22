import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError("");
      setLoading(true);
      const result = await signIn(email, password);
      const user = result.data.user;

      // Consulta role na tabela user_roles do Supabase
      let role: string = "user";
      if (user) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .order("role", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (roleRow?.role) role = roleRow.role;
      }

      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo!`,
      });

      if (redirectTo) {
        navigate(redirectTo);
      } else if (role === "admin" || role === "super-admin") {
        navigate("/admin-dashboard");
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error(error);
      setError("Falha ao fazer login. Verifique seu email e senha.");
    } finally {
      setLoading(false);
    }
  };

const [showPassword, setShowPassword] = useState(false); // 👈 estado para exibir ou não a senha

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-extrabold text-gray-900">Entrar</h2>
          <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 border border-green-200">
            <span className="text-sm text-gray-700">É novo por aqui?</span>
            <Link
              to={redirectTo ? `/register?redirect=${encodeURIComponent(redirectTo)}` : "/register"}
              className="text-sm font-bold text-green-600 hover:text-green-700"
            >
              Criar
            </Link>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <div className="mt-1 relative">
                <Mail className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
            </div>

<div>
  <label
    htmlFor="password"
    className="block text-sm font-medium text-gray-700"
  >
    Senha
  </label>
  <div className="mt-1 relative">
    <Lock className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
    <Input
      id="password"
      name="password"
      type={showPassword ? "text" : "password"} // 👈 alterna tipo
      autoComplete="current-password"
      required
      className="pl-10 pr-10" // 👈 espaço extra à direita para o botão
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder="••••••••"
    />
    <button
      type="button"
      className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600"
      onClick={() => setShowPassword(!showPassword)}
    >
      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-brand hover:text-brand-600"
              >
                Esqueceu sua senha?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-brand hover:bg-brand-600"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
