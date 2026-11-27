import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import {
  SizeTemplate,
  SizeTemplateEntry,
  getSizeTemplates,
  saveSizeTemplate,
  deleteSizeTemplate,
} from "@/services/sizeTemplateService";

interface Props {
  onChange?: () => void;
}

export const SizeTemplatesCard = ({ onChange }: Props) => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<SizeTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [sizes, setSizes] = useState<SizeTemplateEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();
  const load = () => {
    queryClient.invalidateQueries({ queryKey: ["size-templates"] });
    return getSizeTemplates().then(setTemplates).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const reset = () => { setEditingId(undefined); setName(""); setSizes([]); };

  const edit = (t: SizeTemplate) => { setEditingId(t.id); setName(t.name); setSizes(t.sizes); };

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= sizes.length) return;
    const next = [...sizes];
    [next[i], next[j]] = [next[j], next[i]];
    setSizes(next);
  };

  const handleSave = async () => {
    const clean = sizes.filter((s) => s.name.trim());
    if (!name.trim() || clean.length === 0) {
      toast({ title: "Preencha o nome e pelo menos um tamanho", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveSizeTemplate({ id: editingId, name, sizes: clean });
      toast({ title: "Conjunto salvo", description: "Os itens das categorias que usam este conjunto foram atualizados." });
      reset();
      await load();
      onChange?.();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar conjunto", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: SizeTemplate) => {
    if (!window.confirm(`Excluir o conjunto "${t.name}"? As categorias deixarão de usá-lo (os itens mantêm seus tamanhos atuais).`)) return;
    try {
      await deleteSizeTemplate(t.id);
      if (editingId === t.id) reset();
      await load();
      onChange?.();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Conjuntos de Tamanhos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Crie um conjunto (ex: Broto, Média, Grande) e aplique-o a uma categoria. Os preços continuam definidos em cada item.
        </p>

        {templates.length > 0 && (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.sizes.map((s) => s.name).join(" · ")}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => edit(t)} aria-label="Editar conjunto"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(t)} aria-label="Excluir conjunto"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 rounded-md border p-3">
          <div>
            <Label htmlFor="tpl-name">{editingId ? "Editar conjunto" : "Novo conjunto"}</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pizzas Salgadas" />
          </div>
          {sizes.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <Input
                value={s.name}
                onChange={(e) => setSizes(sizes.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                placeholder={`Tamanho ${i + 1}`}
              />
              <Button size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setSizes(sizes.filter((_, k) => k !== i))} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setSizes([...sizes, { id: crypto.randomUUID(), name: "" }])}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar tamanho
          </Button>
          <div className="flex justify-end gap-2">
            {(editingId || name || sizes.length > 0) && <Button variant="outline" onClick={reset}>Cancelar</Button>}
            <Button onClick={handleSave} disabled={saving}>{editingId ? "Atualizar" : "Salvar conjunto"}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
