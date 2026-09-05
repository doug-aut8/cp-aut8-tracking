import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AdminPageHeaderProps {
  title: string;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  className?: string;
}

/**
 * Cabeçalho padrão das páginas administrativas.
 * Título centralizado (com ícone opcional à esquerda) e um botão logo abaixo
 * que leva ao Painel de Administração.
 */
export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  icon: Icon,
  iconBg = "bg-gray-100",
  iconColor = "text-gray-600",
  className,
}) => {
  return (
    <div className={`flex flex-col items-center gap-3 text-center mb-6 ${className ?? ""}`}>
      <div className="flex items-center justify-center gap-3">
        {Icon && (
          <div className={`p-2 rounded-full ${iconBg}`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-bold leading-tight">{title}</h1>
      </div>
      <Button
        asChild
        className="bg-green-600 hover:bg-green-700 text-white gap-2 font-semibold"
      >
        <Link to="/admin-dashboard">
          <Undo2 className="h-4 w-4" />
          Painel de Administração
        </Link>
      </Button>
    </div>
  );
};

export default AdminPageHeader;
