import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MenuItem } from "@/types/menu";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface SubmenuDialogProps {
  item: MenuItem;
  linkedItems: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (linked: MenuItem) => void;
}

const minPriceOf = (i: MenuItem) => {
  const sizes = i.pizzaSizes || [];
  return sizes.length > 0 ? Math.min(...sizes.map((s) => s.price)) : i.price;
};

const SubmenuDialog: React.FC<SubmenuDialogProps> = ({ item, linkedItems, isOpen, onClose, onSelect }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-[95vw] max-h-[85dvh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 flex-shrink-0 border-b text-left">
          <DialogTitle className="text-left">
            {item.submenuName || item.name}
          </DialogTitle>
          {item.submenuDescription && (
            <DialogDescription className="text-left">
              {item.submenuDescription}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 animate-fade-in">
          {linkedItems.map((linked) => (
            <button
              key={linked.id}
              type="button"
              onClick={() => onSelect(linked)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
            >
              {linked.image && (
                <img
                  src={linked.image}
                  alt={linked.name}
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 rounded-md object-cover flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{linked.name}</p>
                {linked.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{linked.description}</p>
                )}
                <p className="text-sm font-semibold text-brand mt-1">
                  {(linked.pizzaSizes?.length || 0) > 0 || linked.priceFrom ? "a partir de " : ""}
                  {formatCurrency(minPriceOf(linked))}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
          {linkedItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma variação disponível no momento.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubmenuDialog;
