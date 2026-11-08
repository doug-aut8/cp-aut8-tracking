import { useState } from "react";
import { Clock3, DoorClosed, DoorOpen, Loader2, RotateCcw, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStoreOpen } from "@/hooks/useStoreOpen";
import { useToast } from "@/hooks/use-toast";
import type { StoreMode } from "@/utils/storeOperation";

export default function StoreOperationControl() {
  const { isOpen, status, mode, loading, error, saving, setMode } = useStoreOpen();
  const { toast } = useToast();
  const [pendingMode, setPendingMode] = useState<StoreMode | null>(null);
  const confirm = async () => {
    if (!pendingMode) return;
    try {
      await setMode(pendingMode);
      toast({ title: pendingMode === "automatico" ? "Horário automático restaurado" : pendingMode === "aberta" ? "Loja aberta manualmente" : "Loja fechada manualmente" });
      setPendingMode(null);
    } catch {
      toast({ title: "Não foi possível alterar a loja", description: "Confira sua conexão e sua permissão de administrador e tente novamente.", variant: "destructive" });
    }
  };
  return (
    <section aria-label="Funcionamento da loja" className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
      <div className="flex min-w-0 items-center gap-3" role="status">
        <Store className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <span className={`h-2.5 w-2.5 rounded-full ${isOpen ? "store-open-dot" : "bg-destructive"}`} />
            {loading ? "Consultando loja..." : error ? "Status indisponível" : isOpen ? "Loja Aberta" : "Loja Fechada"}
          </div>
          <p className="text-sm text-muted-foreground">{error ? "Não foi possível consultar o funcionamento." : mode === "automatico" ? `Automático · ${status.label}` : `${status.label} · Horário automático suspenso`}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={isOpen ? "destructive" : "default"} disabled={loading || saving || !!error} onClick={() => setPendingMode(isOpen ? "fechada" : "aberta")} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isOpen ? <DoorClosed className="h-4 w-4" /> : <DoorOpen className="h-4 w-4" />}
          {isOpen ? "Fechar Loja" : "Abrir Loja"}
        </Button>
        {mode !== "automatico" && <Button variant="outline" disabled={loading || saving || !!error} onClick={() => setPendingMode("automatico")} className="gap-2"><RotateCcw className="h-4 w-4" />Voltar ao Automático</Button>}
      </div>
      <Dialog open={pendingMode !== null} onOpenChange={(open) => { if (!open && !saving) setPendingMode(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingMode === "automatico" ? "Voltar ao horário automático?" : pendingMode === "aberta" ? "Abrir Loja?" : "Fechar Loja?"}</DialogTitle>
            <DialogDescription>{pendingMode === "automatico" ? "A loja volta a seguir os dias e horários cadastrados." : pendingMode === "aberta" ? "A loja aceitará pedidos mesmo fora do horário. Essa escolha permanece até você fechar a loja ou voltar ao automático." : "Novos pedidos de clientes ficarão bloqueados. Os pedidos já recebidos não serão alterados. Essa escolha permanece até você abrir a loja ou voltar ao automático."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setPendingMode(null)}>Cancelar</Button>
            <Button variant={pendingMode === "fechada" ? "destructive" : "default"} disabled={saving} onClick={confirm} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}{saving ? "Salvando..." : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}