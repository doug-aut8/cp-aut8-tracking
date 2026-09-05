export interface PizzaBorder {
  id: string;
  name: string;
  description?: string;
  additionalPrice: number;
  available: boolean;
}

export interface PizzaSize {
  id: string;
  name: string;
  price: number;
  cost?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  cost?: number; // Custo do produto
  image: string;
  category: string;
  additionalCategories?: string[]; // Categorias adicionais — item aparece em múltiplas categorias
  popular?: boolean;
  available?: boolean; // Indica se o produto está disponível
  hasVariations?: boolean;
  variationGroups?: VariationGroup[]; // Now accepts only VariationGroup objects
  priceFrom?: boolean; // New property to indicate "a partir de" pricing
  tipo?: "padrao" | "pizza"; // Type of item - standard or pizza
  permiteCombinacao?: boolean; // Allow half-and-half combinations for pizzas
  maxSabores?: number; // Maximum number of flavors for combinations
  isHalfPizza?: boolean; // Indicates if this is a half pizza combination
  combination?: {
    sabor1: { id: string; name: string };
    sabor2: { id: string; name: string };
    tamanho: string; // Nome do tamanho selecionado (ex.: Broto, Grande)
    size?: { id: string; name: string; price: number }; // Tamanho selecionado da combinação
  };
  pizzaBorders?: PizzaBorder[]; // Bordas disponíveis para esta pizza
  bordersPosition?: number; // Posição da seção de bordas entre os grupos de variação
  pizzaSizes?: PizzaSize[]; // Tamanhos disponíveis para esta pizza (nome + preço)
  freteGratis?: boolean; // Indica se o item concede frete grátis ao pedido
  sku?: string; // Código SKU do produto
  weightG?: number; // Peso em gramas
  lengthCm?: number; // Comprimento em cm
  widthCm?: number; // Largura em cm
  heightCm?: number; // Altura em cm
  stock?: number | null; // Estoque disponível (null = ilimitado)
  submenuName?: string; // Nome do submenu (itens relacionados)
  submenuDescription?: string; // Descrição do submenu
  submenuItemIds?: string[]; // IDs dos itens vinculados ao submenu
  hiddenInMenu?: boolean; // Oculta o item na listagem principal do cardápio
  displayOrder?: number; // Ordem de exibição do item dentro da categoria
}

export interface CartItem extends MenuItem {
  quantity: number;
  selectedVariations?: SelectedVariationGroup[];
  selectedBorder?: PizzaBorder; // Borda selecionada para pizza
  selectedSize?: PizzaSize; // Tamanho selecionado para pizza
  isHalfPizza?: boolean; // Indicates if this is a half pizza combination
  combination?: {
    sabor1: { id: string; name: string };
    sabor2: { id: string; name: string };
    tamanho: string; // Nome do tamanho selecionado (ex.: Broto, Grande)
    size?: { id: string; name: string; price: number }; // Tamanho selecionado da combinação
  };
}

export interface SelectedVariationGroup {
  groupId: string;
  groupName: string;
  variations: SelectedVariation[];
}

// SelectedVariation movido para o final do arquivo após HalfSelection

export interface Category {
  id: string;
  name: string;
  order?: number;
  isPopularCategory?: boolean; // Categoria fixa de "Produtos Mais Vendidos"
  visible?: boolean; // Controla exibição da categoria (usado pela categoria de populares)
  showInCategoryNav?: boolean; // Controla se a categoria aparece no menu de categorias (default true)
  columnsMobile?: number | null; // Número de colunas no mobile (1 ou 2); null = usa configuração global
}

export const POPULAR_CATEGORY_ID = "popular-items";

export interface Variation {
  id: string;
  name: string;
  description?: string;
  additionalPrice?: number;
  available: boolean;
  categoryIds: string[]; // Categories where this variation can be used
}

export interface VariationGroup {
  id: string;
  name: string;
  internalName?: string;
  minRequired: number;
  maxAllowed: number;
  variations: string[];
  customMessage?: string;
  applyToHalfPizza?: boolean; // Indica se o grupo aparece em pizzas meio a meio
  allowPerHalf?: boolean; // Permite adicionar em cada metade da pizza
  collapsible?: boolean; // Exibe o grupo como sanfona (dropdown) no cardápio
  hideMainQuantitySelector?: boolean; // Oculta o seletor de quantidade principal do item quando este grupo estiver presente
}

// Tipo para especificar em qual metade o adicional foi aplicado
export type HalfSelection = "half1" | "half2" | "whole";

export interface SelectedVariation {
  variationId: string;
  quantity: number;
  name?: string;
  additionalPrice?: number;
  halfSelection?: HalfSelection; // Em qual metade o adicional foi aplicado
}
