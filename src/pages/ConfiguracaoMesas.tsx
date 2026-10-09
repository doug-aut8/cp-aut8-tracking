import React, { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Armchair as PageIcon, Printer, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TableSettings, formatTableNumber, useTableSettings } from "@/hooks/useTableSettings";

const ConfiguracaoMesas = () => {
  const { settings, loading, save } = useTableSettings();
  const [form, setForm] = useState<TableSettings>(settings);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setForm(settings); }, [settings]);
  const set = <K extends keyof TableSettings>(k: K, v: TableSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  const base = `${window.location.origin}/cardapio-qr?mesa=`;
  const mesas = Array.from({ length: Math.max(0, Math.min(200, form.mesas_quantidade)) }, (_, i) => formatTableNumber(i + 1));

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(form);
      toast({ title: "Configurações salvas" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const printQRs = () => {
    const canvases = gridRef.current?.querySelectorAll("canvas") || [];
    const cards = Array.from(canvases).map((c, i) =>
      `<div class="c"><img src="${(c as HTMLCanvasElement).toDataURL()}"/><h2>Mesa ${mesas[i]}</h2><p>Aponte a câmera e faça seu pedido</p></div>`
    ).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>QR Codes das Mesas</title><style>
      body{font-family:sans-serif;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:16px}
      .c{border:2px dashed #999;text-align:center;padding:12px;page-break-inside:avoid}
      img{width:180px;height:180px} h2{margin:6px 0} p{margin:0;font-size:12px}
    </style></head><body>${cards}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-5xl">
      <AdminPageHeader title="Configuração de Mesas" icon={PageIcon} />

      <Card>
        <CardHeader><CardTitle>Pedidos pelo salão</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar pedidos pelas mesas (QR Code)</Label>
            <Switch checked={form.mesas_ativo} onCheckedChange={(v) => set("mesas_ativo", v)} />
          </div>
          <div className="max-w-xs">
            <Label>Quantidade de mesas</Label>
            <Input type="number" min={1} max={200} value={form.mesas_quantidade} onChange={(e) => set("mesas_quantidade", Number(e.target.value) || 1)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Formas de pagamento no salão</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Receber por PIX</Label>
            <Switch checked={form.mesas_pix_ativo} onCheckedChange={(v) => set("mesas_pix_ativo", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Cobrança na Mesa</Label>
            <Switch checked={form.mesas_cobranca_ativo} onCheckedChange={(v) => set("mesas_cobranca_ativo", v)} />
          </div>
          <div><Label>Chave PIX</Label><Input value={form.mesas_pix_chave} onChange={(e) => set("mesas_pix_chave", e.target.value)} /></div>
          <div><Label>Mensagem exibida após o pedido</Label><Textarea value={form.mesas_mensagem} onChange={(e) => set("mesas_mensagem", e.target.value)} placeholder="Ex.: Envie o comprovante ao garçom." /></div>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar configurações"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>QR Codes das mesas</CardTitle>
          <Button variant="outline" onClick={printQRs}><Printer className="h-4 w-4 mr-2" /> Imprimir todos</Button>
        </CardHeader>
        <CardContent>
          <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {mesas.map((m) => (
              <div key={m} className="rounded-lg border p-3 flex flex-col items-center gap-2">
                <QRCodeCanvas value={base + m} size={140} marginSize={2} />
                <span className="font-bold">Mesa {m}</span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(base + m); toast({ title: "Link copiado" }); }}>
                  <Copy className="h-3 w-3 mr-1" /> Copiar link
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracaoMesas;
