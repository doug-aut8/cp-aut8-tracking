
import React from "react";
import { Variation, Category } from "@/types/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Save, XCircle } from "lucide-react";
import { saveVariation } from "@/services/variationService";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EditVariationModalProps {
  editVariation: Variation;
  setEditVariation: (variation: Variation | null) => void;
  categories: Category[];
  onSuccess: () => void;
}

export const EditVariationModal = ({
  editVariation,
  setEditVariation,
  categories,
  onSuccess,
}: EditVariationModalProps) => {
  const { toast } = useToast();

  const handleCategoryCheckboxChange = (categoryId: string) => {
    const currentCategoryIds = editVariation.categoryIds || [];
    const updatedCategoryIds = currentCategoryIds.includes(categoryId)
      ? currentCategoryIds.filter(id => id !== categoryId)
      : [...currentCategoryIds, categoryId];
    
    setEditVariation({
      ...editVariation,
      categoryIds: updatedCategoryIds
    });
  };

  const handleSaveVariation = async () => {
    console.log("Tentando salvar variação:", editVariation);
    
    if (!editVariation.name) {
      console.log("Validação falhou - nome obrigatório");
      toast({
        title: "Campo obrigatório",
        description: "O nome da variação é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Iniciando salvamento da variação...");
      
      // Ensure additionalPrice is a valid number
      const variationToSave = {
        ...editVariation,
        additionalPrice: editVariation.additionalPrice || 0
      };
      
      console.log("Variação preparada para salvar:", variationToSave);
      
      const savedId = await saveVariation(variationToSave);
      console.log("Variação salva com sucesso, ID:", savedId);
      
      setEditVariation(null);
      toast({
        title: "Sucesso",
        description: "Variação salva com sucesso",
      });
      onSuccess();
    } catch (error) {
      console.error("Erro detalhado ao salvar variação:", error);
      toast({
        title: "Erro",
        description: `Não foi possível salvar a variação: ${error.message || 'Erro desconhecido'}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={!!editVariation} onOpenChange={(open) => !open && setEditVariation(null)}>
      <DialogContent className="max-w-md h-[85vh] flex flex-col p-0">
        <div className="flex justify-between items-center p-6 pb-4 flex-shrink-0 border-b">
          <h2 className="text-xl font-bold">
            {editVariation.id ? "Editar Variação" : "Nova Variação"}
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setEditVariation(null)}
          >
            <XCircle className="h-5 w-5" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
            <div>
              <Label htmlFor="variation-name">Nome *</Label>
              <Input
                id="variation-name"
                value={editVariation.name}
                onChange={(e) => setEditVariation({...editVariation, name: e.target.value})}
                placeholder="Ex: Queijo Extra, Molho Picante, etc"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="variation-description">Descrição (opcional)</Label>
              <Textarea
                id="variation-description"
                value={editVariation.description || ""}
                onChange={(e) => setEditVariation({...editVariation, description: e.target.value})}
                placeholder="Descrição da variação"
              />
            </div>
            
            <div>
              <Label htmlFor="variation-price">Preço Adicional (R$)</Label>
              <Input
                id="variation-price"
                type="number"
                step="0.01"
                min="0"
                value={editVariation.additionalPrice || 0}
                onChange={(e) => setEditVariation({
                  ...editVariation, 
                  additionalPrice: parseFloat(e.target.value) || 0
                })}
                placeholder="0.00"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="variation-available"
                checked={editVariation.available}
                onCheckedChange={(checked) => 
                  setEditVariation({...editVariation, available: checked})
                }
              />
              <Label htmlFor="variation-available">Disponível</Label>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Categorias aplicáveis</Label>
                {categories.length > 0 && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      const allSelected = categories.every(c => (editVariation.categoryIds || []).includes(c.id));
                      setEditVariation({
                        ...editVariation,
                        categoryIds: allSelected ? [] : categories.map(c => c.id),
                      });
                    }}
                  >
                    {categories.every(c => (editVariation.categoryIds || []).includes(c.id)) ? "Desmarcar todas" : "Marcar todas"}
                  </Button>
                )}
              </div>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center space-x-2 py-1">
                    <Checkbox 
                      id={`cat-${category.id}`}
                      checked={(editVariation.categoryIds || []).includes(category.id)}
                      onCheckedChange={() => handleCategoryCheckboxChange(category.id)}
                    />
                    <Label htmlFor={`cat-${category.id}`}>{category.name}</Label>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-sm text-gray-500 py-2">
                    Nenhuma categoria disponível. Adicione categorias primeiro.
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Se nenhuma categoria for selecionada, esta variação estará disponível para todas as categorias.
              </p>
            </div>
          </div>
        </ScrollArea>
        
        <div className="flex justify-end gap-2 p-6 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => setEditVariation(null)}>
            Cancelar
          </Button>
          <Button onClick={handleSaveVariation}>
            <Save className="h-4 w-4 mr-1" />
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
