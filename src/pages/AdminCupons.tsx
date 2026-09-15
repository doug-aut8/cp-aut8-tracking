//@/pages/admin-coupons.tsx
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Percent as PageIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Link } from "react-router-dom"; //
import { Plus, Trash2, Gift, ArrowLeft, ChevronDown } from "lucide-react"; //
import { getAllMenuItems } from "@/services/menuItemService";
import { getAllCategories } from "@/services/categoryService";
import type { MenuItem, Category } from "@/types/menu";
import { toast } from "@/hooks/use-toast";

type ProdutoRef = {
  // "produto" = exige produto específico; "categoria" = qualquer item da categoria
  tipo?: "produto" | "categoria";
  product_id: string;
  product_name: string;
  category_id?: string;
  category_name?: string;
  category_ids?: string[];
  category_names?: string[];
  quantidade: number;
  // Apenas para produto_brinde: modo "escolha" oferece várias opções
  modo?: "fixo" | "escolha";
  opcoes?: { product_id: string; product_name: string }[];
};


type TipoCupom = "percentual" | "fixo" | "frete_gratis" | "compre_e_ganhe";

type Cupom = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: TipoCupom;
  valor: number;
  data_inicio: string;
  data_fim: string;
  limite_uso: number | null;
  usos_por_usuario: number | null;
  valor_minimo_pedido: number | null;
  ativo: boolean;
  criado_em: string;
  produtos_requeridos?: ProdutoRef[] | null;
  produto_brinde?: ProdutoRef | null;
  primeira_compra_apenas?: boolean;
};

const initialForm: Partial<Cupom> = {
  nome: "",
  descricao: "",
  tipo: "percentual",
  valor: 0,
  data_inicio: "",
  data_fim: "",
  limite_uso: null,
  usos_por_usuario: null,
  valor_minimo_pedido: null,
  ativo: true,
  produtos_requeridos: [],
  produto_brinde: null,
  primeira_compra_apenas: false,
};

