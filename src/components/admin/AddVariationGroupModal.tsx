
import React from "react";
import { MenuItem, Variation, VariationGroup } from "@/types/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Save, XCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { saveVariationGroup } from "@/services/variationGroupService";

interface AddVariationGroupModalProps {
  tempVariationGroup: VariationGroup;
  setTempVariationGroup: (group: VariationGroup | null) => void;
  editItem: MenuItem;
  setEditItem: (item: MenuItem) => void;
  variations: Variation[];
  variationGroups: VariationGroup[];
  onDataChange?: () => void; // Added optional callback
}

export const AddVariationGroupModal = ({
  tempVariationGroup,
  setTempVariationGroup,
  editItem,
  setEditItem,
  variations,
  variationGroups,
  onDataChange, // Added to props
}: AddVariationGroupModalProps) => {
  const { toast } = useToast();

  const handleVariationCheckboxChange = (variationId: string) => {
    const updatedVariations = tempVariationGroup.variations.includes(variationId)
      ? tempVariationGroup.variations.filter(id => id !== variationId)
      : [...tempVariationGroup.variations, variationId];
    
    setTempVariationGroup({
      ...tempVariationGroup,
      variations: updatedVariations
    });
  };

  const handleSaveAndAddToItem = async () => {
    if (!tempVariationGroup.name || tempVariationGroup.variations.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e selecione pelo menos uma variação",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("=== SALVANDO GRUPO DE VARIAÇÃO ===");
      console.log("Grupo a ser salvo:", tempVariationGroup);
      
      // First save this as a new variation group
      await saveVariationGroup(tempVariationGroup);
      console.log("Grupo salvo no Firestore com sucesso");
      
      // Then add it to the item
      setEditItem({
        ...editItem,
        hasVariations: true,
        variationGroups: [...(editItem.variationGroups || []), tempVariationGroup]
      });
      console.log("Grupo adicionado ao item");
      
      // Close the dialog
      setTempVariationGroup(null);
      
      // Call the data change callback to refresh the groups list
      console.log("=== CHAMANDO CALLBACK DE ATUALIZAÇÃO ===");
      console.log("onDataChange disponível?", !!onDataChange);
      if (onDataChange) {
        console.log("Executando onDataChange para recarregar dados...");
        onDataChange();
        console.log("onDataChange executado");
      } else {
        console.error("onDataChange não está disponível!");
      }
      
      toast({
        title: "Sucesso",
        description: "Grupo de variações adicionado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao salvar grupo de variação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o grupo de variação",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={!!tempVariationGroup} onOpenChange={(open) => !open && setTempVariationGroup(null)}>
      <DialogContent className="max-w-md h-[85vh] flex flex-col p-0">
        <div className="flex justify-between items-center p-6 pb-4 flex-shrink-0 border-b">
          <h2 className="text-xl font-bold">Adicionar Grupo de Variações</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setTempVariationGroup(null)}
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
                value={tempVariationGroup.name}
                onChange={(e) => setTempVariationGroup({...tempVariationGroup, name: e.target.value})}
                placeholder="Ex: Sabores, Recheios, Complementos"
              />
            </div>

            <div>
  <Label htmlFor="internal-name">Nome Interno (opcional)</Label>
  <Input
    id="internal-name"
    value={tempVariationGroup.internalName || ""}
    onChange={(e) => setTempVariationGroup({
      ...tempVariationGroup,
      internalName: e.target.value
    })}
    placeholder="Ex: sabores_pizza, adicionais_bebida"
  />
  <p className="text-xs text-gray-500 mt-1">
    Este campo é apenas para uso interno e não aparece no cardápio público.
  </p>
</div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min-required">Mínimo Obrigatório</Label>
                <Input
                  id="min-required"
                  type="number"
                  min="0"
                  value={tempVariationGroup.minRequired}
                  onChange={(e) => setTempVariationGroup({
                    ...tempVariationGroup, 
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
                  value={tempVariationGroup.maxAllowed}
                  onChange={(e) => setTempVariationGroup({
                    ...tempVariationGroup, 
                    maxAllowed: parseInt(e.target.value)
                  })}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="custom-message">Mensagem Personalizada (opcional)</Label>
              <Input
                id="custom-message"
                value={tempVariationGroup.customMessage || ""}
                onChange={(e) => setTempVariationGroup({
                  ...tempVariationGroup, 
                  customMessage: e.target.value
                })}
                placeholder="Ex: Escolha {min} opções"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {"{min}"} para o número mínimo, {"{max}"} para o máximo e {"{count}"} para quantidade selecionada
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Variações Disponíveis</Label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2">
                {variations
                  .filter(v => v.available && (v.categoryIds.length === 0 || v.categoryIds.includes(editItem?.category || "")))
                  .map(variation => (
                    <div key={variation.id} className="flex items-center space-x-2 py-1">
                      <Checkbox 
                        id={`temp-var-${variation.id}`}
                        checked={tempVariationGroup.variations.includes(variation.id)}
                        onCheckedChange={() => handleVariationCheckboxChange(variation.id)}
                      />
                      <Label htmlFor={`temp-var-${variation.id}`}>
                        {variation.name}
                        {variation.additionalPrice > 0 && ` (+R$ ${variation.additionalPrice.toFixed(2)})`}
                      </Label>
                    </div>
                  ))}
                {variations.length === 0 && (
                  <p className="text-sm text-gray-500 py-2">
                    Nenhuma variação disponível para esta categoria. Adicione variações primeiro.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="temp-applyToHalfPizza"
                checked={tempVariationGroup.applyToHalfPizza || false}
                onCheckedChange={(checked) =>
                  setTempVariationGroup({ ...tempVariationGroup, applyToHalfPizza: checked as boolean })
                }
              />
              <Label htmlFor="temp-applyToHalfPizza" className="text-sm font-normal cursor-pointer">
                Aplicar a pizzas meio a meio
              </Label>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="temp-allowPerHalf"
                checked={tempVariationGroup.allowPerHalf || false}
                onCheckedChange={(checked) =>
                  setTempVariationGroup({ ...tempVariationGroup, allowPerHalf: checked as boolean })
                }
              />
              <Label htmlFor="temp-allowPerHalf" className="text-sm font-normal cursor-pointer">
                Permitir adicionar em cada metade (pizza meio a meio)
              </Label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Quando ativo, o cliente pode escolher se o adicional vai na metade 1, metade 2 ou pizza inteira
            </p>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="temp-collapsible"
                checked={tempVariationGroup.collapsible || false}
                onCheckedChange={(checked) =>
                  setTempVariationGroup({ ...tempVariationGroup, collapsible: checked as boolean })
                }
              />
              <Label htmlFor="temp-collapsible" className="text-sm font-normal cursor-pointer">
                Menu recolhível (sanfona)
              </Label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Exibe o grupo como um dropdown sanfona no cardápio. Útil quando o grupo tem muitos itens.
            </p>
          </div>
        </ScrollArea>
        
        <div className="flex justify-end gap-2 p-6 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => setTempVariationGroup(null)}>
            Cancelar
          </Button>
          <Button onClick={handleSaveAndAddToItem}>
            <Save className="h-4 w-4 mr-1" />
            Adicionar ao Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
