import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MenuItem, PizzaSize } from "@/types/menu";
import { formatCurrency } from "@/lib/utils";
import { Pizza } from "lucide-react";

interface SecondHalfDialogProps {
  item: MenuItem | null;
  size: PizzaSize | null;
  sizeName?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const SecondHalfDialog: React.FC<SecondHalfDialogProps> = ({
  item,
  size,
  sizeName,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!item) return null;

  const displayPrice = size ? size.price : item.price;
  const labelSize = size?.name ?? sizeName ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">{item.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {labelSize && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              Tamanho: <span className="font-semibold">{labelSize}</span>
              <span className="block text-xs text-amber-700 mt-1">
                Igual ao da primeira metade.
              </span>
            </div>
          )}

          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">
              Preço desta metade{labelSize ? ` (${labelSize})` : ""}:
            </div>
            <div className="text-lg font-bold text-brand">{formatCurrency(displayPrice)}</div>
            <div className="text-xs text-gray-500 mt-1">
              * O valor final da pizza meio a meio é o maior valor entre as duas metades.
            </div>
          </div>

          <Button
            onClick={onConfirm}
            className="w-full bg-green-600 hover:bg-green-700 text-white border-none text-base font-bold py-6"
          >
            <Pizza className="mr-2 h-5 w-5 text-white" />
            Escolher a segunda metade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SecondHalfDialog;
