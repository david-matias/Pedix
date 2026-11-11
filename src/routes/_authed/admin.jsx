import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";
import Brand from "@/components/Brand";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authed/admin")({ component: AdminShell });

function AdminShell() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <Brand size="md" className="justify-center" />
        <h1 className="mt-8 text-[18px] font-semibold text-foreground">Área restrita ao Admin Pedix</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Sua conta é de lojista. O painel da plataforma fica com a equipe do Pedix.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/pedidos"
            className="flex min-h-[48px] items-center justify-center rounded-btn bg-brand text-[14px] font-semibold text-white"
          >
            Ir para os meus pedidos
          </Link>
          <Link
            to="/"
            className="flex min-h-[48px] items-center justify-center rounded-btn border border-border bg-card text-[14px] font-medium text-foreground"
          >
            Voltar para a entrada
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex min-h-[60px] max-w-6xl items-center gap-3 px-4 lg:px-8">
          <Link to="/admin" className="flex items-center gap-2.5">
            <Brand size="sm" />
          </Link>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Admin Pedix
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[12px] text-muted-foreground sm:block">{user.email}</span>
            <Link to="/admin" className="text-[12px] font-semibold text-foreground hover:text-brand">
              Estabelecimentos
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}