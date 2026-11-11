import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

export default function ModuleOff() {
  return (
    <div className="px-5 py-16 text-center">
      <Lock className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="mt-4 text-[15px] font-semibold text-foreground">O Pedix Mesas não está ligado nesta loja.</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        As comandas antigas continuam só de leitura dentro dos Pedidos.
      </p>
      <Link
        to="/pedidos"
        className="mt-5 inline-flex min-h-[46px] items-center justify-center rounded-btn border border-border bg-card px-4 text-[13.5px] font-semibold text-foreground"
      >
        Ver pedidos
      </Link>
    </div>
  );
}