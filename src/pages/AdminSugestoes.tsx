import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, Trash2, Pencil, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAllMenuItems } from "@/services/menuItemService";
import { getAllCategories } from "@/services/categoryService";
import { excluirRegra, getTodasRegras, salvarRegra, SugestaoRegra } from "@/services/sugestoesService";
import type { Category, MenuItem } from "@/types/menu";
import { POPULAR_CATEGORY_ID } from "@/types/menu";

const vazia: SugestaoRegra = {
  nome: "", titulo: "Peça também", gatilho_tipo: "categoria", gatilho_ids: [], sugestao_ids: [], prioridade: 0, ativo: true, desconto_valor: 0,
};

const MultiPick: React.FC<{
  options: { id: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}> = ({ options, value, onChange }) => {
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="border rounded-md">
      <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="border-0 border-b rounded-b-none" />
      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
        {filtered.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={value.includes(o.id)}
              onCheckedChange={(c) => onChange(c ? [...value, o.id] : value.filter((v) => v !== o.id))}
            />
            {o.label}
          </label>
        ))}
        {!filtered.length && <p className="text-xs text-muted-foreground">Nada encontrado</p>}
      </div>
    </div>
  );
};

const GroupedPick: React.FC<{
  menu: MenuItem[];
  cats: Category[];
  value: string[];
  onChange: (v: string[]) => void;
}> = ({ menu, cats, value, onChange }) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const selected = value.map((id) => menu.find((m) => m.id === id)).filter(Boolean) as MenuItem[];
  const groups = useMemo(() => {
    const term = q.toLowerCase();
    const list = [...cats.map((c) => ({ id: c.id, name: c.name })), { id: "__outros", name: "Outros" }];
    return list
      .map((c) => ({
        ...c,
        items: menu.filter((m) =>
          !value.includes(m.id) &&
          m.name.toLowerCase().includes(term) &&
          (c.id === "__outros" ? !cats.some((x) => x.id === m.category) : m.category === c.id),
        ),
        total: menu.filter((m) => (c.id === "__outros" ? !cats.some((x) => x.id === m.category) : m.category === c.id)).length,
      }))
      .filter((g) => g.items.length);
  }, [menu, cats, value, q]);

  return (
    <div className="border rounded-md">
      <div className="p-2 border-b bg-muted/40">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold">{selected.length} produto(s) selecionado(s)</p>
          {!!selected.length && <button type="button" className="text-xs text-destructive" onClick={() => onChange([])}>Limpar</button>}
        </div>
        {!selected.length ? (
          <p className="text-xs text-muted-foreground">Nenhum produto escolhido.</p>
        ) : (
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {selected.map((m) => (
              <button key={m.id} type="button" onClick={() => onChange(value.filter((v) => v !== m.id))}
                className="text-xs rounded-full border bg-background px-2 py-0.5 hover:border-destructive">
                {m.name} ✕
              </button>
            ))}
          </div>
        )}
      </div>
      <Input placeholder="Buscar produto..." value={q} onChange={(e) => setQ(e.target.value)} className="border-0 border-b rounded-none" />
      <div className="max-h-64 overflow-y-auto">
        {groups.map((g) => {
          const isOpen = !!q || open[g.id];
          return (
            <div key={g.id} className="border-b last:border-0">
              <div className="flex items-center justify-between px-2 py-1.5">
                <button type="button" className="text-sm font-medium flex-1 text-left" onClick={() => setOpen({ ...open, [g.id]: !open[g.id] })}>
                  {isOpen ? "▾" : "▸"} {g.name} <span className="text-xs text-muted-foreground">[{g.total - g.items.length}/{g.total}]</span>
                </button>
                <button type="button" className="text-xs text-primary font-semibold" onClick={() => onChange([...value, ...g.items.map((i) => i.id)])}>
                  + Categoria inteira
                </button>
              </div>
              {isOpen && (
                <div className="pb-2 px-2 space-y-1">
                  {g.items.map((m) => (
                    <button key={m.id} type="button" onClick={() => onChange([...value, m.id])}
                      className="w-full text-left text-sm px-2 py-1 rounded hover:bg-muted">+ {m.name}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!groups.length && <p className="text-xs text-muted-foreground p-2">Nada disponível</p>}
      </div>
    </div>
  );
};

const AdminSugestoes = () => {
  const { toast } = useToast();
  const [regras, setRegras] = useState<SugestaoRegra[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [edit, setEdit] = useState<SugestaoRegra | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => getTodasRegras().then(setRegras).catch((e) => toast({ title: "Erro", description: e.message, variant: "destructive" }));
  useEffect(() => {
    load();
    getAllMenuItems().then(setMenu);
    getAllCategories().then((c) => setCats(c.filter((x) => x.id !== POPULAR_CATEGORY_ID)));
  }, []);

  const prodOpts = useMemo(() => menu.map((m) => ({ id: m.id, label: m.name })), [menu]);
  const catOpts = useMemo(() => cats.map((c) => ({ id: c.id, label: c.name })), [cats]);
  const nomeDe = (tipo: string, id: string) =>
    (tipo === "categoria" ? cats.find((c) => c.id === id)?.name : menu.find((m) => m.id === id)?.name) ?? "—";

  const save = async () => {
    if (!edit) return;
    if (!edit.nome.trim() || !edit.gatilho_ids.length || !edit.sugestao_ids.length) {
      toast({ title: "Preencha nome, gatilho e produtos sugeridos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await salvarRegra(edit);
      setEdit(null);
      await load();
      toast({ title: "Regra salva" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <AdminPageHeader title="Sugestões de Venda" icon={Sparkles} iconBg="bg-amber-100" iconColor="text-amber-600" />
      <div className="flex justify-end mb-4">
        <Button onClick={() => setEdit({ ...vazia })}><Plus className="h-4 w-4 mr-1" /> Nova regra</Button>
      </div>
      <div className="space-y-3">
        {!regras.length && <p className="text-center text-muted-foreground">Nenhuma regra criada ainda.</p>}
        {regras.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="text-sm space-y-1">
                <p className="font-semibold">{r.nome} {!r.ativo && <span className="text-xs text-muted-foreground">(pausada)</span>}</p>
                <p><span className="text-muted-foreground">Quem pedir {r.gatilho_tipo === "categoria" ? "da categoria" : "o produto"}:</span> {r.gatilho_ids.map((i) => nomeDe(r.gatilho_tipo, i)).join(", ")}</p>
                <p><span className="text-muted-foreground">Recebe sugestão de:</span> {r.sugestao_ids.map((i) => nomeDe("produto", i)).join(", ")}</p>
                {Number(r.desconto_valor) > 0 && <p className="text-food-green font-medium">Desconto: R$ {Number(r.desconto_valor).toFixed(2).replace(".", ",")}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={r.ativo} onCheckedChange={async (v) => { await salvarRegra({ ...r, ativo: v }); load(); }} />
                <Button size="icon" variant="outline" onClick={() => setEdit({ ...r })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={async () => { if (confirm("Excluir esta regra?")) { await excluirRegra(r.id!); load(); } }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar regra" : "Nova regra"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div><Label>Nome interno</Label><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex.: Pizza + Refri" /></div>
              <div><Label>Título no carrinho</Label><Input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></div>
              <div>
                <Label>Quando o cliente pedir</Label>
                <div className="flex gap-2 my-2">
                  {(["categoria", "produto"] as const).map((t) => (
                    <Button key={t} type="button" size="sm" variant={edit.gatilho_tipo === t ? "default" : "outline"} onClick={() => setEdit({ ...edit, gatilho_tipo: t, gatilho_ids: [] })}>
                      {t === "categoria" ? "Por Categoria" : "Por Produto"}
                    </Button>
                  ))}
                </div>
                <MultiPick options={edit.gatilho_tipo === "categoria" ? catOpts : prodOpts} value={edit.gatilho_ids} onChange={(v) => setEdit({ ...edit, gatilho_ids: v })} />
              </div>
              <div>
                <Label>Sugerir estes produtos</Label>
                <GroupedPick menu={menu} cats={cats} value={edit.sugestao_ids} onChange={(v) => setEdit({ ...edit, sugestao_ids: v })} />
              </div>
              <div>
                <Label>Desconto nos produtos sugeridos (R$)</Label>
                <Input type="number" min={0} step="0.01" value={edit.desconto_valor ?? 0} onChange={(e) => setEdit({ ...edit, desconto_valor: Math.max(0, Number(e.target.value) || 0) })} />
                <p className="text-xs text-muted-foreground mt-1">0 = preço normal. O valor é descontado do preço (ou do tamanho escolhido) só quando o cliente adiciona pela sugestão.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-28"><Label>Prioridade</Label><Input type="number" value={edit.prioridade} onChange={(e) => setEdit({ ...edit, prioridade: Number(e.target.value) || 0 })} /></div>
                <label className="flex items-center gap-2 mt-5 text-sm"><Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} /> Ativa</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSugestoes;