export default function AdminCupons() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Cupom | null>(null);
  const [form, setForm] = useState<Partial<Cupom>>(initialForm);
  const [categoriaDropdownAberto, setCategoriaDropdownAberto] = useState<number | null>(null);

  useEffect(() => {
    if (categoriaDropdownAberto === null) return;
    const fecharDropdown = () => setCategoriaDropdownAberto(null);
    document.addEventListener("click", fecharDropdown);
    return () => document.removeEventListener("click", fecharDropdown);
  }, [categoriaDropdownAberto]);

  async function carregarCupons() {
    const { data, error } = await supabase
      .from("cupons" as any)
      .select("*")
      .order("criado_em", { ascending: false });
    if (!error && data) setCupons(data as unknown as Cupom[]);
  }

  async function carregarProdutos() {
    try {
      const items = await getAllMenuItems();
      setMenuItems(items.filter((i) => i.available !== false));
    } catch (e) {
      console.error("Erro ao carregar produtos:", e);
    }
  }

  async function carregarCategorias() {
    try {
      const cats = await getAllCategories();
      setCategories(cats);
    } catch (e) {
      console.error("Erro ao carregar categorias:", e);
    }
  }

  async function salvarCupom() {
    if (!form.nome || !form.nome.trim()) {
      toast({
        title: "Código obrigatório",
        description: "Informe o código do cupom.",
        variant: "destructive",
      });
      return;
    }
    // Validações específicas de "compre e ganhe"
    if (form.tipo === "compre_e_ganhe") {
      if (!form.produtos_requeridos || form.produtos_requeridos.length < 1) {
        toast({
          title: "Configuração incompleta",
          description: "Adicione pelo menos 1 item exigido.",
          variant: "destructive",
        });
        return;
      }
      const itemInvalido = form.produtos_requeridos.find((p) =>
        p.tipo === "categoria"
          ? !((p.category_ids && p.category_ids.length > 0) || p.category_id)
          : !p.product_id
      );
      if (itemInvalido) {
        toast({
          title: "Configuração incompleta",
          description: "Selecione o produto ou a categoria em todas as linhas exigidas.",
          variant: "destructive",
        });
        return;
      }
      const brinde = form.produto_brinde;
      if (!brinde) {
        toast({
          title: "Configuração incompleta",
          description: "Configure o brinde.",
          variant: "destructive",
        });
        return;
      }
      if (brinde.modo === "escolha") {
        if (!brinde.opcoes || brinde.opcoes.length < 2) {
          toast({
            title: "Configuração incompleta",
            description: "Adicione pelo menos 2 opções de brinde para o cliente escolher.",
            variant: "destructive",
          });
          return;
        }
        if (brinde.opcoes.some((o) => !o.product_id)) {
          toast({
            title: "Configuração incompleta",
            description: "Selecione o produto em todas as opções de brinde.",
            variant: "destructive",
          });
          return;
        }
      } else if (!brinde.product_id) {
        toast({
          title: "Configuração incompleta",
          description: "Selecione o produto brinde.",
          variant: "destructive",
        });
        return;
      }
    }


    setLoading(true);

    const payload = {
      ...form,
      // Para compre_e_ganhe, valor pode ser 0 (não é usado para desconto monetário)
      valor: form.tipo === "frete_gratis" || form.tipo === "compre_e_ganhe" ? 0 : (form.valor || 0),
    };

    if (editando) {
      const { error } = await supabase
        .from("cupons" as any)
        .update(payload as any)
        .eq("id", editando.id);
      setLoading(false);
      if (!error) {
        setOpen(false);
        setEditando(null);
        carregarCupons();
      } else {
        toast({ title: "Erro ao atualizar cupom", description: error.message, variant: "destructive" });
      }
    } else {
      const { error } = await supabase.from("cupons" as any).insert([payload as any]);
      setLoading(false);
      if (!error) {
        setOpen(false);
        carregarCupons();
      } else {
        toast({ title: "Erro ao salvar cupom", description: error.message, variant: "destructive" });
      }
    }
  }

  async function toggleAtivo(cupom: Cupom) {
    await supabase
      .from("cupons" as any)
      .update({ ativo: !cupom.ativo } as any)
      .eq("id", cupom.id);
    carregarCupons();
  }

  async function deletarCupom(id: string) {
    if (confirm("Tem certeza que deseja excluir este cupom?")) {
      await supabase.from("cupons" as any).delete().eq("id", id);
      carregarCupons();
    }
  }

  useEffect(() => {
    carregarCupons();
    carregarProdutos();
    carregarCategorias();
  }, []);

  function abrirEdicao(c: Cupom) {
    setEditando(c);
    setForm({
      ...c,
      produtos_requeridos: c.produtos_requeridos ?? [],
      produto_brinde: c.produto_brinde ?? null,
    });
    setOpen(true);
  }

  function abrirCriacao() {
    setEditando(null);
    setForm(initialForm);
    setOpen(true);
  }

  function duplicarCupom(c: Cupom) {
    setEditando(null);
    const { id, criado_em, usos, ...rest } = c as any;
    setForm({
      ...rest,
      nome: "",
      produtos_requeridos: c.produtos_requeridos ?? [],
      produto_brinde: c.produto_brinde ?? null,
    });
    setOpen(true);
  }

  // === Handlers de produtos exigidos ===
  function adicionarProdutoRequerido() {
    setForm((prev) => ({
      ...prev,
      produtos_requeridos: [
        ...(prev.produtos_requeridos || []),
        { tipo: "produto", product_id: "", product_name: "", quantidade: 1 },
      ],
    }));
  }

  function alterarTipoRequerido(index: number, tipo: "produto" | "categoria") {
    setForm((prev) => {
      const arr = [...(prev.produtos_requeridos || [])];
      arr[index] = {
        ...arr[index],
        tipo,
        product_id: "",
        product_name: "",
        category_id: undefined,
        category_name: undefined,
        category_ids: [],
        category_names: [],
      };
      return { ...prev, produtos_requeridos: arr };
    });
  }

  function atualizarProdutoRequerido(index: number, productId: string) {
    const produto = menuItems.find((p) => p.id === productId);
    setForm((prev) => {
      const arr = [...(prev.produtos_requeridos || [])];
      arr[index] = {
        ...arr[index],
        tipo: "produto",
        product_id: productId,
        product_name: produto?.name || "",
      };
      return { ...prev, produtos_requeridos: arr };
    });
  }

  function alternarCategoriaRequerida(index: number, categoryId: string) {
    const categoria = categories.find((c) => c.id === categoryId);
    if (!categoria) return;
    setForm((prev) => {
      const arr = [...(prev.produtos_requeridos || [])];
      const atual = arr[index];
      const ids = atual.category_ids ? [...atual.category_ids] : (atual.category_id ? [atual.category_id] : []);
      const names = atual.category_names ? [...atual.category_names] : (atual.category_name ? [atual.category_name] : []);
      const pos = ids.indexOf(categoryId);
      if (pos >= 0) {
        ids.splice(pos, 1);
        names.splice(pos, 1);
      } else {
        ids.push(categoryId);
        names.push(categoria.name);
      }
      arr[index] = {
        ...atual,
        tipo: "categoria",
        category_ids: ids,
        category_names: names,
        category_id: ids[0],
        category_name: names[0],
      };
      return { ...prev, produtos_requeridos: arr };
    });
  }

  function atualizarQuantidadeRequerida(index: number, qtd: number) {
    setForm((prev) => {
      const arr = [...(prev.produtos_requeridos || [])];
      arr[index] = { ...arr[index], quantidade: Math.max(1, qtd) };
      return { ...prev, produtos_requeridos: arr };
    });
  }

  function removerProdutoRequerido(index: number) {
    setForm((prev) => ({
      ...prev,
      produtos_requeridos: (prev.produtos_requeridos || []).filter((_, i) => i !== index),
    }));
  }

  // === Handlers do brinde ===
  function selecionarBrinde(productId: string) {
    const produto = menuItems.find((p) => p.id === productId);
    setForm((prev) => ({
      ...prev,
      produto_brinde: {
        ...(prev.produto_brinde || {}),
        product_id: productId,
        product_name: produto?.name || "",
        quantidade: prev.produto_brinde?.quantidade || 1,
        modo: prev.produto_brinde?.modo || "fixo",
        opcoes: prev.produto_brinde?.opcoes || [],
      } as ProdutoRef,
    }));
  }

  function atualizarQuantidadeBrinde(qtd: number) {
    setForm((prev) => ({
      ...prev,
      produto_brinde: prev.produto_brinde
        ? { ...prev.produto_brinde, quantidade: Math.max(1, qtd) }
        : null,
    }));
  }

  function alterarModoBrinde(modo: "fixo" | "escolha") {
    setForm((prev) => ({
      ...prev,
      produto_brinde: {
        ...(prev.produto_brinde || ({} as ProdutoRef)),
        modo,
        product_id: prev.produto_brinde?.product_id || "",
        product_name: prev.produto_brinde?.product_name || "",
        quantidade: prev.produto_brinde?.quantidade || 1,
        opcoes: prev.produto_brinde?.opcoes || [],
      } as ProdutoRef,
    }));
  }

  function adicionarOpcaoBrinde() {
    setForm((prev) => ({
      ...prev,
      produto_brinde: {
        ...(prev.produto_brinde || ({} as ProdutoRef)),
        modo: "escolha",
        product_id: prev.produto_brinde?.product_id || "",
        product_name: prev.produto_brinde?.product_name || "",
        quantidade: prev.produto_brinde?.quantidade || 1,
        opcoes: [
          ...(prev.produto_brinde?.opcoes || []),
          { product_id: "", product_name: "" },
        ],
      } as ProdutoRef,
    }));
  }

  function atualizarOpcaoBrinde(index: number, productId: string) {
    const produto = menuItems.find((p) => p.id === productId);
    setForm((prev) => {
      const opcoes = [...(prev.produto_brinde?.opcoes || [])];
      opcoes[index] = { product_id: productId, product_name: produto?.name || "" };
      return {
        ...prev,
        produto_brinde: {
          ...(prev.produto_brinde as ProdutoRef),
          opcoes,
        },
      };
    });
  }

  function removerOpcaoBrinde(index: number) {
    setForm((prev) => ({
      ...prev,
      produto_brinde: prev.produto_brinde
        ? {
            ...prev.produto_brinde,
            opcoes: (prev.produto_brinde.opcoes || []).filter((_, i) => i !== index),
          }
        : null,
    }));
  }


  return (
  <div className="p-6 space-y-6">
    <AdminPageHeader title="Cupons de Desconto" icon={PageIcon} iconBg="bg-purple-100" iconColor="text-purple-600" />
    <div className="flex justify-end">
      <Button onClick={abrirCriacao}>Novo Cupom</Button>
    </div>
    {/* ... restante do código ... */}


      {/* Modal Criar/Editar */}
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) setCategoriaDropdownAberto(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar Cupom" : "Criar Cupom"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Código do Cupom <span className="text-destructive">*</span></Label>
              <Input
                value={form.nome || ""}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.descricao || ""}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                className="w-full border rounded p-2"
                value={form.tipo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tipo: e.target.value as TipoCupom,
                    valor:
                      e.target.value === "frete_gratis" || e.target.value === "compre_e_ganhe"
                        ? 0
                        : form.valor || 0,
                  })
                }
              >
                <option value="percentual">Percentual (%)</option>
                <option value="fixo">Valor Fixo (R$)</option>
                <option value="frete_gratis">Frete Grátis</option>
                <option value="compre_e_ganhe">Compre e Ganhe (Brinde)</option>
              </select>
            </div>

            {form.tipo !== "frete_gratis" && form.tipo !== "compre_e_ganhe" && (
              <div>
                <Label>Valor</Label>
                <Input
                  type="number"
                  value={form.valor || 0}
                  onChange={(e) =>
                    setForm({ ...form, valor: Number(e.target.value) })
                  }
                />
              </div>
            )}

            {/* Configuração específica de Compre e Ganhe */}
            {form.tipo === "compre_e_ganhe" && (
              <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="font-semibold">Produtos exigidos</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={adicionarProdutoRequerido}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    O cliente precisa ter todos esses itens no carrinho. Cada linha pode exigir um produto específico ou qualquer item de uma categoria.
                  </p>

                  {(form.produtos_requeridos || []).length === 0 && (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhum item adicionado.
                    </p>
                  )}

                  <div className="space-y-2">
                    {(form.produtos_requeridos || []).map((p, idx) => {
                      const tipoAtual = p.tipo === "categoria" ? "categoria" : "produto";
                      return (
                        <div key={idx} className="flex gap-2 items-start">
                          <div className="w-28 shrink-0">
                            <Select
                              value={tipoAtual}
                              onValueChange={(value) =>
                                alterarTipoRequerido(idx, value as "produto" | "categoria")
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="produto">Produto</SelectItem>
                                <SelectItem value="categoria">Categoria</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            {tipoAtual === "produto" ? (
                              <Select
                                value={p.product_id || undefined}
                                onValueChange={(value) => atualizarProdutoRequerido(idx, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o produto" />
                                </SelectTrigger>
                                <SelectContent>
                                  {menuItems.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              (() => {
                                const selectedIds = p.category_ids && p.category_ids.length > 0
                                  ? p.category_ids
                                  : (p.category_id ? [p.category_id] : []);
                                const selectedNames = categories
                                  .filter((c) => selectedIds.includes(c.id))
                                  .map((c) => c.name);
                                return (
                                  <div className="relative">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="w-full justify-between font-normal"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setCategoriaDropdownAberto((aberto) => aberto === idx ? null : idx);
                                      }}
                                    >
                                      <span className="truncate text-left">
                                        {selectedNames.length > 0
                                          ? selectedNames.join(", ")
                                          : "Selecione as categorias"}
                                      </span>
                                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                                    </Button>
                                    {categoriaDropdownAberto === idx && (
                                      <div
                                        className="absolute left-0 top-full z-[100] mt-1 w-full min-w-64 max-h-64 overflow-auto rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {categories.length === 0 && (
                                          <div className="text-sm text-muted-foreground p-2">
                                            Nenhuma categoria disponível
                                          </div>
                                        )}
                                        {categories.map((cat) => {
                                          const checked = selectedIds.includes(cat.id);
                                          return (
                                            <button
                                              key={cat.id}
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                alternarCategoriaRequerida(idx, cat.id);
                                              }}
                                              className="w-full flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer select-none text-left"
                                            >
                                              <Checkbox
                                                checked={checked}
                                                tabIndex={-1}
                                                className="pointer-events-none"
                                              />
                                              <span className="text-sm">{cat.name}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            )}
                          </div>
                          <Input
                            type="number"
                            min={1}
                            className="w-20"
                            value={p.quantidade}
                            onChange={(e) =>
                              atualizarQuantidadeRequerida(idx, Number(e.target.value))
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removerProdutoRequerido(idx)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-1">
                    <Gift className="h-4 w-4" /> Brinde
                  </Label>

                  <div>
                    <Label className="text-xs">Modo do brinde</Label>
                    <Select
                      value={form.produto_brinde?.modo || "fixo"}
                      onValueChange={(v) => alterarModoBrinde(v as "fixo" | "escolha")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixo">Produto único (definido por você)</SelectItem>
                        <SelectItem value="escolha">Grupo de opções (cliente escolhe)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(form.produto_brinde?.modo || "fixo") === "fixo" ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Será adicionado ao carrinho com valor R$ 0,00 quando o cupom for aplicado.
                      </p>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <Select
                            value={form.produto_brinde?.product_id || undefined}
                            onValueChange={selecionarBrinde}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o brinde" />
                            </SelectTrigger>
                            <SelectContent>
                              {[...menuItems]
                                .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }))
                                .map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          className="w-20"
                          value={form.produto_brinde?.quantidade || 1}
                          onChange={(e) => atualizarQuantidadeBrinde(Number(e.target.value))}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        O cliente verá esta lista no carrinho e escolherá um dos itens como brinde.
                      </p>
                      <div>
                        <Label className="text-xs">Quantidade do brinde escolhido</Label>
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          value={form.produto_brinde?.quantidade || 1}
                          onChange={(e) => atualizarQuantidadeBrinde(Number(e.target.value))}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <Label className="text-xs">Opções de brinde</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={adicionarOpcaoBrinde}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Adicionar opção
                        </Button>
                      </div>
                      {(form.produto_brinde?.opcoes || []).length === 0 && (
                        <p className="text-sm text-muted-foreground italic">
                          Nenhuma opção adicionada.
                        </p>
                      )}
                      <div className="space-y-2">
                        {(form.produto_brinde?.opcoes || []).map((opt, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <div className="flex-1">
                              <Select
                                value={opt.product_id || undefined}
                                onValueChange={(v) => atualizarOpcaoBrinde(idx, v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o produto" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[...menuItems]
                                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }))
                                    .map((item) => (
                                      <SelectItem key={item.id} value={item.id}>
                                        {item.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removerOpcaoBrinde(idx)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

              </div>
            )}

            <div>
              <Label>Data Início</Label>
              <Input
                type="date"
                value={form.data_inicio || ""}
                onChange={(e) =>
                  setForm({ ...form, data_inicio: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={form.data_fim || ""}
                onChange={(e) =>
                  setForm({ ...form, data_fim: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Limite Total de Uso</Label>
              <Input
                type="number"
                value={form.limite_uso || ""}
                onChange={(e) =>
                  setForm({ ...form, limite_uso: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Usos por Usuário</Label>
              <Input
                type="number"
                value={form.usos_por_usuario || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    usos_por_usuario: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Valor Mínimo do Pedido</Label>
              <Input
                type="number"
                value={form.valor_minimo_pedido || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    valor_minimo_pedido: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={form.primeira_compra_apenas || false}
                onCheckedChange={(checked) =>
                  setForm({ ...form, primeira_compra_apenas: checked })
                }
              />
              <Label>Válido apenas para primeira compra</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={form.ativo || false}
                onCheckedChange={(checked) =>
                  setForm({ ...form, ativo: checked })
                }
              />
              <Label>Ativo</Label>
            </div>
            <Button onClick={salvarCupom} disabled={loading}>
              {loading
                ? "Salvando..."
                : editando
                ? "Salvar Alterações"
                : "Criar Cupom"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Listagem de Cupons */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cupons.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-center">
                <h2 className="font-bold">{c.nome}</h2>
                <Switch
                  checked={c.ativo}
                  onCheckedChange={() => toggleAtivo(c)}
                />
              </div>
              <p className="text-sm text-gray-600">{c.descricao}</p>
              <p className="text-sm">
                {c.tipo === "percentual"
                  ? `${c.valor}%`
                  : c.tipo === "frete_gratis"
                  ? "🚚 Frete Grátis"
                  : c.tipo === "compre_e_ganhe"
                  ? "🎁 Compre e Ganhe"
                  : `R$${c.valor}`}
              </p>

              {c.tipo === "compre_e_ganhe" && (
                <div className="text-xs space-y-1 bg-muted/40 rounded p-2">
                  <p className="font-semibold">Exigidos:</p>
                  <ul className="list-disc list-inside">
                    {(c.produtos_requeridos || []).map((p, i) => {
                      const label =
                        p.tipo === "categoria"
                          ? `Categoria: ${
                              (p.category_names && p.category_names.length > 0
                                ? p.category_names
                                : p.category_name
                                ? [p.category_name]
                                : []
                              ).join(", ") || "—"
                            }`
                          : p.product_name;
                      return (
                        <li key={i}>
                          {p.quantidade}x {label}
                        </li>
                      );
                    })}
                  </ul>
                  {c.produto_brinde && (
                    c.produto_brinde.modo === "escolha" ? (
                      <div className="pt-1">
                        <p className="font-semibold flex items-center gap-1">
                          <Gift className="h-3 w-3" /> Brinde (escolha do cliente):{" "}
                          {c.produto_brinde.quantidade}x
                        </p>
                        <ul className="list-disc list-inside ml-2">
                          {(c.produto_brinde.opcoes || []).map((o, i) => (
                            <li key={i}>{o.product_name}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="font-semibold flex items-center gap-1 pt-1">
                        <Gift className="h-3 w-3" /> Brinde:{" "}
                        {c.produto_brinde.quantidade}x {c.produto_brinde.product_name}
                      </p>
                    )
                  )}

                </div>
              )}

              {c.primeira_compra_apenas && (
                <p className="text-xs font-semibold text-primary bg-primary/10 rounded px-2 py-1 inline-block">
                  ⭐ Válido apenas para primeira compra
                </p>
              )}
              <p className="text-xs text-gray-500">
                Validade: {format(new Date(c.data_inicio), "dd/MM/yyyy")} -{" "}
                {format(new Date(c.data_fim), "dd/MM/yyyy")}
              </p>
              <div className="flex justify-between gap-2 mt-2">
                <Button size="sm" onClick={() => abrirEdicao(c)}>
                  Editar
                </Button>
                <Button size="sm" variant="secondary" onClick={() => duplicarCupom(c)}>
                  Duplicar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deletarCupom(c.id)}
                >
                  Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
