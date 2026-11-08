export type StoreMode = "automatico" | "aberta" | "fechada";
export const STORE_MODE_KEY = "loja_modo_funcionamento";
export const parseStoreMode = (value: unknown): StoreMode =>
  value === "aberta" || value === "fechada" ? value : "automatico";
export const resolveStoreOperation = (mode: StoreMode, automatic: { isOpen: boolean; label: string }) => {
  if (mode === "aberta") return { isOpen: true, label: "Aberta manualmente" };
  if (mode === "fechada") return { isOpen: false, label: "Fechada manualmente" };
  return automatic;
};