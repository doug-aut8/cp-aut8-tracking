import React from "react";
import { Armchair } from "lucide-react";

interface Props {
  mesa: string | null;
}

/** Mesa vem somente do QR Code configurado pelo admin; o cliente não pode alterá-la. */
const TableBadge: React.FC<Props> = ({ mesa }) => (
  <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-primary px-4 py-2 text-primary-foreground shadow">
    <span className="flex items-center gap-2 text-sm font-semibold">
      <Armchair className="h-4 w-4" />
      {mesa ? `Você está na Mesa ${mesa}` : "Mesa não identificada — leia o QR Code da sua mesa"}
    </span>
  </div>
);

export default TableBadge;
