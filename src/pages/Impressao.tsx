import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Minus, Plus, Play, Printer, RotateCcw, Save, Upload } from "lucide-react";
import {
  buildOrderPrintHtml,
  ComandaFontSizes,
  DEFAULT_COMANDA_FONT_SIZES,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  getComandaFontSizes,
  normalizeComandaFontSizes,
  printOrder,
  SAMPLE_PRINT_ORDER,
  setComandaFontSizesCache,
  setPrintCanhotoCache,
} from "@/utils/printUtils";

const COMANDA_FONT_LABELS: { key: keyof ComandaFontSizes; label: string }[] = [
  { key: "mesa", label: "Destaque de Mesa/Salão" },
  { key: "cabecalho", label: "Título do Cabeçalho" },
  { key: "resumo", label: "Número do Pedido e Resumo" },
  { key: "cliente", label: "Cliente, Endereço e Pagamento" },
  { key: "produtos", label: "Categorias e Nome dos Produtos" },
  { key: "sabores", label: "Sabores, Adicionais e Bordas" },
  { key: "observacoes", label: "Observações dos Itens" },
  { key: "troco", label: "Linha de Troco" },
  { key: "total", label: "Total Final" },
  { key: "rodape", label: "Rodapé e Data/Hora" },
];

const CANHOTO_FONT_LABELS: { key: keyof ComandaFontSizes; label: string }[] = [
  { key: "canhotoTitulo", label: "Título do Canhoto" },
  { key: "canhotoInformacoes", label: "Cliente, Telefone e Pagamento" },
  { key: "canhotoDestaque", label: "Código do Pedido e Total" },
  { key: "canhotoData", label: "Data e Hora do Pedido" },
];

const saveConfigValue = async (chave: string, valor: string) => {
  const { error } = await supabase
    .from("configuracoes")
    .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: "chave" });
  if (error) throw error;
};

