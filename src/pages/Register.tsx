import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Nome deve ter pelo menos 2 caracteres"
  }),
  email: z.string().email({
    message: "Email inválido"
  }),
  phone: z.string().optional(),
  password: z.string().min(6, {
    message: "Senha deve ter pelo menos 6 caracteres"
  }),
  passwordConfirm: z.string()
}).refine((data) => data.password === data.passwordConfirm, {
  message: "As senhas não coincidem",
  path: ["passwordConfirm"]
});

type FormValues = z.infer<typeof formSchema>;

const Register = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpUserId, setOtpUserId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      passwordConfirm: ""
    }
  });

  const triggerAuthWebhook = async (phone: string, email?: string) => {
    try {
      const { data } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "webhook_autenticacao")
        .maybeSingle();
      const url = data?.valor;
      if (!url) {
        console.warn("Webhook de autenticação não configurado.");
        return;
      }

      // Busca id interno e telefone já cadastrado (se existir)
      let userIdDb: string | null = null;
      let phoneCadastrado: string | null = null;
      if (email) {
        const { data: u } = await supabase
          .from("users")
          .select("id, phone")
          .eq("email", email)
          .maybeSingle();
        userIdDb = (u as any)?.id || null;
        phoneCadastrado = (u as any)?.phone || null;
        setOtpUserId(userIdDb);
      }

      const { withComunicacaoMeta } = await import("@/utils/webhookPayload");
      const enriched = await withComunicacaoMeta({
        phone,
        phone_cadastrado: phoneCadastrado,
        user_id: userIdDb,
      });
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enriched),
      });
    } catch (err) {
      console.error("Erro ao acionar webhook de autenticação:", err);
    }
  };

  const maskEmail = (email: string): string => {
    if (!email || !email.includes("@")) return "***";
    const [local, domain] = email.split("@");
    const localMasked =
      local.length <= 2
        ? local + "***"
        : local.slice(0, 2) + "*".repeat(Math.max(3, local.length - 2));
    const domainParts = domain.split(".");
    const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : "";
    const domainMasked = "***" + (tld ? "." + tld : "");
    return `${localMasked}@${domainMasked}`;
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setError("");
      setLoading(true);

      // Verifica se o WhatsApp já está cadastrado
      if (values.phone) {
        const { data: existingUser, error: checkError } = await supabase
          .from("users")
          .select("email")
          .eq("phone", values.phone)
          .maybeSingle();

        if (checkError) {
          console.error("Erro ao verificar WhatsApp:", checkError);
        }

        if (existingUser?.email) {
          const masked = maskEmail(existingUser.email);
          setError(`Esse número já possui cadastro pelo email ${masked}`);
          setLoading(false);
          return;
        }
      }

      await signUp(values.email, values.password, values.name, values.phone);
      const phone = values.phone || "";

      // Check if WhatsApp verification is enabled
      const { data: toggleData } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "whatsapp_verification_enabled")
        .maybeSingle();
      const whatsappVerificationEnabled = toggleData?.valor !== "false";

      if (!whatsappVerificationEnabled) {
        toast({
          title: "Conta criada!",
          description: "Bem-vindo!",
        });
        navigate(redirectTo || "/");
        return;
      }

      setOtpPhone(phone);
      setOtpCode("");
      setOtpError("");
      setOtpOpen(true);
      if (phone) {
        await triggerAuthWebhook(phone, values.email);
        toast({
          title: "Código enviado",
          description: "Enviamos um código de verificação para o seu WhatsApp.",
        });
      } else {
        toast({
          title: "Telefone não informado",
          description: "Informe um telefone para receber o código de verificação.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setError("Falha ao criar conta. Verifique seus dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setOtpError("");
    if (!otpCode.trim()) {
      setOtpError("Digite o código enviado para seu WhatsApp.");
      return;
    }
    setVerifying(true);
    try {
      if (!otpUserId) {
        setOtpError("Usuário não identificado. Tente novamente.");
        setVerifying(false);
        return;
      }
      const { data, error: dbError } = await supabase
        .from("users")
        .select("whatsapp_auth_code")
        .eq("id", otpUserId)
        .maybeSingle();

      if (dbError) throw dbError;

      const normalizedInput = otpCode.trim().toUpperCase();
      const dataAny = data as any;
      const normalizedSaved = dataAny?.whatsapp_auth_code?.trim().toUpperCase();
      if (normalizedSaved && normalizedSaved === normalizedInput) {
        toast({ title: "WhatsApp confirmado!", description: "Bem-vindo!" });
        setOtpOpen(false);
        navigate(redirectTo || "/");
      } else {
        setOtpError("WhatsApp não confirmado. Código inválido.");
      }
    } catch (err: any) {
      setOtpError("WhatsApp não confirmado. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Criar Conta</h2>
          <p className="mt-2 text-sm text-gray-600">
            Ou{" "}
            <Link to={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"} className="font-medium text-brand hover:text-brand-600">
              faça login com sua conta existente
            </Link>
          </p>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
                      <Input 
                        placeholder="Seu nome completo" 
                        className="pl-10" 
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
                      <Input 
                        placeholder="seu@email.com" 
                        className="pl-10" 
                        type="email"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <PhoneInput
                      international
                      defaultCountry="BR"
                      placeholder="(11) 99999-9999"
                      value={field.value}
                      onChange={(value) => field.onChange(value || "")}
                      className="phone-input-custom flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Usamos esse número para enviar notificações sobre pedidos
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
                      <Input 
                        placeholder="••••••••" 
                        className="pl-10 pr-10" 
                        type={showPassword ? "text" : "password"}
                        {...field} 
                      />
                      <button
                        type="button"
                        className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="passwordConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
                      <Input 
                        placeholder="••••••••" 
                        className="pl-10 pr-10" 
                        type={showPasswordConfirm ? "text" : "password"}
                        {...field} 
                      />
                      <button
                        type="button"
                        className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      >
                        {showPasswordConfirm ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button
              type="submit"
              className="w-full bg-brand hover:bg-brand-600"
              disabled={loading}
            >
              {loading ? "Criando conta..." : "Criar Conta"}
            </Button>
          </form>
        </Form>
      </div>

      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand" />
              Confirme seu WhatsApp
            </DialogTitle>
            <DialogDescription>
              Enviamos um código de verificação para o WhatsApp <strong>{otpPhone || "informado"}</strong>. Digite o código abaixo para confirmar sua conta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              autoFocus
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Digite o código"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.toUpperCase())}
              className="text-center tracking-widest text-lg uppercase"
            />
            {otpError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{otpError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              className="w-full bg-brand hover:bg-brand-600"
              disabled={verifying}
              onClick={handleVerifyCode}
            >
              {verifying ? "Verificando..." : "Confirmar código"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Register;
