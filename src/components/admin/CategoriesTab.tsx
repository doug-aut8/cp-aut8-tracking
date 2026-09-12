
import React, { useState } from "react";
import { Category } from "@/types/menu";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CategoryForm } from "./categories/CategoryForm";
import { CategoryList } from "./categories/CategoryList";

interface CategoriesTabProps {
  categories: Category[];
  loading: boolean;
  onDataChange: () => void;
  onSeedData: () => void;
}

export const CategoriesTab = ({
  categories,
  loading,
  onDataChange,
  onSeedData,
}: CategoriesTabProps) => {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Categorias</h2>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CategoryForm 
          editingCategory={editingCategory} 
          setEditingCategory={setEditingCategory}
          onDataChange={onDataChange}
        />
        
        <div className="md:col-span-2">
          <CategoryList 
            categories={categories}
            loading={loading}
            onEditCategory={handleEditCategory}
            onDataChange={onDataChange}
          />
        </div>
      </div>
    </>
  );
};