const Impressao = () => {
  const [autoPrintNew, setAutoPrintNew] = useState(true);
  const [autoPrintAccept, setAutoPrintAccept] = useState(true);
  const [canhoto, setCanhoto] = useState(true);
  const [somEnabled, setSomEnabled] = useState(false);
  const [somUrl, setSomUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sizes, setSizes] = useState<ComandaFontSizes>(getComandaFontSizes());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", ["auto_print_on_new_order", "auto_print_on_accept", "imprimir_canhoto", "som_novo_pedido_enabled", "som_novo_pedido_url", "comanda_font_sizes"])
      .then(({ data }) => {
        data?.forEach((row) => {
          if (row.chave === "auto_print_on_new_order") setAutoPrintNew(row.valor !== "false");
          if (row.chave === "auto_print_on_accept") setAutoPrintAccept(row.valor !== "false");
          if (row.chave === "imprimir_canhoto") { setCanhoto(row.valor !== "false"); setPrintCanhotoCache(row.valor !== "false"); }
          if (row.chave === "som_novo_pedido_enabled") setSomEnabled(row.valor === "true");
          if (row.chave === "som_novo_pedido_url" && row.valor) setSomUrl(row.valor);
          if (row.chave === "comanda_font_sizes" && row.valor) {
            try {
              const s = normalizeComandaFontSizes(JSON.parse(row.valor));
              setSizes(s);
              setComandaFontSizesCache(s);
            } catch { /* ignore */ }
          }
        });
      });
  }, []);

  const toggle = async (chave: string, checked: boolean, set: (v: boolean) => void, prev: boolean) => {
    set(checked);
    try {
      await saveConfigValue(chave, checked ? "true" : "false");
      if (chave === "imprimir_canhoto") setPrintCanhotoCache(checked);
      toast({ title: "Salvo", description: checked ? "Ativado." : "Desativado." });
    } catch (e: any) {
      set(prev);
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const changeSize = (key: keyof ComandaFontSizes, delta: number) =>
    setSizes((s) => ({ ...s, [key]: Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, s[key] + delta)) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfigValue("comanda_font_sizes", JSON.stringify(sizes));
      if (somUrl.trim()) await saveConfigValue("som_novo_pedido_url", somUrl.trim());
      setComandaFontSizesCache(sizes);
      toast({ title: "Configurações salvas" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "mp3";
      const { data, error } = await supabase.storage
        .from("imagens-cardapio")
        .upload(`sons/novo-pedido-${Date.now()}.${ext}`, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const url = supabase.storage.from("imagens-cardapio").getPublicUrl(data.path).data.publicUrl;
      setSomUrl(url);
      await saveConfigValue("som_novo_pedido_url", url);
      toast({ title: "Som enviado e salvo" });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const previewHtml = useMemo(() => buildOrderPrintHtml(SAMPLE_PRINT_ORDER, sizes, canhoto), [sizes, canhoto]);

  const Row = ({ id, label, desc, checked, onChange }: { id: string; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={id} className="text-base">{label}</Label>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <AdminPageHeader title="Impressão & Comanda" icon={Printer} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automações & Alertas</CardTitle>
              <CardDescription>Quando imprimir e como avisar sobre novos pedidos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row id="ap-new" label="Imprimir automaticamente ao chegar o pedido" desc="Todo novo pedido é impresso na hora." checked={autoPrintNew} onChange={(v) => toggle("auto_print_on_new_order", v, setAutoPrintNew, autoPrintNew)} />
              <Row id="ap-accept" label='Imprimir ao clicar em "Aceito"' desc="Imprime a comanda quando o pedido é aceito." checked={autoPrintAccept} onChange={(v) => toggle("auto_print_on_accept", v, setAutoPrintAccept, autoPrintAccept)} />
              <Row id="canhoto" label="Imprimir Canhoto" desc='Adiciona o canhoto de entrega destacável ("Corte Aqui").' checked={canhoto} onChange={(v) => toggle("imprimir_canhoto", v, setCanhoto, canhoto)} />
              <Row id="som" label="Tocar Som ao Chegar Pedido" desc="Alerta sonoro a cada novo pedido." checked={somEnabled} onChange={(v) => toggle("som_novo_pedido_enabled", v, setSomEnabled, somEnabled)} />
              <div className="space-y-2">
                <Label htmlFor="som-url">URL do som</Label>
                <Input id="som-url" value={somUrl} onChange={(e) => setSomUrl(e.target.value)} placeholder="https://.../alerta.mp3" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Upload className="h-4 w-4 mr-2" />{uploading ? "Enviando..." : "Upload do som"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!somUrl.trim()}
                    onClick={() => new Audio(somUrl.trim()).play().catch(() => toast({ title: "Não foi possível tocar", variant: "destructive" }))}
                  >
                    <Play className="h-4 w-4 mr-2" />Testar som
                  </Button>
                </div>
                <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Tamanhos de Fonte</CardTitle>
                <CardDescription>Entre {FONT_SIZE_MIN}px e {FONT_SIZE_MAX}px por seção.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSizes({ ...DEFAULT_COMANDA_FONT_SIZES })}>
                <RotateCcw className="h-4 w-4 mr-1" />Restaurar Padrões
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="pb-1 text-sm font-semibold">Comanda</p>
              {COMANDA_FONT_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-sm">{label}</span>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Diminuir ${label}`} disabled={sizes[key] <= FONT_SIZE_MIN} onClick={() => changeSize(key, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-14 text-center font-mono text-sm">{sizes[key]}px</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Aumentar ${label}`} disabled={sizes[key] >= FONT_SIZE_MAX} onClick={() => changeSize(key, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="my-3 border-t" />
              <p className="pb-1 text-sm font-semibold">Canhoto</p>
              {CANHOTO_FONT_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-sm">{label}</span>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Diminuir ${label}`} disabled={sizes[key] <= FONT_SIZE_MIN} onClick={() => changeSize(key, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-14 text-center font-mono text-sm">{sizes[key]}px</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Aumentar ${label}`} disabled={sizes[key] >= FONT_SIZE_MAX} onClick={() => changeSize(key, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
            <Button variant="outline" onClick={() => { setComandaFontSizesCache(sizes); printOrder(SAMPLE_PRINT_ORDER); }}>
              <Printer className="h-4 w-4 mr-2" />Imprimir Teste
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 self-start">
          <Card>
            <CardHeader>
              <CardTitle>Simulador da Bobina (72mm)</CardTitle>
              <CardDescription>Atualiza na hora ao mudar os tamanhos.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center bg-muted/40 py-6">
              <iframe
                title="Prévia da comanda"
                srcDoc={previewHtml}
                className="bg-background shadow-xl rounded-sm"
                style={{ width: "72mm", height: "900px", border: 0 }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Impressao;
