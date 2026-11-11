import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthLink, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";

// A página /forgot-password. Termina sempre na mensagem genérica: a API não
// revela se o e-mail está cadastrado, e a interface também não.
export function ForgotPasswordPage() {
  const returnTo = safeReturnTo();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {
      // O resultado é o mesmo de qualquer jeito.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <AuthLayout icon={Mail} title="Recuperar senha" subtitle="Enviamos um link para você criar outra">
      {sent ? (
        <p className="text-center text-sm text-foreground">
          Se existir uma conta com esse e-mail, você recebe um link de recuperação em instantes.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="forgot-email" type="email" autoComplete="email" autoFocus placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" required />
            </div>
          </div>
          <SubmitButton busy={busy} busyLabel="Enviando...">
            Enviar link
          </SubmitButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <AuthLink to="/login" returnTo={returnTo}>
          <ArrowLeft className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Voltar para entrar
        </AuthLink>
      </p>
    </AuthLayout>
  );
}