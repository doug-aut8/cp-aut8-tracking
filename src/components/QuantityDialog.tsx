import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MenuItem, PizzaSize } from "@/types/menu";
import { formatCurrency } from "@/lib/utils";
import { Plus, Minus, ShoppingCart, Pizza, ArrowLeft } from "lucide-react";

interface QuantityDialogProps {
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: MenuItem & { selectedSize?: PizzaSize }, quantity: number) => void;
  onOpenPizzaCombination?: (size?: PizzaSize) => void;
  onBack?: () => void;
}

const QuantityDialog: React.FC<QuantityDialogProps> = ({ item, isOpen, onClose, onConfirm, onOpenPizzaCombination, onBack }) => {
  const [quantity, setQuantity] = useState(1);
  const sizes = item.pizzaSizes || [];
  const hasSizes = sizes.length > 0;
  const [selectedSize, setSelectedSize] = useState<PizzaSize | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setSelectedSize(hasSizes ? sizes[0] : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item.id]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setQuantity(1);
    }
  };

  const unitPrice = hasSizes && selectedSize ? selectedSize.price : item.price;

  const handleConfirm = () => {
    const effectiveItem =
      hasSizes && selectedSize
        ? { ...item, price: selectedSize.price, priceFrom: false, selectedSize }
        : item;
    onConfirm(effectiveItem, quantity);
    setQuantity(1);
    onClose();
  };

  const handleMeioAMeio = () => {
    onClose();
    setQuantity(1);
    onOpenPizzaCombination?.(hasSizes && selectedSize ? selectedSize : undefined);
  };

  const total = unitPrice * quantity;
  const showMeioAMeio = item.tipo === "pizza" && item.permiteCombinacao;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[85dvh] p-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1 self-start"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
          )}
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>{item.description}</DialogDescription>
        </DialogHeader>

        <div className="dialog-scroll-content flex-1 min-h-0 overflow-y-auto px-6 flex flex-col items-center gap-4 py-4">
          {item.image && (
            <div className="w-full h-40 rounded-md overflow-hidden">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            </div>
          )}

          {hasSizes && (
            <div className="w-full">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-bold">Escolha o Tamanho</h4>
                <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">
                  Obrigatório
                </span>
              </div>
              <div className="flex flex-nowrap gap-2">
                {sizes.map((size) => {
                  const active = selectedSize?.id === size.id;
                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`flex-1 min-w-0 basis-0 rounded-xl px-1 sm:px-2 py-2 text-center transition-all border ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-md"
                          : "bg-white text-foreground border-border hover:border-primary/60"
                      }`}
                    >
                      <span className="block font-bold text-[11px] sm:text-xs md:text-sm leading-tight whitespace-normal break-words">
                        {size.name || "Tamanho"}
                      </span>
                      <span className={`block text-[11px] sm:text-xs mt-0.5 ${active ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                        {formatCurrency(size.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!hasSizes && (
            <div className="text-lg font-bold text-brand">
              {formatCurrency(item.price)}
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-xl font-bold w-8 text-center">{quantity}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity((q) => q + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="dialog-footer shrink-0 border-t bg-background p-4 space-y-2">
          {showMeioAMeio && (
            <Button
              variant="outline"
              onClick={handleMeioAMeio}
              className="w-full border-orange-400 text-orange-600 hover:bg-orange-50"
            >
              <Pizza className="mr-2 h-4 w-4" />
              Quero Pizza Meio a Meio
            </Button>
          )}

          <Button
            onClick={handleConfirm}
            className="w-full bg-green-600 hover:bg-green-700 text-white border-none"
          >
            <ShoppingCart className="mr-2 h-4 w-4 text-white" />
            Adicionar {quantity}x — {formatCurrency(total)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuantityDialog;
