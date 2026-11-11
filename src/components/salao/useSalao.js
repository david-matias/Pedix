import { useQuery } from "@tanstack/react-query";
import { useLojista } from "@/components/lojista/LojistaProvider";
import { getSalao } from "@/lib/salao-fns";

/** Mapa e balcão: mesma chamada, atualizada a cada 15s enquanto a tela está aberta. */
export function useSalao() {
  const { data: context } = useLojista();
  const establishmentId = context?.establishment?.id;

  return useQuery({
    queryKey: ["salao", establishmentId],
    queryFn: () => getSalao(),
    enabled: Boolean(establishmentId),
    refetchInterval: 15000,
  });
}