import React, { useState, useMemo, useRef, useEffect } from "react";
import { MenuItem, Category, VariationGroup, PizzaBorder, POPULAR_CATEGORY_ID } from "@/types/menu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Copy, Grid3X3, List, Search, X, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { deleteMenuItem, cleanupPopularItems, updateMenuItemsOrder } from "@/services/menuItemService";
import { EditMenuItemModal } from "./EditMenuItemModal";


interface MenuItemsTabProps {
  menuItems: MenuItem[];
  categories: Category[];
  variations: any[];
  variationGroups: VariationGroup[];
  pizzaBorders?: PizzaBorder[];
  loading: boolean;
  onDataChange: () => void;
}

export const MenuItemsTab = ({
  menuItems,
  categories,
  variations,
  variationGroups,
  pizzaBorders = [],
  loading,
  onDataChange,
}: MenuItemsTabProps) => {
  const { toast } = useToast();
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const savedScrollRef = useRef<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const stickyBarRef = useRef<HTMLDivElement | null>(null);
  const [reorderingCategory, setReorderingCategory] = useState<string | null>(null);


  // Restaurar scroll quando o modal fecha (após salvar ou cancelar)
  // Radix Dialog aplica scroll-lock no body e ao fechar pode resetar a posição.
  // Por isso reaplicamos várias vezes ao longo de ~600ms para vencer o cleanup do Radix
  // e o re-render assíncrono causado por onDataChange().
  useEffect(() => {
    if (editItem !== null || savedScrollRef.current === null) return;
    const target = savedScrollRef.current;

    let cancelled = false;
    const restore = () => {
      if (cancelled) return;
      window.scrollTo({ top: target, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = target;
      document.body.scrollTop = target;
    };

    // Sequência agressiva de tentativas para vencer o Radix scroll-lock cleanup
    const timers: number[] = [];
    [0, 16, 50, 100, 200, 350, 550].forEach((delay) => {
      timers.push(window.setTimeout(restore, delay));
    });

    // Limpa a referência depois da última tentativa
    timers.push(window.setTimeout(() => { savedScrollRef.current = null; }, 600));

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [editItem, menuItems]);

  // Detectar duplicatas
  const duplicateIds = useMemo(() => {
    const idCount = new Map();
    menuItems.forEach(item => {
      idCount.set(item.id, (idCount.get(item.id) || 0) + 1);
    });
    
    const duplicates = [];
    idCount.forEach((count, id) => {
      if (count > 1) {
        duplicates.push(id);
        console.warn(`DUPLICATA DETECTADA na interface: ID ${id} aparece ${count} vezes`);
      }
    });
    
    return duplicates;
  }, [menuItems]);

  // Mapa: id do item -> itens "pai" que o incluem em seus submenus
  const parentsByItemId = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    menuItems.forEach(parent => {
      (parent.submenuItemIds || []).forEach(rawId => {
        const childId = String(rawId ?? "").trim();
        if (!childId || childId === parent.id) return;
        const list = map.get(childId) || [];
        list.push(parent);
        map.set(childId, list);
      });
    });
    return map;
  }, [menuItems]);


  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Group items by category - filter out categories with invalid IDs
  const itemsByCategory = useMemo(() => {
    const validCategories = categories.filter(category => category.id && category.id.trim() !== '');
    const sortedCategories = [...validCategories].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      return orderA - orderB;
    });

    const grouped: Record<string, {category: Category, items: MenuItem[]}> = {};
    
    sortedCategories.forEach(category => {
      grouped[category.id] = {
        category,
        items: []
      };
    });
    
    menuItems.forEach(item => {
      const targetCategoryIds = new Set<string>();
      if (item.category) targetCategoryIds.add(item.category);
      (item.additionalCategories || []).forEach(id => targetCategoryIds.add(id));

      let placedSomewhere = false;
      targetCategoryIds.forEach(catId => {
        if (grouped[catId]) {
          grouped[catId].items.push(item);
          placedSomewhere = true;
        }
      });

      if (!placedSomewhere) {
        const unknownCategoryId = 'unknown';
        if (!grouped[unknownCategoryId]) {
          grouped[unknownCategoryId] = {
            category: { id: unknownCategoryId, name: 'Categoria Não Encontrada', order: 999 },
            items: []
          };
        }
        grouped[unknownCategoryId].items.push(item);
      }
    });

    // Popular fixed category: aggregate all items marked as popular
    sortedCategories.forEach(category => {
      if (category.id === POPULAR_CATEGORY_ID || category.isPopularCategory) {
        grouped[category.id].items = menuItems.filter(item => item.popular === true);
      }
    });

    Object.values(grouped).forEach(g => {
      g.items.sort(
        (a, b) =>
          (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
          a.name.localeCompare(b.name, "pt-BR")
      );
    });

    return Object.values(grouped);
  }, [menuItems, categories]);

  const handleMoveItem = async (categoryId: string, items: MenuItem[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length || reorderingCategory) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      setReorderingCategory(categoryId);
      await updateMenuItemsOrder(reordered.map(i => i.id));
      await onDataChange();
      localStorage.setItem('menuDataChanged', Date.now().toString());
      window.dispatchEvent(new CustomEvent('menuDataChanged'));
    } catch (error: any) {
      toast({
        title: "Erro",
        description: `Não foi possível reordenar: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setReorderingCategory(null);
    }
  };

  // --- Busca de itens ---
  const normalize = (s: string) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const [activeSearch, setActiveSearch] = useState("");

  // Debounce da busca
  useEffect(() => {
    const t = window.setTimeout(() => setActiveSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Texto pesquisável: nome, descrição (ingredientes) e nomes das variações
  const itemMatches = (item: MenuItem, q: string) => {
    const parts: string[] = [item.name || "", item.description || ""];
    (item.variationGroups || []).forEach((g: any) => {
      parts.push(g?.name || "");
      (g?.variations || []).forEach((v: any) => {
        parts.push(v?.name || "");
        parts.push(v?.description || "");
      });
    });
    return normalize(parts.join(" | ")).includes(q);
  };

  const filteredByCategory = useMemo(() => {
    const q = normalize(activeSearch);
    if (!q) return itemsByCategory;
    return itemsByCategory
      .map(({ category, items }) => ({ category, items: items.filter((i) => itemMatches(i, q)) }))
      .filter(({ items }) => items.length > 0);
  }, [itemsByCategory, activeSearch]);

  const totalMatches = useMemo(
    () => filteredByCategory.reduce((acc, g) => acc + g.items.length, 0),
    [filteredByCategory]
  );

  // Ao buscar: expandir categorias com resultado e rolar até o primeiro
  useEffect(() => {
    const q = normalize(activeSearch);
    if (!q || filteredByCategory.length === 0) { setHighlightId(null); return; }

    const first = filteredByCategory[0];
    setCollapsedCategories((prev) => {
      const next = { ...prev };
      filteredByCategory.forEach(({ category }) => { next[category.id] = false; });
      return next;
    });
    setHighlightId(first.items[0].id);

    const t = window.setTimeout(() => {
      const el = document.getElementById(`admin-item-${first.items[0].id}`);
      if (!el) return;
      const stickyH =
        (stickyBarRef.current?.offsetHeight || 0) +
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue("--admin-tabs-h") || "56",
          10
        );
      const top = el.getBoundingClientRect().top + window.scrollY - stickyH - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSearch, filteredByCategory]);




  const handleAddItem = () => {
    savedScrollRef.current = window.scrollY;
    // Filter valid categories for new item
    const validCategories = categories.filter(category => category.id && category.id.trim() !== '');
    const newItem: MenuItem & { isHalfPizza?: boolean } = {
      id: `temp-${Date.now()}`,
      name: "",
      description: "",
      price: 0,
      image: "/placeholder.svg",
      category: validCategories.length > 0 ? validCategories[0].id : "",
      popular: false,
      hasVariations: false,
      variationGroups: [],
      isHalfPizza: false, // nova flag
    };
    setEditItem(newItem);
  };

  const handleEditItem = (item: MenuItem & { isHalfPizza?: boolean }) => {
    savedScrollRef.current = window.scrollY;
    const itemToEdit = {
      ...item,
      hasVariations: !!item.variationGroups?.length,
      variationGroups: item.variationGroups || [],
      isHalfPizza: item.isHalfPizza ?? false,
    };
    setEditItem(itemToEdit);
  };

  const handleDuplicateItem = (item: MenuItem & { isHalfPizza?: boolean }) => {
    savedScrollRef.current = window.scrollY;
    const duplicatedItem: MenuItem & { isHalfPizza?: boolean } = {
      ...item,
      id: `temp-${Date.now()}`,
      name: `${item.name} (Cópia)`,
      hasVariations: !!item.variationGroups?.length,
      variationGroups: item.variationGroups || [],
      isHalfPizza: item.isHalfPizza ?? false,
    };
    setEditItem(duplicatedItem);
    toast({
      title: "Duplicando item",
      description: "Edite as informações e salve para criar a cópia.",
    });
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!item.id || typeof item.id !== "string" || item.id.trim() === "") {
      toast({
        title: "Erro",
        description: "Item não possui ID válido para exclusão",
        variant: "destructive",
      });
      return;
    }

    if (deletingItems.has(item.id)) return;

    const confirmMessage = `Tem certeza que deseja excluir o item "${item.name}"?\n\nID: ${item.id}${item.popular ? '\n\nEste item é marcado como popular e será removido da lista "Mais Populares".' : ''}`;

    if (window.confirm(confirmMessage)) {
      try {
        setDeletingItems(prev => new Set(prev).add(item.id));
        await deleteMenuItem(item.id);
        toast({
          title: "Sucesso",
          description: `Item "${item.name}" excluído com sucesso`,
        });
        await onDataChange();

        if (item.popular) {
          localStorage.setItem('menuDataChanged', Date.now().toString());
          window.dispatchEvent(new CustomEvent('menuDataChanged'));
        }
      } catch (error: any) {
        toast({
          title: "Erro",
          description: `Não foi possível excluir o item: ${error.message}`,
          variant: "destructive",
        });
      } finally {
        setDeletingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.id);
          return newSet;
        });
      }
    }
  };

  const handleCleanupPopularItems = async () => {
    if (isCleaningUp) return;
    
    if (window.confirm("Deseja executar a limpeza de itens populares? Isso irá verificar e remover referências órfãs.")) {
      try {
        setIsCleaningUp(true);
        const result = await cleanupPopularItems();
        toast({
          title: "Limpeza Concluída",
          description: `${result.cleaned} itens órfãos foram identificados de ${result.total} itens populares totais.`,
        });
        await onDataChange();
        localStorage.setItem('menuDataChanged', Date.now().toString());
        window.dispatchEvent(new CustomEvent('menuDataChanged'));
      } catch (error: any) {
        toast({
          title: "Erro na Limpeza",
          description: `Erro ao executar limpeza: ${error.message}`,
          variant: "destructive",
        });
      } finally {
        setIsCleaningUp(false);
      }
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <>
<div
  ref={stickyBarRef}

  className="sticky z-20 bg-background pt-1 pb-3 mb-4 border-b"
  style={{ top: "var(--admin-tabs-h, 56px)" }}
>
  <h2 className="text-xl font-bold mb-2">
    Itens do Cardápio ({activeSearch ? `${totalMatches} resultado(s)` : `${menuItems.length} itens`})
    {duplicateIds.length > 0 && (
      <span className="ml-2 text-red-500 text-sm">
        ({duplicateIds.length} {duplicateIds.length === 1 ? 'duplicata detectada' : 'duplicatas detectadas'})
      </span>
    )}
  </h2>

  <form
    className="relative mb-2"
    onSubmit={(e) => { e.preventDefault(); setActiveSearch(searchTerm); }}
  >
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Buscar por nome ou ingrediente..."
      className="pl-9 pr-9"
    />
    {searchTerm && (
      <button
        type="button"
        onClick={() => { setSearchTerm(""); setActiveSearch(""); setHighlightId(null); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label="Limpar busca"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </form>

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
    <Button 
      onClick={handleCleanupPopularItems}
      variant="outline"
      disabled={isCleaningUp}
      className="flex items-center gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isCleaningUp ? 'animate-spin' : ''}`} />
      {isCleaningUp ? 'Limpando...' : 'Limpar Populares'}
    </Button>
    <Button onClick={handleAddItem}>
      <Plus className="h-4 w-4 mr-1" />
      Novo Item
    </Button>
  </div>
</div>

      

      {menuItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Nenhum item encontrado.</p>
          <p className="mt-2">Adicione itens ou importe os dados iniciais na aba "Categorias".</p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredByCategory.map(({category, items}) => (
            <div key={category.id} className="border rounded-lg overflow-hidden">
              <div 
                className="flex justify-between items-center bg-gray-100 p-4 cursor-pointer"
                onClick={() => toggleCategory(category.id)}
              >
                <h3 className="font-bold text-lg">
                  {category.name} 
                  <span className="ml-2 text-gray-500 text-sm">
                    ({items.length} {items.length === 1 ? "item" : "itens"})
                  </span>
                </h3>
                <Button variant="ghost" size="sm">
                  {collapsedCategories[category.id] ? 
                    <ChevronDown className="h-5 w-5" /> : 
                    <ChevronUp className="h-5 w-5" />
                  }
                </Button>
              </div>
              
              {!collapsedCategories[category.id] && items.length > 0 && (
                <div className="p-4">
                  {viewMode === "cards" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item, index) => {
                      const isDuplicate = duplicateIds.includes(item.id);
                      const isDeleting = deletingItems.has(item.id);
                      return (
                        <Card id={`admin-item-${item.id}`} key={`${item.id}-${index}`} className={`overflow-hidden scroll-mt-40 ${isDuplicate ? 'border-red-300 bg-red-50' : ''} ${isDeleting ? 'opacity-50' : ''} ${highlightId === item.id ? 'ring-2 ring-primary' : ''}`}>
                          <div className="h-40 bg-gray-200">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = "/placeholder.svg";
                              }}
                            />
                          </div>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold">{item.name}</h3>
                                <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                                <div className="mt-2">
                                  {item.priceFrom && (
                                    <p className="text-xs text-gray-500">a partir de</p>
                                  )}
                                  <p className="font-semibold text-brand">R$ {item.price.toFixed(2)}</p>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  Categoria: {categories.find(c => c.id === item.category)?.name || item.category}
                                </p>
                                <p className="text-xs text-gray-400 mt-1 break-all">
                                  ID: {item.id}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {item.available === false && (
                                    <span className="inline-block bg-red-500 text-white text-xs px-2 py-1 rounded font-semibold">
                                      Produto Indisponível
                                    </span>
                                  )}
                                  {item.popular && (
                                    <span className="inline-block bg-food-green text-white text-xs px-2 py-1 rounded">
                                      Popular
                                    </span>
                                  )}
                                  {item.hasVariations && (
                                    <span className="inline-block bg-blue-500 text-white text-xs px-2 py-1 rounded">
                                      Com variações
                                    </span>
                                  )}
                                  {item.isHalfPizza && (
                                    <span className="inline-block bg-purple-500 text-white text-xs px-2 py-1 rounded">
                                      Meia a Meia
                                    </span>
                                  )}
                                  {(parentsByItemId.get(String(item.id).trim()) || []).map(parent => (
                                    <span
                                      key={`sub-${parent.id}`}
                                      className="inline-block bg-amber-500 text-white text-xs px-2 py-1 rounded"
                                      title={parent.submenuName || parent.name}
                                    >
                                      Submenu de "{parent.name}"
                                    </span>
                                  ))}
                                  {(item.submenuItemIds || []).length > 0 && (
                                    <span className="inline-block bg-slate-600 text-white text-xs px-2 py-1 rounded">
                                      Tem submenu ({item.submenuItemIds!.length})
                                    </span>
                                  )}
                                </div>

                              </div>
                              <div className="flex flex-col gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleEditItem(item)}
                                  disabled={isDeleting}
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMoveItem(category.id, items, index, -1)}
                                  disabled={isDeleting || index === 0 || reorderingCategory === category.id}
                                  title="Mover para cima"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMoveItem(category.id, items, index, 1)}
                                  disabled={isDeleting || index === items.length - 1 || reorderingCategory === category.id}
                                  title="Mover para baixo"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleDuplicateItem(item)}
                                  disabled={isDeleting}
                                  title="Duplicar"
                                >
                                  <Copy className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleDeleteItem(item)}
                                  className={isDuplicate ? 'text-red-600 hover:text-red-700' : ''}
                                  disabled={isDeleting}
                                  title="Excluir"
                                >
                                  <Trash2 className={`h-4 w-4 ${isDeleting ? 'text-gray-400' : 'text-red-500'}`} />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  ) : (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 font-medium w-12">Img</th>
                          <th className="text-left p-3 font-medium">Nome</th>
                          <th className="text-left p-3 font-medium hidden md:table-cell">Descrição</th>
                          <th className="text-left p-3 font-medium">Preço</th>
                          <th className="text-center p-3 font-medium">Status</th>
                          <th className="text-center p-3 font-medium hidden md:table-cell">Tags</th>
                          <th className="text-right p-3 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => {
                          const isDuplicate = duplicateIds.includes(item.id);
                          const isDeleting = deletingItems.has(item.id);
                          return (
                            <tr id={`admin-item-${item.id}`} key={`${item.id}-${index}`} className={`border-t hover:bg-muted/50 scroll-mt-40 ${isDuplicate ? 'bg-red-50' : ''} ${isDeleting ? 'opacity-50' : ''} ${highlightId === item.id ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''}`}>
                              <td className="p-3">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-10 h-10 rounded object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = "/placeholder.svg";
                                  }}
                                />
                              </td>
                              <td className="p-3 font-medium">{item.name}</td>
                              <td className="p-3 text-muted-foreground hidden md:table-cell">
                                <span className="line-clamp-1">{item.description || "—"}</span>
                              </td>
                              <td className="p-3">
                                {item.priceFrom && <span className="text-xs text-muted-foreground">a partir de </span>}
                                R$ {item.price.toFixed(2)}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-block h-2 w-2 rounded-full ${item.available !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              </td>
                              <td className="p-3 hidden md:table-cell">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {item.popular && (
                                    <span className="inline-block bg-food-green text-white text-xs px-1.5 py-0.5 rounded">Popular</span>
                                  )}
                                  {item.hasVariations && (
                                    <span className="inline-block bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">Variações</span>
                                  )}
                                  {item.isHalfPizza && (
                                    <span className="inline-block bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded">½ a ½</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => handleEditItem(item)} disabled={isDeleting} title="Editar">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleMoveItem(category.id, items, index, -1)} disabled={isDeleting || index === 0 || reorderingCategory === category.id} title="Mover para cima">
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleMoveItem(category.id, items, index, 1)} disabled={isDeleting || index === items.length - 1 || reorderingCategory === category.id} title="Mover para baixo">
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleDuplicateItem(item)} disabled={isDeleting} title="Duplicar">
                                    <Copy className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(item)} disabled={isDeleting} title="Excluir">
                                    <Trash2 className={`h-4 w-4 ${isDeleting ? 'text-gray-400' : 'text-red-500'}`} />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <EditMenuItemModal
          editItem={editItem}
          setEditItem={setEditItem}
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
          
