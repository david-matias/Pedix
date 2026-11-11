import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLojistaContext } from "@/lib/lojista-fns";

const LojistaContext = createContext(null);

export function LojistaProvider({ children }) {
  const query = useQuery({
    queryKey: ["lojista", "context"],
    queryFn: () => getLojistaContext(),
    staleTime: 20_000,
  });

  return <LojistaContext.Provider value={query}>{children}</LojistaContext.Provider>;
}

export function useLojista() {
  const context = useContext(LojistaContext);
  if (!context) throw new Error("useLojista precisa do LojistaProvider");
  return context;
}