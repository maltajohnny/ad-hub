import { createContext, useContext } from "react";

/** Nó `#app-header-slot` no topo do `AppLayoutMain` — destino estável para `createPortal` (Dashboard, Board). */
export const AppHeaderSlotContext = createContext<HTMLDivElement | null>(null);

export function useAppHeaderSlot() {
  return useContext(AppHeaderSlotContext);
}
