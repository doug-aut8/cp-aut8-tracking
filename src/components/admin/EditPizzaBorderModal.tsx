import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PizzaBorder, savePizzaBorder, syncBordersToMenuItems } from "@/services/pizzaBorderService";

interface EditPizzaBorderModalProps {
  border: PizzaBorder;
  setBorder: (border: PizzaBorder | null) => void;
  onSuccess: () => void;
}

export const EditPizzaBorderModal = ({
  border,
  setBorder,
  onSuccess,
}: EditPizzaBorderModalProps) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<PizzaBorder>({ ...border });

  const isNewBorder = !border.id || border.id === "" || border.id.startsWith("temp-");

  const handleSave = async () => {
    if (!formData.name || formData.name.trim() === "") {
      toast({
        title: "Erro",
        description: "O nome da borda é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      await savePizzaBorder(formData);
      
      // Sincronizar bordas em todos os itens do menu
      await syncBordersToMenuItems();
      
      toast({
        title: "Sucesso",
        description: isNewBorder 
          ? "Borda criada com sucesso" 
          : "Borda atualizada e sincronizada nos itens",
      });
      
      setBorder(null);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao salvar borda:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar a borda",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!border} onOpenChange={() => setBorder(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNewBorder ? "Nova Borda de Pizza" : "Editar Borda"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Borda *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Catupiry, Cheddar, Chocolate..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição opcional da borda"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalPrice">Preço Adicional (R$)</Label>
            <Input
              id="additionalPrice"
              type="number"
              step="0.01"
              min="0"
              value={formData.additionalPrice}
              onChange={(e) => setFormData({ 
                ...formData, 
                additionalPrice: parseFloat(e.target.value) || 0 
              })}
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500">
              Deixe 0 para bordas gratuitas
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="available">Disponível</Label>
              <p className="text-xs text-gray-500">
                Bordas indisponíveis não aparecem para os clientes
              </p>
            </div>
            <Switch
              id="available"
              checked={formData.available}
              onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setBorder(null)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Salvando..." : isNewBorder ? "Criar Borda" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
