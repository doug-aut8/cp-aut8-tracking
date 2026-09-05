import React from "react";
import { MenuItem } from "@/types/menu";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";

interface ProductDetailModalProps {
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: () => void;
}

const isOutOfStock = (item: MenuItem) => item.stock !== null && item.stock <= 0;
const isUnavailable = (item: MenuItem) => item.available === false || isOutOfStock(item);

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
}) => {
  const { settings } = useLayoutSettings();
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="w-full">
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="w-full max-h-[50vh] object-cover rounded-t-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        </div>
        <div className="p-6 pt-2">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl" style={{ color: settings.cor_fonte_titulo_produto }}>{item.name}</DialogTitle>
            <DialogDescription className="text-sm mt-2 whitespace-pre-line" style={{ color: settings.cor_fonte_descricao_produto }}>
              {item.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between mt-6">
            <div className="flex flex-col">
              {item.freteGratis && (
                <span className="text-xs font-semibold text-green-600 mb-1">🚚 Frete Grátis</span>
              )}
              {item.priceFrom && (
                <span className="text-xs text-muted-foreground mb-1">a partir de</span>
              )}
              <span className="text-xl font-bold text-primary">
                {formatCurrency(item.price)}
              </span>
            </div>
<Button onClick={onAddToCart} size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={isUnavailable(item)}>
  <PlusCircle className="mr-1 h-4 w-4" />
  {isOutOfStock(item) ? 'Esgotado' : (item.available === false ? 'Indisponível' : 'Adicionar')}
</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailModal;
