import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Cog as PageIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, RefreshCw, MessageCircle, Bell, ShieldCheck, Radio, Activity, Printer, CreditCard, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { invalidateComunicacaoMetaCache } from "@/utils/webhookPayload";

const Configuracoes = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [applyingCron, setApplyingCron] = useState(false);
  const [savingChat, setSavingChat] = useState(false);
  const [savingWebhookStatus, setSavingWebhookStatus] = useState(false);
  const [savingWebhookAuth, setSavingWebhookAuth] = useState(false);
  const [savingWebhookEventos, setSavingWebhookEventos] = useState(false);
  const [cronSchedule, setCronSchedule] = useState("0 9 * * *");
  const [webhookChat, setWebhookChat] = useState("");
  const [webhookStatus, setWebhookStatus] = useState("");
  const [webhookAuth, setWebhookAuth] = useState("");
  const [webhookEventos, setWebhookEventos] = useState("");
  const [webhookFidelidade, setWebhookFidelidade] = useState("");
  const [savingWebhookFidelidade, setSavingWebhookFidelidade] = useState(false);
  const [tempoAbandonedCart, setTempoAbandonedCart] = useState("25");
  const [whatsappVerificationEnabled, setWhatsappVerificationEnabled] = useState(true);
  const [savingWhatsappToggle, setSavingWhatsappToggle] = useState(false);
  const [mensagemAtendimento, setMensagemAtendimento] = useState("");
  const [comunicacaoInstancia, setComunicacaoInstancia] = useState("");
  const [comunicacaoApikey, setComunicacaoApikey] = useState("");
  const [savingComunicacao, setSavingComunicacao] = useState(false);
  const [autoPrintOnAccept, setAutoPrintOnAccept] = useState(true);
  const [savingAutoPrintToggle, setSavingAutoPrintToggle] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeMode, setStripeMode] = useState<"test" | "live">("test");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [savingStripe, setSavingStripe] = useState(false);
  const [paymentCardDeliveryEnabled, setPaymentCardDeliveryEnabled] = useState(true);
  const [paymentCashEnabled, setPaymentCashEnabled] = useState(true);
  const [savingPaymentMethods, setSavingPaymentMethods] = useState(false);
  const [paginaInicial, setPaginaInicial] = useState<"cover" | "cardapio">("cover");
  const [savingPaginaInicial, setSavingPaginaInicial] = useState(false);

  const handlePaginaInicialChange = async (value: "cover" | "cardapio") => {
    setSavingPaginaInicial(true);
    const prev = paginaInicial;
    setPaginaInicial(value);
    try {
      const { error } = await supabase
        .from("configuracoes")
        .upsert(
          { chave: "pagina_inicial", valor: value, updated_at: new Date().toISOString() },
          { onConflict: "chave" }
        );
      if (error) throw error;
      toast({
        title: "Sucesso!",
        description:
          value === "cardapio"
            ? "A página inicial agora é o Cardápio. A Cover foi desativada."
            : "A página inicial agora é a Cover.",
      });
    } catch (error: any) {
      setPaginaInicial(prev);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSavingPaginaInicial(false);
    }
  };

  const currentProjectUrl = (supabase as any).supabaseUrl;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", ["cron_ga4_schedule", "webhook_chatassistant", "mensagem_atendimento", "webhook_status_pedido", "webhook_autenticacao", "webhook_eventos", "webhook_fidelidade", "tempo_disparo_abandoned_cart", "whatsapp_verification_enabled", "comunicacao_instancia", "comunicacao_apikey", "auto_print_on_accept", "stripe_enabled", "stripe_mode", "stripe_publishable_key", "stripe_secret_key", "stripe_webhook_secret", "payment_card_delivery_enabled", "payment_cash_enabled", "pagina_inicial"]);

      if (error) throw error;

      if (data) {
        data.forEach((row) => {
          if (row.chave === "cron_ga4_schedule" && row.valor) setCronSchedule(row.valor);
          if (row.chave === "webhook_chatassistant" && row.valor) setWebhookChat(row.valor);
          if (row.chave === "webhook_status_pedido" && row.valor) setWebhookStatus(row.valor);
          if (row.chave === "webhook_autenticacao" && row.valor) setWebhookAuth(row.valor);
          if (row.chave === "webhook_eventos" && row.valor) setWebhookEventos(row.valor);
          if (row.chave === "webhook_fidelidade" && row.valor) setWebhookFidelidade(row.valor);
          if (row.chave === "tempo_disparo_abandoned_cart" && row.valor) setTempoAbandonedCart(row.valor);
          if (row.chave === "mensagem_atendimento" && row.valor) setMensagemAtendimento(row.valor);
          if (row.chave === "whatsapp_verification_enabled") setWhatsappVerificationEnabled(row.valor !== "false");
          if (row.chave === "comunicacao_instancia" && row.valor) setComunicacaoInstancia(row.valor);
          if (row.chave === "comunicacao_apikey" && row.valor) setComunicacaoApikey(row.valor);
          if (row.chave === "auto_print_on_accept") setAutoPrintOnAccept(row.valor !== "false");
          if (row.chave === "stripe_enabled") setStripeEnabled(row.valor === "true");
          if (row.chave === "stripe_mode" && row.valor) setStripeMode(row.valor === "live" ? "live" : "test");
          if (row.chave === "stripe_publishable_key" && row.valor) setStripePublishableKey(row.valor);
          if (row.chave === "stripe_secret_key" && row.valor) setStripeSecretKey(row.valor);
          if (row.chave === "stripe_webhook_secret" && row.valor) setStripeWebhookSecret(row.valor);
          if (row.chave === "payment_card_delivery_enabled") setPaymentCardDeliveryEnabled(row.valor !== "false");
          if (row.chave === "payment_cash_enabled") setPaymentCashEnabled(row.valor !== "false");
          if (row.chave === "pagina_inicial") setPaginaInicial(row.valor === "cardapio" ? "cardapio" : "cover");
        });
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCron = async () => {
    setApplyingCron(true);
    try {
      const { error: dbError } = await supabase
        .from("configuracoes")
        .upsert(
          { chave: "cron_ga4_schedule", valor: cronSchedule, updated_at: new Date().toISOString() },
          { onConflict: "chave" }
        );
      if (dbError) throw dbError;

      const { data, error: funcError } = await supabase.functions.invoke("update-cron", {
        body: { schedule: cronSchedule },
      });
      if (funcError) throw funcError;

      toast({ title: "Sucesso!", description: `Agendamento atualizado para: ${cronSchedule}` });
    } catch (error: any) {
      console.error("Erro na operação:", error);
      toast({ title: "Erro ao atualizar", description: error.message || "Ocorreu um erro inesperado.", variant: "destructive" });
    } finally {
      setApplyingCron(false);
    }
  };

  const handleSaveChatConfig = async () => {
    setSavingChat(true);
    try {
      for (const { chave, valor } of [
        { chave: "webhook_chatassistant", valor: webhookChat },
        { chave: "webhook_status_pedido", valor: webhookStatus },
        { chave: "mensagem_atendimento", valor: mensagemAtendimento },
      ]) {
        const { error } = await supabase
          .from("configuracoes")
          .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: "chave" });
        if (error) throw error;
      }
      toast({ title: "Sucesso!", description: "Configurações do chat salvas." });
    } catch (error: any) {
      console.error("Erro ao salvar chat:", error);
      toast({ title: "Erro ao salvar", description: error.message || "Ocorreu um erro inesperado.", variant: "destructive" });
    } finally {
      setSavingChat(false);
    }
  };

  const handleSaveComunicacao = async () => {
    setSavingComunicacao(true);
    try {
      for (const { chave, valor } of [
        { chave: "comunicacao_instancia", valor: comunicacaoInstancia },
        { chave: "comunicacao_apikey", valor: comunicacaoApikey },
      ]) {
        const { error } = await supabase
          .from("configuracoes")
          .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: "chave" });
        if (error) throw error;
      }
      invalidateComunicacaoMetaCache();
      toast({ title: "Sucesso!", description: "Configurações de comunicação salvas." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSavingComunicacao(false);
    }
  };

  const handleSaveStripe = async () => {
    setSavingStripe(true);
    try {
      for (const { chave, valor } of [
        { chave: "stripe_enabled", valor: stripeEnabled ? "true" : "false" },
        { chave: "stripe_mode", valor: stripeMode },
        { chave: "stripe_publishable_key", valor: stripePublishableKey.trim() },
        { chave: "stripe_secret_key", valor: stripeSecretKey.trim() },
        { chave: "stripe_webhook_secret", valor: stripeWebhookSecret.trim() },
      ]) {
        const { error } = await supabase
          .from("configuracoes")
          .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: "chave" });
        if (error) throw error;
      }
      toast({ title: "Sucesso!", description: "Configurações do Stripe salvas." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSavingStripe(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-6">
        <AdminPageHeader title="Configurações do Sistema" icon={PageIcon} iconBg="bg-slate-100" iconColor="text-slate-600" />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <div className="p-4 bg-muted/50 rounded-lg border text-xs text-muted-foreground mb-4">
          <p><strong>Projeto Conectado:</strong> {currentProjectUrl}</p>
        </div>

        {/* Página Inicial */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Home className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Página Inicial</CardTitle>
                <CardDescription>
                  Escolha qual página o cliente vê ao acessar a loja.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="pagina_inicial"
                  value="cover"
                  checked={paginaInicial === "cover"}
                  disabled={savingPaginaInicial}
                  onChange={() => handlePaginaInicialChange("cover")}
                  className="h-4 w-4 accent-primary"
                />
                <div>
                  <p className="font-medium">Cover</p>
                  <p className="text-sm text-muted-foreground">
                    Página de capa com banners e botões de navegação.
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="pagina_inicial"
                  value="cardapio"
                  checked={paginaInicial === "cardapio"}
                  disabled={savingPaginaInicial}
                  onChange={() => handlePaginaInicialChange("cardapio")}
                  className="h-4 w-4 accent-primary"
                />
                <div>
                  <p className="font-medium">Cardápio</p>
                  <p className="text-sm text-muted-foreground">
                    O cliente é direcionado direto ao cardápio. A Cover fica desativada.
                  </p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Comunicação */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Radio className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Comunicação</CardTitle>
                <CardDescription>Credenciais enviadas no payload de todos os webhooks do sistema.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="comunicacao_instancia">Instância</Label>
                <Input
                  id="comunicacao_instancia"
                  value={comunicacaoInstancia}
                  onChange={(e) => setComunicacaoInstancia(e.target.value)}
                  placeholder="nome-da-instancia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comunicacao_apikey">APIKEY</Label>
                <Input
                  id="comunicacao_apikey"
                  type="password"
                  value={comunicacaoApikey}
                  onChange={(e) => setComunicacaoApikey(e.target.value)}
                  placeholder="••••••••"
                />
                <p className="text-sm text-muted-foreground">
                  Esses dados, junto ao ID da empresa, serão enviados em todos os webhooks disparados pelo sistema.
                </p>
              </div>
              <Button className="w-full" disabled={savingComunicacao} onClick={handleSaveComunicacao}>
                <RefreshCw className={`h-4 w-4 mr-2 ${savingComunicacao ? "animate-spin" : ""}`} />
                {savingComunicacao ? "Salvando..." : "Salvar Comunicação"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Gateway de Pagamento - Stripe */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Gateway de Pagamento — Stripe</CardTitle>
                <CardDescription>Configure as credenciais do Stripe para processar pagamentos online.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="stripe_enabled_toggle" className="text-base">Habilitar Stripe</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando habilitado, o Stripe ficará disponível como opção de pagamento.
                  </p>
                </div>
                <Switch
                  id="stripe_enabled_toggle"
                  checked={stripeEnabled}
                  onCheckedChange={setStripeEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label>Ambiente</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={stripeMode === "test" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setStripeMode("test")}
                  >
                    Teste (Sandbox)
                  </Button>
                  <Button
                    type="button"
                    variant={stripeMode === "live" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setStripeMode("live")}
                  >
                    Produção (Live)
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe_publishable_key">Publishable Key</Label>
                <Input
                  id="stripe_publishable_key"
                  value={stripePublishableKey}
                  onChange={(e) => setStripePublishableKey(e.target.value)}
                  placeholder="pk_test_... ou pk_live_..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe_secret_key">Secret Key</Label>
                <Input
                  id="stripe_secret_key"
                  type="password"
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  placeholder="sk_test_... ou sk_live_..."
                />
                <p className="text-sm text-muted-foreground">
                  A Secret Key é sensível e usada apenas no backend para criar cobranças.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe_webhook_secret">Webhook Signing Secret (opcional)</Label>
                <Input
                  id="stripe_webhook_secret"
                  type="password"
                  value={stripeWebhookSecret}
                  onChange={(e) => setStripeWebhookSecret(e.target.value)}
                  placeholder="whsec_..."
                />
                <p className="text-sm text-muted-foreground">
                  Usado para validar a assinatura dos webhooks enviados pelo Stripe.
                </p>
              </div>

              <Button className="w-full" disabled={savingStripe} onClick={handleSaveStripe}>
                <RefreshCw className={`h-4 w-4 mr-2 ${savingStripe ? "animate-spin" : ""}`} />
                {savingStripe ? "Salvando..." : "Salvar Configurações do Stripe"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Métodos de Pagamento no Checkout */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Métodos de Pagamento — Checkout</CardTitle>
                <CardDescription>Ative ou desative as opções de pagamento exibidas no checkout.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="payment_card_delivery_toggle" className="text-base">Cartão (na entrega)</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando desabilitado, a opção "Cartão (na entrega)" não será exibida no checkout.
                  </p>
                </div>
                <Switch
                  id="payment_card_delivery_toggle"
                  checked={paymentCardDeliveryEnabled}
                  disabled={savingPaymentMethods}
                  onCheckedChange={async (checked) => {
                    setSavingPaymentMethods(true);
                    const prev = paymentCardDeliveryEnabled;
                    setPaymentCardDeliveryEnabled(checked);
                    try {
                      const { error } = await supabase
                        .from("configuracoes")
                        .upsert(
                          { chave: "payment_card_delivery_enabled", valor: checked ? "true" : "false", updated_at: new Date().toISOString() },
                          { onConflict: "chave" }
                        );
                      if (error) throw error;
                      toast({ title: "Sucesso!", description: `Cartão na entrega ${checked ? "habilitado" : "desabilitado"}.` });
                    } catch (error: any) {
                      setPaymentCardDeliveryEnabled(prev);
                      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                    } finally {
                      setSavingPaymentMethods(false);
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="payment_cash_toggle" className="text-base">Dinheiro</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando desabilitado, a opção "Dinheiro" não será exibida no checkout.
                  </p>
                </div>
                <Switch
                  id="payment_cash_toggle"
                  checked={paymentCashEnabled}
                  disabled={savingPaymentMethods}
                  onCheckedChange={async (checked) => {
                    setSavingPaymentMethods(true);
                    const prev = paymentCashEnabled;
                    setPaymentCashEnabled(checked);
                    try {
                      const { error } = await supabase
                        .from("configuracoes")
                        .upsert(
                          { chave: "payment_cash_enabled", valor: checked ? "true" : "false", updated_at: new Date().toISOString() },
                          { onConflict: "chave" }
                        );
                      if (error) throw error;
                      toast({ title: "Sucesso!", description: `Dinheiro ${checked ? "habilitado" : "desabilitado"}.` });
                    } catch (error: any) {
                      setPaymentCashEnabled(prev);
                      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                    } finally {
                      setSavingPaymentMethods(false);
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Impressão Automática */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Printer className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Impressão Automática ao Aceitar</CardTitle>
                <CardDescription>Define se o pedido será impresso automaticamente ao clicar em "Aceito" nos detalhes do pedido.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="space-y-0.5 pr-4">
                <Label htmlFor="auto_print_toggle" className="text-base">Imprimir ao clicar em "Aceito"</Label>
                <p className="text-sm text-muted-foreground">
                  Quando desabilitado, clicar em "Aceito" não dispara a impressão automática (a impressão automática ao chegar novo pedido continua ativa).
                </p>
              </div>
              <Switch
                id="auto_print_toggle"
                checked={autoPrintOnAccept}
                disabled={savingAutoPrintToggle}
                onCheckedChange={async (checked) => {
                  setSavingAutoPrintToggle(true);
                  const prev = autoPrintOnAccept;
                  setAutoPrintOnAccept(checked);
                  try {
                    const { error } = await supabase
                      .from("configuracoes")
                      .upsert(
                        { chave: "auto_print_on_accept", valor: checked ? "true" : "false", updated_at: new Date().toISOString() },
                        { onConflict: "chave" }
                      );
                    if (error) throw error;
                    toast({ title: "Sucesso!", description: `Impressão ao aceitar ${checked ? "habilitada" : "desabilitada"}.` });
                  } catch (error: any) {
                    setAutoPrintOnAccept(prev);
                    toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                  } finally {
                    setSavingAutoPrintToggle(false);
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cron GA4 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Agendamento Cron (GA4)</CardTitle>
                <CardDescription>Define a frequência com que os dados do Analytics são coletados.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cron_schedule">Expressão Cron (Minuto Hora Dia Mês Semana)</Label>
                <Input id="cron_schedule" value={cronSchedule} onChange={(e) => setCronSchedule(e.target.value)} placeholder="0 9 * * *" className="font-mono text-lg" />
                <p className="text-sm text-muted-foreground">
                  Exemplo: <code className="bg-muted px-1">0 9 * * *</code> executa diariamente às 09h UTC (06h BRT).
                </p>
              </div>
              <Button className="w-full" disabled={applyingCron} onClick={handleUpdateCron}>
                <RefreshCw className={`h-4 w-4 mr-2 ${applyingCron ? "animate-spin" : ""}`} />
                {applyingCron ? "Atualizando Agendamento..." : "Salvar e Aplicar Agendamento"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Alerta de Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Webhook Alerta de Status</CardTitle>
                <CardDescription>URL do webhook acionado quando o status de um pedido é alterado.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook_status">URL do Webhook</Label>
                <Input
                  id="webhook_status"
                  value={webhookStatus}
                  onChange={(e) => setWebhookStatus(e.target.value)}
                  placeholder="https://seu-webhook.com/status_pedido"
                />
                <p className="text-sm text-muted-foreground">
                  Essa URL será chamada automaticamente ao alterar o status de um pedido no painel.
                </p>
              </div>
              <Button className="w-full" disabled={savingWebhookStatus} onClick={async () => {
                setSavingWebhookStatus(true);
                try {
                  const { error } = await supabase
                    .from("configuracoes")
                    .upsert({ chave: "webhook_status_pedido", valor: webhookStatus, updated_at: new Date().toISOString() }, { onConflict: "chave" });
                  if (error) throw error;
                  toast({ title: "Sucesso!", description: "Webhook de status salvo." });
                } catch (error: any) {
                  toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                } finally {
                  setSavingWebhookStatus(false);
                }
              }}>
                <RefreshCw className={`h-4 w-4 mr-2 ${savingWebhookStatus ? "animate-spin" : ""}`} />
                {savingWebhookStatus ? "Salvando..." : "Salvar Webhook de Status"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Autenticação */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Webhook Autenticação</CardTitle>
                <CardDescription>URL do webhook acionado para enviar o código de verificação por WhatsApp no signup.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="whatsapp_verification_toggle" className="text-base">Usar Verificação por WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando habilitado, o signup exige confirmação do código enviado por WhatsApp.
                  </p>
                </div>
                <Switch
                  id="whatsapp_verification_toggle"
                  checked={whatsappVerificationEnabled}
                  disabled={savingWhatsappToggle}
                  onCheckedChange={async (checked) => {
                    setSavingWhatsappToggle(true);
                    const prev = whatsappVerificationEnabled;
                    setWhatsappVerificationEnabled(checked);
                    try {
                      const { error } = await supabase
                        .from("configuracoes")
                        .upsert(
                          { chave: "whatsapp_verification_enabled", valor: checked ? "true" : "false", updated_at: new Date().toISOString() },
                          { onConflict: "chave" }
                        );
                      if (error) throw error;
                      toast({ title: "Sucesso!", description: `Verificação por WhatsApp ${checked ? "habilitada" : "desabilitada"}.` });
                    } catch (error: any) {
                      setWhatsappVerificationEnabled(prev);
                      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                    } finally {
                      setSavingWhatsappToggle(false);
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook_auth">URL do Webhook</Label>
                <Input
                  id="webhook_auth"
                  value={webhookAuth}
                  onChange={(e) => setWebhookAuth(e.target.value)}
                  placeholder="https://seu-webhook.com/autenticacao"
                />
                <p className="text-sm text-muted-foreground">
                  Essa URL receberá o telefone do cliente para envio do código de autenticação via WhatsApp.
                </p>
              </div>
              <Button className="w-full" disabled={savingWebhookAuth} onClick={async () => {
                setSavingWebhookAuth(true);
                try {
                  const { error } = await supabase
                    .from("configuracoes")
                    .upsert({ chave: "webhook_autenticacao", valor: webhookAuth, updated_at: new Date().toISOString() }, { onConflict: "chave" });
                  if (error) throw error;
                  toast({ title: "Sucesso!", description: "Webhook de autenticação salvo." });
                } catch (error: any) {
                  toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                } finally {
                  setSavingWebhookAuth(false);
                }
              }}>
                <RefreshCw className={`h-4 w-4 mr-2 ${savingWebhookAuth ? "animate-spin" : ""}`} />
                {savingWebhookAuth ? "Salvando..." : "Salvar Webhook de Autenticação"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Eventos */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Webhook Eventos</CardTitle>
                <CardDescription>URL acionada quando ocorre o evento <code>abandoned_cart</code>. O payload inclui todos os eventos da sessão e os dados do usuário logado.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook_eventos">URL do Webhook</Label>
                <Input
                  id="webhook_eventos"
                  value={webhookEventos}
                  onChange={(e) => setWebhookEventos(e.target.value)}
                  placeholder="https://seu-webhook.com/eventos"
                />
                <p className="text-sm text-muted-foreground">
                  Disparado automaticamente quando um carrinho é abandonado (após o tempo configurado abaixo no checkout sem finalizar).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tempo_disparo_abandoned_cart">Tempo disparo abandoned_cart (minutos)</Label>
                <Input
                  id="tempo_disparo_abandoned_cart"
                  type="number"
                  min="1"
                  step="1"
                  value={tempoAbandonedCart}
                  onChange={(e) => setTempoAbandonedCart(e.target.value)}
                  placeholder="25"
                />
                <p className="text-sm text-muted-foreground">
                  Quantos minutos o usuário precisa permanecer no checkout sem finalizar para disparar o evento. Padrão: 25 minutos.
                </p>
              </div>
              <Button className="w-full" disabled={savingWebhookEventos} onClick={async () => {
                setSavingWebhookEventos(true);
                try {
                  const minutes = parseFloat(tempoAbandonedCart);
                  if (isNaN(minutes) || minutes <= 0) {
                    throw new Error("Informe um tempo válido em minutos (maior que 0).");
                  }
                  for (const { chave, valor } of [
                    { chave: "webhook_eventos", valor: webhookEventos },
                    { chave: "tempo_disparo_abandoned_cart", valor: String(minutes) },
                  ]) {
                    const { error } = await supabase
                      .from("configuracoes")
                      .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: "chave" });
                    if (error) throw error;
                  }
                  toast({ title: "Sucesso!", description: "Webhook de eventos salvo." });
                } catch (error: any) {
                  toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                } finally {
                  setSavingWebhookEventos(false);
                }
              }}>
                <RefreshCw className={`h-4 w-4 mr-2 ${savingWebhookEventos ? "animate-spin" : ""}`} />
                {savingWebhookEventos ? "Salvando..." : "Salvar Webhook de Eventos"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Fidelidade */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Webhook de Fidelidade</CardTitle>
                <CardDescription>URL acionada quando um cliente atinge a meta de uma regra de fidelidade. O payload inclui os dados do cliente, a regra atingida e o código do cupom de prêmio gerado.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook_fidelidade">URL do Webhook</Label>
                <Input
                  id="webhook_fidelidade"
                  value={webhookFidelidade}
                  onChange={(e) => setWebhookFidelidade(e.target.value)}
                  placeholder="https://seu-webhook.com/fidelidade"
                />
                <p className="text-sm text-muted-foreground">
                  Disparado automaticamente quando o cliente conclui a quantidade de compras necessária e ganha o prêmio.
                </p>
              </div>
              <Button className="w-full" disabled={savingWebhookFidelidade} onClick={async () => {
                setSavingWebhookFidelidade(true);
                try {
                  const { error } = await supabase
                    .from("configuracoes")
                    .upsert({ chave: "webhook_fidelidade", valor: webhookFidelidade, updated_at: new Date().toISOString() }, { onConflict: "chave" });
                  if (error) throw error;
                  toast({ title: "Sucesso!", description: "Webhook de fidelidade salvo." });
                } catch (error: any) {
                  toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                } finally {
                  setSavingWebhookFidelidade(false);
                }
              }}>
                <RefreshCw className={`h-4 w-4 mr-2 ${savingWebhookFidelidade ? "animate-spin" : ""}`} />
                {savingWebhookFidelidade ? "Salvando..." : "Salvar Webhook de Fidelidade"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Chat Assistant Config */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageCircle className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Assistente Virtual (Chat)</CardTitle>
                <CardDescription>Configure o webhook e a mensagem inicial do chat de atendimento.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook_chat">Webhook Chatassistant</Label>
                <Input
                  id="webhook_chat"
                  value={webhookChat}
                  onChange={(e) => setWebhookChat(e.target.value)}
                  placeholder="https://seu-webhook.com/chatassistant"
                />
                <p className="text-sm text-muted-foreground">
                  URL do webhook que será acionado pelo botão "Fale Conosco".
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mensagem_atendimento">Mensagem de Atendimento</Label>
                <Textarea
                  id="mensagem_atendimento"
                  value={mensagemAtendimento}
                  onChange={(e) => setMensagemAtendimento(e.target.value)}
                  placeholder="Olá 👋! Sou o atendente virtual! Posso te ajudar com informações ou acompanhar seu pedido 😊"
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  Mensagem inicial exibida quando o usuário abre o chat.
                </p>
              </div>
              <Button className="w-full" disabled={savingChat} onClick={handleSaveChatConfig}>
                <RefreshCw className={`h-4 w-4 mr-2 ${savingChat ? "animate-spin" : ""}`} />
                {savingChat ? "Salvando..." : "Salvar Configurações do Chat"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Configuracoes;
