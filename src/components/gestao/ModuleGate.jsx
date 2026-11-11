import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useLojista } from "@/components/lojista/LojistaProvider";

/** Módulo desligado esconde a função; nada já gravado é apagado. */
export default function ModuleGate({ code, name, children }) {
  const { data } = useLojista();
  const enabled = (data?.entitlements ?? []).some((entry) => entry.module === code && entry.enabled);

  if (!enabled) {
    return (
      <div className="px-5 py-16 text-center">
        <Lock className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 text-[15px] font-semibold text-foreground">{name} não está contratado.</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Seus pedidos continuam no painel de Pedidos, com os valores e o status de sempre.
        </p>
        <Link to="/pedidos" className="mt-4 inline-block text-[13px] font-semibold text-brand">
          Ver pedidos
        </Link>
      </div>
    );
  }

  return children;
}