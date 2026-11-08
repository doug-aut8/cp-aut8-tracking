import { toast } from "@/components/ui/use-toast";

let activePromoToast: { id: string; dismiss: () => void } | null = null;
let activeDescription: string | null = null;

const YELLOW_CLASSNAME =
  "border-yellow-400 bg-yellow-100 text-yellow-900 [&_*]:text-yellow-900";

export const showPromoRequirementsToast = (description: string) => {
  if (activePromoToast && activeDescription === description) {
    return activePromoToast;
  }
  if (activePromoToast) {
    activePromoToast.dismiss();
    activePromoToast = null;
  }
  activeDescription = description;
  const t = toast({
    title: "Requisitos da Promoção:",
    description,
    className: YELLOW_CLASSNAME,
    duration: 2147483647,
  });
  activePromoToast = { id: t.id, dismiss: t.dismiss };
  return t;
};

export const dismissPromoRequirementsToast = () => {
  if (activePromoToast) {
    activePromoToast.dismiss();
    activePromoToast = null;
    activeDescription = null;
  }
};

export const getPromoRequirementsDescription = () => activeDescription;