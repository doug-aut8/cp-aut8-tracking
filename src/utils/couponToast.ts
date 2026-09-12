import { toast } from "@/components/ui/use-toast";

let activeCouponToast: { id: string; dismiss: () => void } | null = null;

export const showCouponToast = (options: {
  title: string;
  description: string;
  variant?: "default" | "destructive" | "success";
}) => {
  // Dismiss any previous coupon toast so only one remains visible
  if (activeCouponToast) {
    activeCouponToast.dismiss();
    activeCouponToast = null;
  }

  const t = toast({
    ...options,
    variant: options.variant || "success",
    // Valor máximo válido para setTimeout (limite de 32 bits). Usar
    // Number.MAX_SAFE_INTEGER faz o timer estourar e fechar o toast na hora.
    duration: 2147483647,
  });

  activeCouponToast = { id: t.id, dismiss: t.dismiss };
  return t;
};

export const dismissCouponToast = () => {
  if (activeCouponToast) {
    activeCouponToast.dismiss();
    activeCouponToast = null;
  }
};
