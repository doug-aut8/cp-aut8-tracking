
import { MenuItem, Category, Variation, VariationGroup } from "@/types/menu";
import { v4 as uuidv4 } from 'uuid';

export const categories: Category[] = [
  { id: "entradas", name: "Entradas", order: 1 },
  { id: "tacos", name: "Tacos", order: 2 },
  { id: "burritos", name: "Burritos", order: 3 },
  { id: "quesadillas", name: "Quesadillas", order: 4 },
  { id: "principais", name: "Pratos Principais", order: 5 },
  { id: "bebidas", name: "Bebidas", order: 6 },
  { id: "sobremesas", name: "Sobremesas", order: 7 }
];

export const variations: Variation[] = [
  { id: "var1", name: "Taco de Carne", available: true, categoryIds: ["tacos", "combos"] },
  { id: "var2", name: "Taco de Queijo", available: true, categoryIds: ["tacos", "combos"] },
  { id: "var3", name: "Taco de Pernil", available: true, categoryIds: ["tacos", "combos"] },
  { id: "var4", name: "Taco de Frango", available: true, categoryIds: ["tacos", "combos"] },
  { id: "var5", name: "Burrito de Carne", available: true, categoryIds: ["burritos", "combos"] },
  { id: "var6", name: "Burrito de Queijo", available: true, categoryIds: ["burritos", "combos"] },
];

// Create sample variation groups
const recheioGroup: VariationGroup = {
  id: uuidv4(),
  name: "Recheios",
  minRequired: 3,
  maxAllowed: 3,
  variations: ["var1", "var2", "var3", "var4"],
  customMessage: "Escolha {min} tipos de recheio ({count}/{min} selecionados)"
};

const burritoGroup: VariationGroup = {
  id: uuidv4(),
  name: "Sabores",
  minRequired: 2,
  maxAllowed: 2,
  variations: ["var5", "var6"],
  customMessage: "Escolha {min} sabores de burrito ({count}/{min} selecionados)"
};

export const menuItems: MenuItem[] = [
  {
    id: "1",
    name: "Nachos Supremos",
    description: "Tortilhas crocantes cobertas com queijo derretido, guacamole, pico de gallo, creme azedo e jalapeños",
    price: 24.90,
    image: "https://villamex.com.br/wp-content/uploads/al_opt_content/IMAGE/villamex.com.br/wp-content/uploads/2023/08/NACHOS-1024x682.webp.bv_resized_mobile.webp.bv.webp",
    category: "entradas",
    popular: true,
  },
  {
    id: "2",
    name: "Festival dos Tacos",
    description: "Abacate amassado na hora com tomate, cebola, coentro, limão e especiarias. Servido com tortilhas",
    price: 19.90,
    image: "/images/festival-dos-tacos.png",
    category: "entradas",
  },
  {
    id: "3",
    name: "Quesadillas",
    description: "Tortilha de trigo recheada com carne temperada, servida com guacamole, pico de gallo e creme azedo",
    price: 22.50,
    image: "/images/enchiladas_de_carne.png",
    category: "entradas",
  },
  {
    id: "4",
    name: "Burrito de Carne",
    description: "Tortilha de trigo recheada com carne bovina temperada, arroz mexicano, pasta de feijão e queijo",
    price: 32.90,
    image: "/images/burrito_de_carne.png",
    category: "principais",
    popular: true,
  },
  {
    id: "5",
    name: "Tacos de Queijo",
    description: "Três tacos com tortilhas de milho, frango desfiado, pico de gallo, guacamole e coentro fresco",
    price: 29.90,
    image: "/images/tacos_de_queijo.png",
    category: "principais",
  },
  {
    id: "6",
    name: "Combo 3 Tacos",
    description: "Escolha três tacos com os recheios que preferir. Acompanha guacamole, pico de gallo e creme azedo.",
    price: 34.90,
    image: "/images/trio-mex.png",
    category: "tacos",
    hasVariations: true,
    variationGroups: [recheioGroup]
  },
  {
    id: "7",
    name: "Tacos Mexicanos",
    description: "Tiras de carne grelhadas com pimentões e cebola, acompanha tortilhas, guacamole, pico de gallo e creme azedo",
    price: 38.90,
    image: "/images/tacos.png",
    category: "principais",
    popular: true,
  },
  {
    id: "8",
    name: "Combo 2 Burritos",
    description: "Escolha dois burritos com os recheios que preferir. Servido com chips de tortilla.",
    price: 39.90,
    image: "/images/burrito.jpg",
    category: "burritos",
    hasVariations: true,
    variationGroups: [burritoGroup]
  },
  {
    id: "9",
    name: "Suco Natural",
    description: "Copo 300ml. Opções: Laranja, Limão, Abacaxi",
    price: 8.90,
    image: "/images/suco.jpg",
    category: "bebidas",
  },
  {
    id: "10",
    name: "Água Mineral",
    description: "Garrafa 500ml",
    price: 4.50,
    image: "/images/agua.jpg",
    category: "bebidas",
  },
  {
    id: "11",
    name: "Churros Mexicanos",
    description: "Massa frita polvilhada com canela e açúcar, servida com doce de leite",
    price: 18.90,
    image: "/images/mini-churros.png",
    category: "sobremesas",
    popular: true,
  },
  {
    id: "12",
    name: "Costela Prime Top",
    description: "Delicioso hambúrguer com 250g de costela de qualidade",
    price: 28.90,
    image: "/images/costela_prime.webp",
    category: "sobremesas",
  }
];

export const getMenuItemsByCategory = (categoryId: string): MenuItem[] => {
  return menuItems.filter(item => item.category === categoryId);
};

export const getPopularItems = (): MenuItem[] => {
  return menuItems.filter(item => item.popular === true);
};

export const getVariationsForItem = (item: MenuItem): Variation[] => {
  if (!item.variationGroups) {
    return [];
  }
  
  // Get all variation IDs from all groups
  const variationIds = item.variationGroups.flatMap(group => group.variations);
  
  return variations.filter(
    variation => 
      variation.available && 
      variationIds.includes(variation.id)
  );
};
