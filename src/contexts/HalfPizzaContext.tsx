import React, { createContext, useContext, useState, ReactNode } from "react";
import { MenuItem, PizzaSize } from "@/types/menu";

export interface FirstHalf {
  item: MenuItem;
  size: PizzaSize | null;
}

interface HalfPizzaContextData {
  firstHalf: FirstHalf | null;
  startHalfPizza: (first: FirstHalf) => void;
  cancelHalfPizza: () => void;
}

const HalfPizzaContext = createContext<HalfPizzaContextData | undefined>(undefined);

export const HalfPizzaProvider = ({ children }: { children: ReactNode }) => {
  const [firstHalf, setFirstHalf] = useState<FirstHalf | null>(null);

  const startHalfPizza = (first: FirstHalf) => setFirstHalf(first);
  const cancelHalfPizza = () => setFirstHalf(null);

  return (
    <HalfPizzaContext.Provider value={{ firstHalf, startHalfPizza, cancelHalfPizza }}>
      {children}
    </HalfPizzaContext.Provider>
  );
};

export const useHalfPizza = () => {
  const ctx = useContext(HalfPizzaContext);
  if (!ctx) throw new Error("useHalfPizza deve ser usado dentro de HalfPizzaProvider");
  return ctx;
};
