
import React, { useState } from "react";
import { VariationGroup, Variation, MenuItem } from "@/types/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Save, XCircle, ChevronUp, ChevronDown } from "lucide-react";
import { saveVariationGroup } from "@/services/variationGroupService";
import { saveVariation } from "@/services/variationService";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EditVariationGroupModalProps {
  editVariationGroup: VariationGroup;
  setEditVariationGroup: (group: VariationGroup | null) => void;
  variations: Variation[];
  menuItems: MenuItem[];
  variationGroups: VariationGroup[];
  onSuccess: () => void;
}

export const EditVariationGroupModal = ({
  editVariationGroup,
  setEditVariationGroup,
  variations,
  menuItems,
  variationGroups,
  onSuccess,
}: EditVariationGroupModalProps) => {
  const { toast } = useToast();
  const [sourceMode, setSourceMode] = useState<"menu" | "created" | "both">("created");
  const [showNewVariationForm, setShowNewVariationForm] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [newVarDescription, setNewVarDescription] = useState("");
  const [newVarPrice, setNewVarPrice] = useState<string>("0");
  const [savingNewVar, setSavingNewVar] = useState(false);

  const handleCreateNewVariation = async () => {
    if (!newVarName.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome da nova variação", variant: "destructive" });
      return;
    }
    try {
      setSavingNewVar(true);
      const newId = await saveVariation({
        id: "",
        name: newVarName.trim(),
        description: newVarDescription.trim(),
        additionalPrice: Number(newVarPrice) || 0,
        available: true,
        categoryIds: [],
      });
      setEditVariationGroup({
        ...editVariationGroup,
        variations: [...(editVariationGroup.variations || []), newId],
      });
      setNewVarName("");
      setNewVarDescription("");
      setNewVarPrice("0");
      setShowNewVariationForm(false);
      toast({ title: "Variação criada", description: "Nova variação adicionada ao grupo" });
      onSuccess();
    } catch (error) {
      toast({ title: "Erro", description: `Não foi possível criar a variação: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setSavingNewVar(false);
    }
  };

  const handleVariationCheckboxChange = (variationId: string) => {
    const currentVariations = editVariationGroup.variations || [];
    const updatedVariations = currentVariations.includes(variationId)
      ? currentVariations.filter(id => id !== variationId)
      : [...currentVariations, variationId];
    
    setEditVariationGroup({
      ...editVariationGroup,
      variations: updatedVariations
    });
  };

  const moveSelectedVariation = (variationId: string, direction: "up" | "down") => {
    const current = [...(editVariationGroup.variations || [])];
    const idx = current.indexOf(variationId);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= current.length) return;
    [current[idx], current[newIdx]] = [current[newIdx], current[idx]];
    setEditVariationGroup({ ...editVariationGroup, variations: current });
  };

  const handleSaveVariationGroup = async () => {
    if (!editVariationGroup.name) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do grupo de variação é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!editVariationGroup.variations || editVariationGroup.variations.length === 0) {
      toast({
        title: "Variações obrigatórias",
        description: "Selecione pelo menos uma variação para o grupo",
        variant: "destructive",
      });
      return;
    }

    if (editVariationGroup.minRequired > editVariationGroup.maxAllowed) {
      toast({
        title: "Valores inválidos",
        description: "O mínimo obrigatório não pode ser maior que o máximo permitido",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if we're creating a new group or updating an existing one
      const isNew = !editVariationGroup.id || !variationGroups.some(g => g.id === editVariationGroup.id);

      // Clonar quaisquer itens do cardápio que foram adicionados como variação,
      // criando variações independentes para que edições não afetem o item original.
      const existingVariationIds = new Set(variations.map(v => v.id));
      const resolvedVariationIds: string[] = [];
      for (const id of editVariationGroup.variations || []) {
        if (existingVariationIds.has(id)) {
          resolvedVariationIds.push(id);
          continue;
        }
        const sourceItem = menuItems.find(m => m.id === id);
        if (sourceItem) {
          const newId = await saveVariation({
            id: "",
            name: sourceItem.name,
            description: sourceItem.description || "",
            additionalPrice: sourceItem.price || 0,
            available: sourceItem.available !== false,
            categoryIds: sourceItem.category ? [sourceItem.category] : [],
          });
          resolvedVariationIds.push(newId);
        } else {
          // Mantém o ID original (pode ser uma variação carregada de outro contexto)
          resolvedVariationIds.push(id);
        }
      }

      const groupToSave = { ...editVariationGroup, variations: resolvedVariationIds };
      const savedId = await saveVariationGroup(groupToSave);

      // Sincronizar os itens de menu com as novas variações
      const { syncMenuItemsWithVariationGroup } = await import("@/services/variationGroupService");
      await syncMenuItemsWithVariationGroup(savedId, resolvedVariationIds);

      setEditVariationGroup(null);
      toast({
        title: "Sucesso",
        description: isNew
          ? "Grupo de variação criado e itens sincronizados com sucesso"
          : "Grupo de variação atualizado e itens sincronizados com sucesso",
      });
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar grupo de variação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o grupo de variação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const isNew = !editVariationGroup.id || !variationGroups.some(g => g.id === editVariationGroup.id);

  return (
    <Dialog open={!!editVariationGroup} onOpenChange={(open) => !open && setEditVariationGroup(null)}>
      <DialogContent className="max-w-md h-[85vh] flex flex-col p-0">
        <div className="flex justify-between items-center p-6 pb-4 flex-shrink-0 border-b">
          <h2 className="text-xl font-bold">
            {isNew ? "Novo Grupo de Variações" : "Editar Grupo de Variações"}
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setEditVariationGroup(null)}
          >
            <XCircle className="h-5 w-5" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
            <div>
              <Label htmlFor="group-name">Nome do Grupo</Label>
              <Input
                id="group-name"
                value={editVariationGroup.name}
                onChange={(e) => setEditVariationGroup({...editVariationGroup, name: e.target.value})}
                placeholder="Ex: Sabores, Recheios, Complementos"
              />
            </div>

<div>
  <Label htmlFor="internal-name">Nome Interno</Label>
  <Input
    id="internal-name"
    value={editVariationGroup.internalName || ""}
    onChange={(e) =>
      setEditVariationGroup({
        ...editVariationGroup,
        internalName: e.target.value,
      })
    }
    placeholder="Ex: pizza_sabores, adicionais_doces"
  />
  <p className="text-xs text-gray-500 mt-1">
    Esse nome é usado apenas internamente no painel administrativo
  </p>
</div>

            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min-required">Mínimo Obrigatório</Label>
                <Input
                  id="min-required"
                  type="number"
                  min="0"
                  value={editVariationGroup.minRequired}
                  onChange={(e) => setEditVariationGroup({
                    ...editVariationGroup, 
                    minRequired: parseInt(e.target.value)
                  })}
                />
              </div>
              <div>
                <Label htmlFor="max-allowed">Máximo Permitido</Label>
                <Input
                  id="max-allowed"
                  type="number"
                  min="1"
                  value={editVariationGroup.maxAllowed}
                  onChange={(e) => setEditVariationGroup({
                    ...editVariationGroup, 
                    maxAllowed: parseInt(e.target.value)
                  })}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="custom-message">Mensagem Personalizada (opcional)</Label>
              <Input
                id="custom-message"
                value={editVariationGroup.customMessage || ""}
                onChange={(e) => setEditVariationGroup({
                  ...editVariationGroup, 
                  customMessage: e.target.value
                })}
                placeholder="Ex: Escolha {min} opções"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {"{min}"} para o número mínimo, {"{max}"} para o máximo e {"{count}"} para quantidade selecionada
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Fonte das Variações</Label>
              <Select value={sourceMode} onValueChange={(v) => setSourceMode(v as "menu" | "created" | "both")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="menu">Variações Menu</SelectItem>
                  <SelectItem value="created">Variações Criadas</SelectItem>
                  <SelectItem value="both">Ambas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Use as setas ↑↓ para definir a ordem em que as variações selecionadas serão exibidas ao cliente.
              </p>

              {(sourceMode === "created" || sourceMode === "both") && (
                <div className="border rounded-md p-2 bg-muted/20">
                  {!showNewVariationForm ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowNewVariationForm(true)}
                    >
                      + Criar nova Variação
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_110px] gap-2">
                        <div>
                          <Label htmlFor="new-var-name" className="text-xs">Nome</Label>
                          <Input
                            id="new-var-name"
                            value={newVarName}
                            onChange={(e) => setNewVarName(e.target.value)}
                            placeholder="Nome da variação"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-var-price" className="text-xs">Preço adicional</Label>
                          <Input
                            id="new-var-price"
                            type="number"
                            step="0.01"
                            min="0"
                            value={newVarPrice}
                            onChange={(e) => setNewVarPrice(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="new-var-description" className="text-xs">Descrição</Label>
                        <Textarea
                          id="new-var-description"
                          value={newVarDescription}
                          onChange={(e) => setNewVarDescription(e.target.value)}
                          placeholder="Descrição da variação (opcional)"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowNewVariationForm(false);
                            setNewVarName("");
                            setNewVarDescription("");
                            setNewVarPrice("0");
                          }}
                          disabled={savingNewVar}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreateNewVariation}
                          disabled={savingNewVar}
                        >
                          {savingNewVar ? "Salvando..." : "Criar e selecionar"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sourceMode === "created" && (
                <VariationSourceBox
                  title="Variações Criadas"
                  options={variations.map(v => ({ id: v.id, name: v.name, additionalPrice: v.additionalPrice }))}
                  selectedIds={editVariationGroup.variations || []}
                  onToggle={handleVariationCheckboxChange}
                  onMove={moveSelectedVariation}
                  emptyMessage="Nenhuma variação disponível. Adicione variações primeiro."
                />
              )}

              {sourceMode === "menu" && (
                <VariationSourceBox
                  title="Itens do Cardápio"
                  options={menuItems.map(m => ({ id: m.id, name: m.name, additionalPrice: m.price }))}
                  selectedIds={editVariationGroup.variations || []}
                  onToggle={handleVariationCheckboxChange}
                  onMove={moveSelectedVariation}
                  emptyMessage="Nenhum item do cardápio disponível."
                />
              )}

              {sourceMode === "both" && (
                <div className="space-y-3">
                  <VariationSourceBox
                    title="Itens do Cardápio"
                    options={menuItems.map(m => ({ id: m.id, name: m.name, additionalPrice: m.price }))}
                    selectedIds={editVariationGroup.variations || []}
                    onToggle={handleVariationCheckboxChange}
                    onMove={moveSelectedVariation}
                    emptyMessage="Nenhum item do cardápio disponível."
                  />
                  <VariationSourceBox
                    title="Variações Criadas"
                    options={variations.map(v => ({ id: v.id, name: v.name, additionalPrice: v.additionalPrice }))}
                    selectedIds={editVariationGroup.variations || []}
                    onToggle={handleVariationCheckboxChange}
                    onMove={moveSelectedVariation}
                    emptyMessage="Nenhuma variação disponível. Adicione variações primeiro."
                  />
                </div>
              )}
            </div>


            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="applyToHalfPizza"
                checked={editVariationGroup.applyToHalfPizza || false}
                onCheckedChange={(checked) =>
                  setEditVariationGroup({ ...editVariationGroup, applyToHalfPizza: checked as boolean })
                }
              />
              <Label htmlFor="applyToHalfPizza" className="text-sm font-normal cursor-pointer">
                Aplicar a pizzas meio a meio
              </Label>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="allowPerHalf"
                checked={editVariationGroup.allowPerHalf || false}
                onCheckedChange={(checked) =>
                  setEditVariationGroup({ ...editVariationGroup, allowPerHalf: checked as boolean })
                }
              />
              <Label htmlFor="allowPerHalf" className="text-sm font-normal cursor-pointer">
                Permitir adicionar em cada metade (pizza meio a meio)
              </Label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Quando ativo, o cliente pode escolher se o adicional vai na metade 1, metade 2 ou pizza inteira
            </p>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="collapsible"
                checked={editVariationGroup.collapsible || false}
                onCheckedChange={(checked) =>
                  setEditVariationGroup({ ...editVariationGroup, collapsible: checked as boolean })
                }
              />
              <Label htmlFor="collapsible" className="text-sm font-normal cursor-pointer">
                Menu recolhível (sanfona)
              </Label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Exibe o grupo como um dropdown sanfona no cardápio. Útil quando o grupo tem muitos itens.
            </p>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="hideMainQuantitySelector"
                checked={editVariationGroup.hideMainQuantitySelector || false}
                onCheckedChange={(checked) =>
                  setEditVariationGroup({ ...editVariationGroup, hideMainQuantitySelector: checked as boolean })
                }
              />
              <Label htmlFor="hideMainQuantitySelector" className="text-sm font-normal cursor-pointer">
                Esconder Seletor de Quantidades Principal
              </Label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Quando ativo, o seletor de quantidade do item não é exibido no modal de variações.
            </p>
          </div>
        </ScrollArea>
        
        <div className="flex justify-end gap-2 p-6 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => setEditVariationGroup(null)}>
            Cancelar
          </Button>
          <Button onClick={handleSaveVariationGroup}>
            <Save className="h-4 w-4 mr-1" />
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface SourceOption {
  id: string;
  name: string;
  additionalPrice?: number;
}

interface VariationSourceBoxProps {
  title: string;
  options: SourceOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  emptyMessage: string;
}

const VariationSourceBox = ({
  title,
  options,
  selectedIds,
  onToggle,
  onMove,
  emptyMessage,
}: VariationSourceBoxProps) => {
  const selected = selectedIds
    .map(id => options.find(o => o.id === id))
    .filter((o): o is SourceOption => !!o);
  const unselected = options
    .filter(o => !selectedIds.includes(o.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  return (
    <div className="border rounded-md">
      <div className="px-3 py-2 border-b bg-muted/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">{title}</p>
      </div>
      <div className="max-h-60 overflow-y-auto p-2">
        {selected.length > 0 && (
          <div className="mb-2">
            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide px-1 py-1">
              Selecionadas (ordem de exibição)
            </p>
            {selected.map((opt, idx) => (
              <div key={opt.id} className="flex items-center gap-1 py-1 bg-blue-50/40 rounded px-1">
                <div className="flex flex-col">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0"
                    onClick={() => onMove(opt.id, "up")}
                    disabled={idx === 0}
                    title="Mover para cima"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0"
                    onClick={() => onMove(opt.id, "down")}
                    disabled={idx === selected.length - 1}
                    title="Mover para baixo"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <span className="text-xs text-gray-400 w-5">#{idx + 1}</span>
                <Checkbox
                  id={`src-${title}-${opt.id}`}
                  checked
                  onCheckedChange={() => onToggle(opt.id)}
                />
                <Label htmlFor={`src-${title}-${opt.id}`} className="cursor-pointer">
                  {opt.name}
                  {opt.additionalPrice && opt.additionalPrice > 0 ? ` (+R$ ${opt.additionalPrice.toFixed(2)})` : ""}
                </Label>
              </div>
            ))}
          </div>
        )}

        {unselected.length > 0 && (
          <div>
            {selected.length > 0 && (
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide px-1 py-1 border-t mt-1 pt-2">
                Disponíveis
              </p>
            )}
            {unselected.map((opt) => (
              <div key={opt.id} className="flex items-center space-x-2 py-1 pl-7">
                <Checkbox
                  id={`src-${title}-${opt.id}`}
                  checked={false}
                  onCheckedChange={() => onToggle(opt.id)}
                />
                <Label htmlFor={`src-${title}-${opt.id}`} className="cursor-pointer">
                  {opt.name}
                  {opt.additionalPrice && opt.additionalPrice > 0 ? ` (+R$ ${opt.additionalPrice.toFixed(2)})` : ""}
                </Label>
              </div>
            ))}
          </div>
        )}

        {options.length === 0 && (
          <p className="text-sm text-gray-500 py-2">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
};
