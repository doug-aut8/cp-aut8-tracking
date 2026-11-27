
import React, { useState, useMemo } from "react";
import { Variation, Category, MenuItem, VariationGroup } from "@/types/menu";
import { PizzaBorder } from "@/services/pizzaBorderService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Edit, Grid3X3, List, Plus, Trash2 } from "lucide-react";
import { deleteVariation, saveVariation } from "@/services/variationService";
import { EditVariationModal } from "./EditVariationModal";
import { EditMenuItemModal } from "./EditMenuItemModal";

interface VariationsTabProps {
  variations: Variation[];
  categories: Category[];
  menuItems?: MenuItem[];
  variationGroups?: VariationGroup[];
  pizzaBorders?: PizzaBorder[];
  loading: boolean;
  onDataChange: () => void;
}

export const VariationsTab = ({
  variations,
  categories,
  menuItems = [],
  variationGroups = [],
  pizzaBorders = [],
  loading,
  onDataChange,
}: VariationsTabProps) => {
  const { toast } = useToast();
  const [editVariation, setEditVariation] = useState<Variation | null>(null);
  const [editMenuItem, setEditMenuItem] = useState<MenuItem | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  const sortedVariations = useMemo(
    () => [...variations].sort((a, b) => a.name.localeCompare(b.name)),
    [variations]
  );

  const handleAddVariation = () => {
    const newVariation: Variation = {
      id: "",
      name: "",
      description: "",
      additionalPrice: 0,
      available: true,
      categoryIds: []
    };
    setEditVariation(newVariation);
  };

  const handleEditVariation = (variation: Variation) => {
    setEditVariation({...variation});
  };

  const handleDuplicateVariation = (variation: Variation) => {
    const duplicated: Variation = {
      ...variation,
      id: "",
      name: `${variation.name} (Cópia)`,
    };
    setEditVariation(duplicated);
  };

  const handleDeleteVariation = async (variation: Variation) => {
    if (!variation.id) {
      toast({ title: "Erro", description: "Variação não possui ID válido para exclusão", variant: "destructive" });
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir a variação "${variation.name}"?`)) {
      try {
        await deleteVariation(variation.id);
        toast({ title: "Sucesso", description: "Variação excluída com sucesso" });
        onDataChange();
      } catch (error) {
        toast({ title: "Erro", description: `Não foi possível excluir a variação: ${(error as Error).message}`, variant: "destructive" });
      }
    }
  };

  const getCategoryNames = (categoryIds?: string[]) => {
    if (!categoryIds || categoryIds.length === 0) return "Todas";
    return categoryIds.map(id => categories.find(c => c.id === id)?.name || id).join(", ");
  };

  const sortedMenuItems = useMemo(
    () => [...menuItems].sort((a, b) => a.name.localeCompare(b.name)),
    [menuItems]
  );

  const handleEditMenuItem = (item: MenuItem) => {
    setEditMenuItem({ ...item });
  };

  const handleDuplicateMenuItemAsVariation = async (item: MenuItem) => {
    try {
      const newVariation: Variation = {
        id: "",
        name: `${item.name} (Cópia)`,
        description: item.description || "",
        additionalPrice: item.price || 0,
        available: item.available !== false,
        categoryIds: item.category ? [item.category] : [],
      };
      await saveVariation(newVariation);
      toast({ title: "Sucesso", description: "Item duplicado como variação" });
      onDataChange();
    } catch (error) {
      toast({
        title: "Erro",
        description: `Não foi possível duplicar: ${(error as Error).message}`,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Variações</h2>
        <div className="flex gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <Button
              size="sm"
              variant={viewMode === "cards" ? "default" : "ghost"}
              onClick={() => setViewMode("cards")}
              className="rounded-none px-2"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
              className="rounded-none px-2"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleAddVariation}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Variação
          </Button>
        </div>
      </div>

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sortedVariations.map(variation => (
            <Card key={variation.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold">{variation.name}</h3>
                    {variation.description && (
                      <p className="text-sm text-muted-foreground mb-2">{variation.description}</p>
                    )}
                    {variation.additionalPrice > 0 && (
                      <p className="text-sm font-semibold">+ R$ {variation.additionalPrice.toFixed(2)}</p>
                    )}
                    <div className="flex items-center mt-2">
                      <span className={`inline-block h-2 w-2 rounded-full mr-2 ${variation.available ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className="text-xs text-muted-foreground">{variation.available ? 'Disponível' : 'Indisponível'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Categorias: {getCategoryNames(variation.categoryIds)}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">ID: {variation.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleDuplicateVariation(variation)} title="Duplicar">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleEditVariation(variation)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteVariation(variation)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Descrição</th>
                <th className="text-left p-3 font-medium">Preço Adicional</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Categorias</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedVariations.map(variation => (
                <tr key={variation.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 font-medium">{variation.name}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{variation.description || "—"}</td>
                  <td className="p-3">{variation.additionalPrice > 0 ? `+ R$ ${variation.additionalPrice.toFixed(2)}` : "—"}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block h-2 w-2 rounded-full ${variation.available ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{getCategoryNames(variation.categoryIds)}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => handleDuplicateVariation(variation)} title="Duplicar">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleEditVariation(variation)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteVariation(variation)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sortedVariations.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma variação encontrada. Adicione variações para personalizar os itens do menu.
        </div>
      )}

      {editVariation && (
        <EditVariationModal
          editVariation={editVariation}
          setEditVariation={setEditVariation}
          categories={categories}
          onSuccess={onDataChange}
        />
      )}

      <div className="mt-10 pt-6 border-t">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Itens do Cardápio (disponíveis como variação)</h2>
          <p className="text-sm text-muted-foreground">
            Lista fixa com todos os itens cadastrados no cardápio. Use "Duplicar" para
            criar uma variação a partir do item — ela será adicionada à seção acima.
          </p>
        </div>

        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sortedMenuItems.map(item => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-sm font-semibold">R$ {Number(item.price || 0).toFixed(2)}</p>
                      <div className="flex items-center mt-2">
                        <span className={`inline-block h-2 w-2 rounded-full mr-2 ${item.available !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-xs text-muted-foreground">{item.available !== false ? 'Disponível' : 'Indisponível'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Categoria: {categories.find(c => c.id === item.category)?.name || item.category}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => handleDuplicateMenuItemAsVariation(item)} title="Duplicar como variação">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleEditMenuItem(item)} title="Editar item">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Descrição</th>
                  <th className="text-left p-3 font-medium">Preço</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Categoria</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedMenuItems.map(item => (
                  <tr key={item.id} className="border-t hover:bg-muted/50">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">{item.description || "—"}</td>
                    <td className="p-3">R$ {Number(item.price || 0).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block h-2 w-2 rounded-full ${item.available !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">
                      {categories.find(c => c.id === item.category)?.name || item.category}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => handleDuplicateMenuItemAsVariation(item)} title="Duplicar como variação">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEditMenuItem(item)} title="Editar item">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sortedMenuItems.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum item de cardápio encontrado.
          </div>
        )}
      </div>

      {editMenuItem && (
        <EditMenuItemModal
          editItem={editMenuItem}
          setEditItem={setEditMenuItem}
          menuItems={menuItems}
          categories={categories}
          variations={variations}
          variationGroups={variationGroups}
          pizzaBorders={pizzaBorders}
          onSuccess={onDataChange}
        />
      )}
    </>
  );
};
