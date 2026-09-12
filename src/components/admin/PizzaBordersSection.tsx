import React from "react";
import { MenuItem, PizzaBorder } from "@/types/menu";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

interface PizzaBordersSectionProps {
  editItem: MenuItem;
  setEditItem: (item: MenuItem) => void;
  pizzaBorders: PizzaBorder[];
}

export const PizzaBordersSection = ({
  editItem,
  setEditItem,
  pizzaBorders,
}: PizzaBordersSectionProps) => {

  const handleSelectBorder = (borderId: string) => {
    const selectedBorder = pizzaBorders.find(border => border.id === borderId);
    
    if (selectedBorder) {
      const isAlreadyAdded = editItem.pizzaBorders?.some(b => b.id === selectedBorder.id);
      
      if (!isAlreadyAdded) {
        setEditItem({
          ...editItem,
          pizzaBorders: [...(editItem.pizzaBorders || []), selectedBorder]
        });
      }
    }
  };

  const handleRemoveBorder = (borderId: string) => {
    setEditItem({
      ...editItem,
      pizzaBorders: editItem.pizzaBorders?.filter(b => b.id !== borderId) || []
    });
  };

  const handleRemoveAllBorders = () => {
    if (window.confirm("Tem certeza que deseja remover todas as bordas desta pizza?")) {
      setEditItem({
        ...editItem,
        pizzaBorders: []
      });
    }
  };

  // Mostrar todas as bordas, não apenas as disponíveis
  const allBorders = pizzaBorders || [];
  const availableBorders = allBorders.filter(border => border.available !== false);

  // Se não houver bordas cadastradas, mostrar mensagem
  if (allBorders.length === 0) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-bold">Bordas Disponíveis</h3>
        <div className="mt-4 text-center py-4 text-muted-foreground border rounded-md bg-amber-50">
          <p>Nenhuma borda cadastrada no sistema.</p>
          <p className="text-sm mt-1">
            Cadastre bordas na aba "Bordas" do painel administrativo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 border p-4 rounded-md bg-amber-50/50">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Bordas Disponíveis</h3>
        {editItem.pizzaBorders && editItem.pizzaBorders.length > 0 && (
          <Button 
            onClick={handleRemoveAllBorders} 
            size="sm" 
            variant="destructive"
            className="px-2 py-1"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remover Todas
          </Button>
        )}
      </div>
      
      {/* Dropdown to select borders */}
      <div className="mt-4 space-y-2">
        <Label>Adicionar Borda</Label>
        <div className="flex gap-2">
          <Select onValueChange={handleSelectBorder}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma borda" />
            </SelectTrigger>
            <SelectContent>
              {availableBorders
                .filter(border => !editItem.pizzaBorders?.some(b => b.id === border.id))
                .map(border => (
                  <SelectItem key={border.id} value={border.id}>
                    {border.name} {border.additionalPrice > 0 ? `(+${formatCurrency(border.additionalPrice)})` : "(Grátis)"}
                  </SelectItem>
                ))}
              {availableBorders.filter(border => !editItem.pizzaBorders?.some(b => b.id === border.id)).length === 0 && (
                <div className="px-2 py-1 text-sm text-muted-foreground">
                  Todas as bordas já foram adicionadas
                </div>
              )}
            </SelectContent>
          </Select>
          {availableBorders.filter(border => !editItem.pizzaBorders?.some(b => b.id === border.id)).length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="whitespace-nowrap"
              onClick={() => {
                const remaining = availableBorders.filter(border => !editItem.pizzaBorders?.some(b => b.id === border.id));
                setEditItem({
                  ...editItem,
                  pizzaBorders: [...(editItem.pizzaBorders || []), ...remaining]
                });
              }}
            >
              Adicionar Todas
            </Button>
          )}
        </div>
        {availableBorders.length === 0 && allBorders.length > 0 && (
          <p className="text-xs text-amber-600">
            Todas as bordas estão indisponíveis. Ative-as na aba "Bordas".
          </p>
        )}
      </div>
      
      <div className="mt-4 space-y-2">
        {editItem.pizzaBorders && editItem.pizzaBorders.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {editItem.pizzaBorders.map(border => (
              <div key={border.id} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-amber-200">
                <div>
                  <span className="text-sm font-medium">{border.name}</span>
                  {border.description && (
                    <p className="text-xs text-muted-foreground">{border.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-green-600">
                    {border.additionalPrice > 0 ? `+${formatCurrency(border.additionalPrice)}` : 'Grátis'}
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleRemoveBorder(border.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground border rounded-md bg-white">
            Nenhuma borda selecionada para esta pizza.
            <br />
            <span className="text-sm">
              Adicione bordas para permitir que os clientes personalizem a pizza.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
