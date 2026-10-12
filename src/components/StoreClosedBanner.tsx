import { AlertCircle } from "lucide-react";
import { useStoreOpen, DAY_NAMES } from "@/hooks/useStoreOpen";

interface Props {
  variant?: "default" | "compact";
  className?: string;
}

const StoreClosedBanner = ({ variant = "default", className = "" }: Props) => {
  const { loading, isOpen, today, schedule } = useStoreOpen();
  if (loading || isOpen) return null;

  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const msg = today?.closed
    ? `Hoje (${dayName}) a loja não abre.`
    : `Estamos fechados agora. Horário de hoje (${dayName}): ${today?.open} às ${today?.close}.`;

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 ${className}`}
    >
      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className={variant === "compact" ? "text-xs" : "text-sm"}>
        <strong>Loja fechada.</strong> {msg} Você pode navegar pelo cardápio, mas pedidos só serão aceitos no horário de funcionamento.
      </div>
    </div>
  );
};

export default StoreClosedBanner;
