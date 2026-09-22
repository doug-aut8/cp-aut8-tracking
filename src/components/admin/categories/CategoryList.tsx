import React, { useState } from "react";
import { Category, POPULAR_CATEGORY_ID } from "@/types/menu";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, ArrowUp, ArrowDown, Star } from "lucide-react";
import { deleteCategory, updateCategory } from "@/services/categoryService";

interface CategoryListProps {
  categories: Category[];
  loading: boolean;
  onEditCategory: (category: Category) => void;
  onDataChange: () => void;
}

export const CategoryList = ({
  categories,
  loading,
  onEditCategory,
  onDataChange,
}: CategoryListProps) => {
  const { toast } = useToast();
  const [isReordering, setIsReordering] = useState(false);

  // Sort categories by order
  const sortedCategories = [...categories].sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : 0;
    const orderB = b.order !== undefined ? b.order : 0;
    return orderA - orderB;
  });

  const handleDeleteCategory = async (categoryId: string) => {
    if (categoryId === POPULAR_CATEGORY_ID) {
      toast({
        title: "Ação não permitida",
        description: "A categoria 'Produtos Mais Vendidos' é fixa e não pode ser excluída.",
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm("Tem certeza que deseja excluir esta categoria?")) {
      return;
    }

    try {
      await deleteCategory(categoryId);
      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso",
      });
      onDataChange();
    } catch (error) {
      console.error("Erro ao excluir categoria:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a categoria. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleToggleVisibility = async (category: Category, visible: boolean) => {
    try {
      await updateCategory({ ...category, visible });
      toast({
        title: visible ? "Categoria exibida" : "Categoria ocultada",
        description: `"${category.name}" agora está ${visible ? "visível" : "oculta"} no cardápio.`,
      });
      await onDataChange();
    } catch (error) {
      console.error("Erro ao alterar visibilidade:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar a visibilidade.",
        variant: "destructive",
      });
    }
  };
  
  // Function to handle reordering categories
  const handleReorderCategory = async (category: Category, direction: 'up' | 'down') => {
    try {
      setIsReordering(true);
      
      // Find the current index of the category
      const currentIndex = sortedCategories.findIndex(c => c.id === category.id);
      
      // Determine if we can move up or down
      if ((direction === 'up' && currentIndex === 0) || 
          (direction === 'down' && currentIndex === sortedCategories.length - 1)) {
        setIsReordering(false);
        return; // Can't move beyond boundaries
      }
      
      // Calculate new index
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      // Get the target category to swap with
      const targetCategory = sortedCategories[newIndex];
      
      // Store original orders
      const categoryOrder = category.order !== undefined ? category.order : currentIndex;
      const targetCategoryOrder = targetCategory.order !== undefined ? targetCategory.order : newIndex;
      
      // Swap orders
      const updatedCategory = {
        ...category,
        order: targetCategoryOrder
      };
      
      const updatedTargetCategory = {
        ...targetCategory,
        order: categoryOrder
      };
      
      // Update both categories with new orders
      await updateCategory(updatedCategory);
      await updateCategory(updatedTargetCategory);
      
      toast({
        title: "Sucesso",
        description: "Ordem das categorias atualizada",
      });
      
      await onDataChange(); // Refresh data
    } catch (error) {
      console.error("Erro ao reordenar categorias:", error);
      toast({
        title: "Erro",
        description: "Não foi possível reordenar as categorias. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsReordering(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Categorias Existentes</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedCategories.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Exibir</TableHead>
                <TableHead>No menu</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCategories.map((category) => {
                const isPopular = category.id === POPULAR_CATEGORY_ID || category.isPopularCategory;
                return (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isPopular && <Star className="h-4 w-4 text-primary fill-primary" />}
                        <span>{category.name}</span>
                        {isPopular && (
                          <span className="text-xs text-muted-foreground">(fixa)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{category.order !== undefined ? category.order : 'N/A'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={category.visible !== false}
                        onCheckedChange={(checked) => handleToggleVisibility(category, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={category.showInCategoryNav !== false}
                        onCheckedChange={async (checked) => {
                          try {
                            await updateCategory({ ...category, showInCategoryNav: checked });
                            toast({
                              title: checked ? "Categoria adicionada ao menu" : "Categoria removida do menu",
                              description: `"${category.name}" ${checked ? "aparecerá" : "não aparecerá"} na barra de categorias.`,
                            });
                            await onDataChange();
                          } catch (e) {
                            console.error(e);
                            toast({ title: "Erro", description: "Falha ao atualizar.", variant: "destructive" });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReorderCategory(category, 'up')}
                          disabled={isReordering || sortedCategories.indexOf(category) === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReorderCategory(category, 'down')}
                          disabled={isReordering || sortedCategories.indexOf(category) === sortedCategories.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditCategory(category)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCategory(category.id)}
                          disabled={isPopular}
                          title={isPopular ? "Categoria fixa não pode ser excluída" : "Excluir"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            Nenhuma categoria encontrada.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
