import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Edit, Plus, Trash2 } from "lucide-react";
import { PizzaBorder, deletePizzaBorder, syncBordersToMenuItems } from "@/services/pizzaBorderService";
import { EditPizzaBorderModal } from "./EditPizzaBorderModal";

interface PizzaBordersTabProps {
  pizzaBorders: PizzaBorder[];
  loading: boolean;
  onDataChange: () => void;
}

export const PizzaBordersTab = ({
  pizzaBorders,
  loading,
  onDataChange,
}: PizzaBordersTabProps) => {
  const { toast } = useToast();
  const [editBorder, setEditBorder] = useState<PizzaBorder | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleAddNewBorder = () => {
    setEditBorder({
      id: "",
      name: "",
      description: "",
      additionalPrice: 0,
      available: true,
    });
  };

  const handleEditBorder = (border: PizzaBorder) => {
    setEditBorder({ ...border });
  };

  const handleDeleteBorder = async (border: PizzaBorder) => {
    if (!border.id) {
      toast({
        title: "Erro",
        description: "Borda não possui ID válido para exclusão",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm(`Tem certeza que deseja excluir a borda "${border.name}"?`)) {
      try {
        setIsDeleting(border.id);
        await deletePizzaBorder(border.id);
        
        // Sincronizar bordas nos itens (remove a borda deletada dos itens)
        await syncBordersToMenuItems();
        
        toast({
          title: "Sucesso",
          description: "Borda excluída e removida dos itens",
        });
        
        onDataChange();
      } catch (error: any) {
        console.error("Erro ao excluir borda:", error);
        toast({
          title: "Erro",
          description: `Não foi possível excluir a borda: ${error.message}`,
          variant: "destructive",
        });
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          Bordas de Pizza ({pizzaBorders.length} bordas)
        </h2>
        <Button onClick={handleAddNewBorder}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Borda
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pizzaBorders.map(border => (
          <Card key={border.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg">{border.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      border.available 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {border.available ? 'Disponível' : 'Indisponível'}
                    </span>
                  </div>
                  
                  {border.description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {border.description}
                    </p>
                  )}
                  
                  <p className="text-base font-semibold text-primary">
                    {border.additionalPrice > 0 
                      ? `+ ${formatPrice(border.additionalPrice)}` 
                      : 'Grátis'}
                  </p>
                  
                  <p className="text-xs text-gray-400 mt-2">
                    ID: {border.id}
                  </p>
                </div>

                <div className="flex flex-col gap-1 ml-2">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleEditBorder(border)}
                    disabled={isDeleting === border.id}
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleDeleteBorder(border)}
                    disabled={isDeleting === border.id}
                    title="Excluir"
                  >
                    <Trash2 className={`h-4 w-4 ${isDeleting === border.id ? 'text-gray-400' : 'text-red-500'}`} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {pizzaBorders.length === 0 && !loading && (
          <div className="col-span-full text-center py-8 text-gray-500">
            Nenhuma borda de pizza encontrada. Adicione bordas para seus clientes escolherem.
          </div>
        )}
      </div>

      {editBorder && (
        <EditPizzaBorderModal
          border={editBorder}
          setBorder={setEditBorder}
          onSuccess={onDataChange}
        />
      )}
    </>
  );
};
