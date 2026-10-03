import React, { useState } from "react";
import { MenuItem, Variation, VariationGroup, PizzaBorder } from "@/types/menu";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AddVariationGroupModal } from "./AddVariationGroupModal";
import { PizzaBordersSection } from "./PizzaBordersSection";
import { formatCurrency } from "@/lib/utils";

interface VariationGroupsSectionProps {
  editItem: MenuItem;
  setEditItem: (item: MenuItem) => void;
  variations: Variation[];
  variationGroups: VariationGroup[];
  pizzaBorders?: PizzaBorder[];
  onDataChange?: () => void;
  menuItems?: MenuItem[];
}

type SectionItem =
  | { type: "group"; index: number; group: VariationGroup }
  | { type: "borders" };

export const VariationGroupsSection = ({
  editItem,
  setEditItem,
  variations,
  variationGroups,
  pizzaBorders = [],
  onDataChange,
  menuItems = [],
}: VariationGroupsSectionProps) => {
  const [tempVariationGroup, setTempVariationGroup] = useState<VariationGroup | null>(null);

  const isPizza = editItem.tipo === "pizza";
  const showBorders = isPizza && pizzaBorders.length > 0;

  // Build ordered list of sections (variation groups + borders block)
  const buildSections = (): SectionItem[] => {
    const groups: SectionItem[] = (editItem.variationGroups || []).map((group, index) => ({
      type: "group" as const,
      index,
      group,
    }));

    if (!showBorders) return groups;

    const bordersPos = editItem.bordersPosition ?? groups.length;
    const clampedPos = Math.max(0, Math.min(bordersPos, groups.length));

    const result: SectionItem[] = [];
    let inserted = false;
    for (let i = 0; i <= groups.length; i++) {
      if (i === clampedPos && !inserted) {
        result.push({ type: "borders" });
        inserted = true;
      }
      if (i < groups.length) {
        result.push(groups[i]);
      }
    }
    if (!inserted) result.push({ type: "borders" });

    return result;
  };

  const sections = buildSections();

  const handleMoveSection = (sectionIndex: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? sectionIndex - 1 : sectionIndex + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;

    const current = sections[sectionIndex];
    const target = sections[newIdx];

    if (current.type === "borders") {
      // Moving borders: recalculate its position among groups
      // Count how many groups come before the new position
      const newSections = [...sections];
      [newSections[sectionIndex], newSections[newIdx]] = [newSections[newIdx], newSections[sectionIndex]];
      const newBordersPos = newSections.findIndex(s => s.type === "borders");
      const groupsBefore = newSections.slice(0, newBordersPos).filter(s => s.type === "group").length;
      setEditItem({ ...editItem, bordersPosition: groupsBefore });
    } else if (target.type === "borders") {
      // Swapping a group with borders: update both
      const newSections = [...sections];
      [newSections[sectionIndex], newSections[newIdx]] = [newSections[newIdx], newSections[sectionIndex]];

      // Rebuild group order
      const reorderedGroups = newSections
        .filter((s): s is SectionItem & { type: "group" } => s.type === "group")
        .map(s => s.group);
      const newBordersPos = newSections.findIndex(s => s.type === "borders");
      const groupsBefore = newSections.slice(0, newBordersPos).filter(s => s.type === "group").length;

      setEditItem({
        ...editItem,
        variationGroups: reorderedGroups,
        bordersPosition: groupsBefore,
      });
    } else {
      // Two groups swapping: just reorder variationGroups
      const groupItems = sections.filter((s): s is SectionItem & { type: "group" } => s.type === "group");
      const idxA = groupItems.indexOf(current as any);
      const idxB = groupItems.indexOf(target as any);
      if (idxA === -1 || idxB === -1) return;

      const newGroups = [...(editItem.variationGroups || [])];
      [newGroups[idxA], newGroups[idxB]] = [newGroups[idxB], newGroups[idxA]];
      setEditItem({ ...editItem, variationGroups: newGroups });
    }
  };

  const handleAddVariationGroup = () => {
    setTempVariationGroup({
      id: crypto.randomUUID(),
      name: "",
      minRequired: 1,
      maxAllowed: 1,
      variations: [],
      customMessage: ""
    });
  };

  const handleSelectExistingGroup = (groupId: string) => {
    const selectedGroup = variationGroups.find(group => group.id === groupId);
    if (selectedGroup) {
      const isAlreadyAdded = editItem.variationGroups?.some(g => g.id === selectedGroup.id);
      if (!isAlreadyAdded) {
        setEditItem({
          ...editItem,
          hasVariations: true,
          variationGroups: [...(editItem.variationGroups || []), selectedGroup]
        });
      }
    }
  };

  const handleRemoveAllVariationGroups = () => {
    if (window.confirm("Tem certeza que deseja remover todos os grupos de variação deste item?")) {
      setEditItem({
        ...editItem,
        hasVariations: false,
        variationGroups: []
      });
    }
  };

  const getVariationName = (variationId: string): string => {
    const variation = variations.find(v => v.id === variationId);
    if (variation) return variation.name;
    const menuItem = menuItems.find(m => m.id === variationId);
    if (menuItem) return menuItem.name;
    return "Variação não encontrada";
  };

  const getVariationPrice = (variationId: string): number => {
    const variation = variations.find(v => v.id === variationId);
    if (variation) return variation.additionalPrice || 0;
    const menuItem = menuItems.find(m => m.id === variationId);
    return menuItem?.price || 0;
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Grupos de Variações</h3>
        <div className="flex gap-2">
          <Button 
            onClick={handleRemoveAllVariationGroups} 
            size="sm" 
            variant="destructive"
            className="px-2 py-1"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remover Todos
          </Button>
          <Button 
            onClick={handleAddVariationGroup} 
            size="sm" 
            variant="outline"
            className="px-2 py-1"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Novo Grupo
          </Button>
        </div>
      </div>
      
      {/* Dropdown to select existing variation groups */}
      <div className="mt-4 space-y-2">
        <Label>Adicionar Grupo Existente</Label>
        <div className="flex gap-2">
          <Select onValueChange={handleSelectExistingGroup}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um grupo existente" />
            </SelectTrigger>
            <SelectContent>
              {variationGroups
                .filter(group => !editItem.variationGroups?.some(g => g.id === group.id))
                .map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name} ({group.minRequired}-{group.maxAllowed}) 
                    {group.internalName ? ` — ${group.internalName}` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="mt-4 space-y-4">
        {sections.length > 0 ? (
          sections.map((section, sIdx) => {
            if (section.type === "borders") {
              return (
                <div key="borders-section" className="relative">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-1 mt-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMoveSection(sIdx, "up")}
                        disabled={sIdx === 0}
                        className="h-6 w-6 p-0"
                        title="Mover para cima"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMoveSection(sIdx, "down")}
                        disabled={sIdx === sections.length - 1}
                        className="h-6 w-6 p-0"
                        title="Mover para baixo"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1">
                      <PizzaBordersSection
                        editItem={editItem}
                        setEditItem={setEditItem}
                        pizzaBorders={pizzaBorders}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            const { group, index } = section;
            return (
              <div key={group.id} className="p-4 border rounded-md bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMoveSection(sIdx, "up")}
                        disabled={sIdx === 0}
                        className="h-6 w-6 p-0"
                        title="Mover para cima"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMoveSection(sIdx, "down")}
                        disabled={sIdx === sections.length - 1}
                        className="h-6 w-6 p-0"
                        title="Mover para baixo"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          #{sIdx + 1}
                        </span>
                        <h4 className="font-bold">{group.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {group.minRequired === group.maxAllowed
                          ? `Exatamente ${group.minRequired} seleção(ões) necessária(s)`
                          : `De ${group.minRequired} até ${group.maxAllowed} seleções`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        const newGroups = editItem.variationGroups?.filter(g => g.id !== group.id) || [];
                        setEditItem({
                          ...editItem,
                          variationGroups: newGroups,
                          hasVariations: newGroups.length > 0,
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                
                <div className="mt-2">
                  <p className="text-sm font-semibold">Variações:</p>
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    {group.variations.map((varId, vIdx) => {
                      const price = getVariationPrice(varId);
                      const name = getVariationName(varId);
                      const moveVariation = (direction: "up" | "down") => {
                        const newIdx = direction === "up" ? vIdx - 1 : vIdx + 1;
                        if (newIdx < 0 || newIdx >= group.variations.length) return;
                        const newVars = [...group.variations];
                        [newVars[vIdx], newVars[newIdx]] = [newVars[newIdx], newVars[vIdx]];
                        const newGroups = [...(editItem.variationGroups || [])];
                        newGroups[index] = { ...group, variations: newVars };
                        setEditItem({ ...editItem, variationGroups: newGroups });
                      };
                      return (
                        <div key={varId} className="flex items-center justify-between bg-white rounded px-3 py-2 border">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => moveVariation("up")}
                                disabled={vIdx === 0}
                                className="h-5 w-5 p-0"
                                title="Mover para cima"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => moveVariation("down")}
                                disabled={vIdx === group.variations.length - 1}
                                className="h-5 w-5 p-0"
                                title="Mover para baixo"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                            <span className="text-xs text-muted-foreground w-5">#{vIdx + 1}</span>
                            <span className="text-sm font-medium">{name}</span>
                          </div>
                          <span className="text-sm font-semibold text-green-600">
                            {price > 0 ? `+${formatCurrency(price)}` : 'Grátis'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {group.customMessage && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold">Mensagem personalizada:</p>
                    <p className="text-xs text-muted-foreground bg-white rounded px-2 py-1 border">"{group.customMessage}"</p>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-4 text-muted-foreground border rounded-md">
            Nenhum grupo de variação configurado para este item.
            <br />
            <span className="text-sm">
              Adicione grupos de variações para permitir que os clientes personalizem este item.
            </span>
          </div>
        )}
      </div>

      {tempVariationGroup && (
        <AddVariationGroupModal
          tempVariationGroup={tempVariationGroup}
          setTempVariationGroup={setTempVariationGroup}
          editItem={editItem}
          setEditItem={setEditItem}
          variations={variations}
          variationGroups={variationGroups}
          onDataChange={onDataChange}
        />
      )}
    </div>
  );
};
