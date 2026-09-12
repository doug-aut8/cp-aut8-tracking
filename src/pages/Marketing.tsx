import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Megaphone as PageIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Facebook, BarChart3, Code2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MarketingConfig {
  meta_pixel_id: string;
  meta_access_token: string;
  meta_test_event_code: string;
  gtm_container_id: string;
  capi_ativo: boolean;
}

const Marketing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MarketingConfig>({
    meta_pixel_id: "",
    meta_access_token: "",
    meta_test_event_code: "",
    gtm_container_id: "",
    capi_ativo: false,
  });

  // Carregar dados do Supabase
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("tags_rastreamento" as any)
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          const d = data as any;
          setConfig({
            meta_pixel_id: d.meta_pixel_id || "",
            meta_access_token: d.meta_access_token || "",
            meta_test_event_code: d.meta_test_event_code || "",
            gtm_container_id: d.gtm_container_id || "",
            capi_ativo: d.capi_ativo ?? false,
          });
        }
      } catch (e) {
        console.error("Erro ao carregar:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleChange = (field: keyof MarketingConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tags_rastreamento" as any)
        .upsert({
          id: 1,
          ...config,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Configurações salvas!",
        description: "As tags foram atualizadas no banco de dados.",
      });
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: "Houve um problema ao conectar com o Supabase.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <AdminPageHeader title="Marketing & Rastreamento" icon={PageIcon} iconBg="bg-pink-100" iconColor="text-pink-600" />

      <div className="space-y-6">
        {/* Meta Pixel */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Facebook className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Meta Pixel (Facebook)</CardTitle>
                <CardDescription>Insira o ID do Pixel.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta_pixel_id">ID do Pixel</Label>
              <Input
                id="meta_pixel_id"
                value={config.meta_pixel_id}
                onChange={(e) => handleChange("meta_pixel_id", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Meta CAPI */}
        <Card className={!config.capi_ativo ? "opacity-70" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-full">
                  <Code2 className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">API de Conversões (CAPI)</CardTitle>
                  <CardDescription>Token de acesso e código de teste.</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="capi_switch" className="text-xs text-muted-foreground">
                  {config.capi_ativo ? "Ativo" : "Inativo"}
                </Label>
                <Switch
                  id="capi_switch"
                  checked={config.capi_ativo}
                  onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, capi_ativo: checked }))}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta_access_token">Token de Acesso</Label>
              <Textarea
                id="meta_access_token"
                className="font-mono text-xs min-h-[80px]"
                value={config.meta_access_token}
                onChange={(e) => handleChange("meta_access_token", e.target.value)}
                disabled={!config.capi_ativo}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_test_event_code">Código de Teste</Label>
              <Input
                id="meta_test_event_code"
                value={config.meta_test_event_code}
                onChange={(e) => handleChange("meta_test_event_code", e.target.value)}
                disabled={!config.capi_ativo}
              />
            </div>
          </CardContent>
        </Card>

        {/* Google Tag Manager */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-full">
                <BarChart3 className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Tag Manager</CardTitle>
                <CardDescription>ID do contêiner GTM.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gtm_container_id">ID do Contêiner GTM</Label>
              <Input
                id="gtm_container_id"
                value={config.gtm_container_id}
                onChange={(e) => handleChange("gtm_container_id", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Button 
          onClick={handleSave} 
          className="w-full gap-2" 
          size="lg" 
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
};

export default Marketing;
