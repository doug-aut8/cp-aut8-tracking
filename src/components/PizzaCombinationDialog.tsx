import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MenuItem, PizzaSize } from "@/types/menu";
import { getAllMenuItems } from "@/services/menuItemService";
import { getAllVariations } from "@/services/variationService";
import { formatCurrency } from "@/lib/utils";

interface PizzaCombinationDialogProps {
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: MenuItem) => void;
  selectedSize?: PizzaSize | null;
}

interface PizzaOption {
  id: string;
  name: string;
  sizes: PizzaSize[];
  precoGrande?: number;
  freteGratis?: boolean;
}

const normalize = (s: string) => (s || "").trim().toLowerCase();

const PizzaCombinationDialog: React.FC<PizzaCombinationDialogProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
  selectedSize,
}) => {
  const [sabor1, setSabor1] = useState<string | null>(null);
  const [sabor2, setSabor2] = useState<string | null>(null);
  const [pizzaOptions, setPizzaOptions] = useState<PizzaOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Nome do tamanho escolhido na primeira metade (quando o item usa pizzaSizes)
  const sizeName = selectedSize?.name ?? null;

  useEffect(() => {
    if (isOpen) {
      // Pré-seleciona o primeiro sabor como a pizza clicada
      setSabor1(item.id);

      const loadPizzaOptions = async () => {
        try {
          setLoading(true);
          const [menuItems, variations] = await Promise.all([
            getAllMenuItems(),
            getAllVariations()
          ]);

          const pizzas = menuItems.filter(p => p.tipo === "pizza" && p.permiteCombinacao);

          const pizzaOptionsWithPrices: PizzaOption[] = pizzas.map(pizza => {
            let precoGrande = pizza.price;

            if (pizza.hasVariations && pizza.variationGroups) {
              for (const group of pizza.variationGroups) {
                const groupVariations = variations.filter(v => group.variations.includes(v.id));
                const grandeVariation = groupVariations.find(v => v.name.toLowerCase().includes("grande"));
                if (grandeVariation?.additionalPrice !== undefined) {
                  precoGrande = grandeVariation.additionalPrice;
                }
              }
            }

            return {
              id: pizza.id,
              name: pizza.name,
              sizes: pizza.pizzaSizes || [],
              precoGrande,
              freteGratis: pizza.freteGratis || false
            };
          });

          // Ordenar alfabeticamente
          pizzaOptionsWithPrices.sort((a, b) => a.name.localeCompare(b.name));

          setPizzaOptions(pizzaOptionsWithPrices);
        } catch (error) {
          console.error("Erro ao carregar opções de pizza:", error);
        } finally {
          setLoading(false);
        }
      };

      loadPizzaOptions();
    } else {
      // Limpar seleção ao fechar
      setSabor1(null);
      setSabor2(null);
    }
  }, [isOpen, item.id]);

  // Só podem ser combinadas duas metades do MESMO tamanho.
  // Quando há um tamanho escolhido, filtra as opções que possuem esse tamanho.
  const availableOptions = React.useMemo(() => {
    if (!sizeName) return pizzaOptions;
    return pizzaOptions.filter(p =>
      p.sizes.some(s => normalize(s.name) === normalize(sizeName))
    );
  }, [pizzaOptions, sizeName]);

  // Preço de uma opção para o tamanho escolhido (ou fallback legado)
  const getOptionPrice = (option?: PizzaOption): number | undefined => {
    if (!option) return undefined;
    if (sizeName) {
      const match = option.sizes.find(s => normalize(s.name) === normalize(sizeName));
      return match?.price;
    }
    return option.precoGrande;
  };

  const getOptionSize = (option?: PizzaOption): PizzaSize | undefined => {
    if (!option || !sizeName) return undefined;
    return option.sizes.find(s => normalize(s.name) === normalize(sizeName));
  };

  const calculatePrice = (): number => {
    const pizza1 = pizzaOptions.find(p => p.id === sabor1);
    const pizza2 = pizzaOptions.find(p => p.id === sabor2);

    if (!pizza1 || !pizza2) return selectedSize?.price ?? item.price;

    const p1 = getOptionPrice(pizza1) ?? 0;
    const p2 = getOptionPrice(pizza2) ?? 0;

    return Math.max(p1, p2);
  };

  const handleConfirm = () => {
    if (!sabor1 || !sabor2) return;

    const pizza1 = pizzaOptions.find(p => p.id === sabor1);
    const pizza2 = pizzaOptions.find(p => p.id === sabor2);

    if (!pizza1 || !pizza2) return;

    const finalPrice = calculatePrice();

    // Tamanho resultante da combinação (baseado no tamanho da 1ª metade)
    const combinationSize = getOptionSize(pizza1) || selectedSize || undefined;
    const sizeLabel = combinationSize?.name ? ` (${combinationSize.name})` : "";

    // Filtrar apenas os grupos de variações que devem aparecer em pizzas meio a meio
    const halfPizzaVariationGroups = item.variationGroups?.filter(
      group => group.applyToHalfPizza === true
    ) || [];

    const combinedItem = {
      ...item,
      name: `Pizza Meio a Meio${sizeLabel} - 1/2 ${pizza1.name} + 1/2 ${pizza2.name}`,
      price: finalPrice,
      priceFrom: false,
      isHalfPizza: true,
      hasVariations: halfPizzaVariationGroups.length > 0,
      variationGroups: halfPizzaVariationGroups,
      freteGratis: pizza1.freteGratis && pizza2.freteGratis,
      selectedSize: combinationSize,
      combination: {
        sabor1: { id: sabor1, name: pizza1.name },
        sabor2: { id: sabor2, name: pizza2.name },
        tamanho: combinationSize?.name ?? "grande",
        size: combinationSize,
      },
    } as MenuItem & { selectedSize?: PizzaSize };

    onAddToCart(combinedItem);
    setSabor1(null);
    setSabor2(null);
  };

  const pizza1Price = getOptionPrice(pizzaOptions.find(p => p.id === sabor1));
  const pizza2Price = getOptionPrice(pizzaOptions.find(p => p.id === sabor2));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Monte sua Pizza Meio a Meio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {sizeName && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              Tamanho escolhido: <span className="font-semibold">{sizeName}</span>
              <div className="text-xs text-amber-700 mt-1">
                As duas metades devem ser do mesmo tamanho.
              </div>
            </div>
          )}

          {/* Seleção do primeiro sabor */}
          <div>
            <label className="block font-medium mb-2">Escolha o 1º sabor:</label>
            <Select value={sabor1 || ""} onValueChange={setSabor1} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Carregando..." : "Selecione o sabor"} />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.map(pizza => {
                  const price = getOptionPrice(pizza);
                  return (
                    <SelectItem key={pizza.id} value={pizza.id}>
                      {pizza.name} {price !== undefined && `- ${formatCurrency(price)}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção do segundo sabor */}
          <div>
            <label className="block font-medium mb-2">Escolha o 2º sabor:</label>
            <Select value={sabor2 || ""} onValueChange={setSabor2} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Carregando..." : "Selecione o sabor"} />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.map(pizza => {
                  const price = getOptionPrice(pizza);
                  return (
                    <SelectItem key={pizza.id} value={pizza.id}>
                      {pizza.name} {price !== undefined && `- ${formatCurrency(price)}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Preço final */}
          {sabor1 && sabor2 && pizza1Price !== undefined && pizza2Price !== undefined && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Preço final:</div>
              <div className="text-lg font-bold text-brand">{formatCurrency(calculatePrice())}</div>
              <div className="text-xs text-gray-500 mt-1">
                * Preço baseado no sabor mais caro{sizeName ? ` (tamanho ${sizeName})` : ""}
              </div>
            </div>
          )}

          <Button
            onClick={handleConfirm}
            className="w-full"
            disabled={!sabor1 || !sabor2 || loading}
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PizzaCombinationDialog;
