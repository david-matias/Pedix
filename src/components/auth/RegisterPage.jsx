import { Lock, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { MfaFlow } from "@/components/auth/MfaFlow";
import { MfaScreen } from "@/components/auth/MfaParts";
import { AuthError, AuthLink, GoogleButton, OrDivider, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";

const isAlreadyVerified = (err) => err?.status === 400 && /already verified/i.test(err?.message ?? "");

/**
 * A página /register: cadastro → código → verifyOtp → setToken. O cadastro sozinho
 * não faz login (a conta fica não verificada), então o passo do código nunca é
 * pulado e loginViaEmailPassword não é chamado logo após registrar.
 */
export function RegisterPage() {
  const returnTo = safeReturnTo();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState(null);

  async function register(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("As senhas não conferem");
      return;
    }
    setBusy(true);
    try {
      await base44.auth.register({ email, password });
      setStep("otp");
    } catch (err) {
      setError(err.message || "Não foi possível criar a conta");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.mfa_required) {
        setMfaChallenge(result);
        return;
      }
      if (result?.access_token) base44.auth.setToken(result.access_token);
      window.location.href = returnTo;
    } catch (err) {
      // Verificado no servidor mas a resposta não chegou: o código já foi usado e
      // não há token, então o caminho é entrar normalmente.
      if (isAlreadyVerified(err)) setStep("already_verified");
      else setError(err.message || "Código de verificação inválido");
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast("Código enviado", { description: "Confira seu e-mail para ver o novo código." });
    } catch (err) {
      if (isAlreadyVerified(err)) setStep("already_verified");
      else setError(err.message || "Não foi possível reenviar o código");
    }
  }

  // A conta está verificada; o segundo passo do login ocupa a página inteira.
  if (mfaChallenge) return <MfaScreen><MfaFlow challenge={mfaChallenge} returnTo={returnTo} /></MfaScreen>;

  if (step === "already_verified") {
    return (
      <AuthLayout icon={UserPlus} title="Criar conta" subtitle="Cadastre-se para começar">
        <p className="mb-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{email}</span> já está verificada. Entre para continuar.
        </p>
        <AuthLink to="/login" returnTo={returnTo} className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Entrar
        </AuthLink>
      </AuthLayout>
    );
  }

  if (step === "otp") {
    return (
      <AuthLayout icon={UserPlus} title="Criar conta" subtitle="Cadastre-se para começar">
        <form onSubmit={verify}>
          <p className="mb-4 text-sm text-muted-foreground">
            Enviamos um código de 6 dígitos para <span className="font-medium text-foreground">{email}</span>.
          </p>
          <AuthError>{error}</AuthError>
          <div className="mb-6 flex justify-center">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <SubmitButton busy={busy} busyLabel="Verificando..." disabled={busy || otpCode.length < 6}>
            Verificar
          </SubmitButton>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Não recebeu o código?{" "}
            <button type="button" onClick={resend} className="font-medium text-primary hover:underline">
              Reenviar
            </button>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={UserPlus} title="Criar conta" subtitle="Cadastre-se para começar">
      <GoogleButton returnTo={returnTo} onError={setError} />
      <OrDivider />
      <AuthError>{error}</AuthError>
      <form onSubmit={register} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="register-email">E-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="register-email" type="email" autoComplete="email" autoFocus placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" disabled={busy} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">Senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="register-password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" disabled={busy} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-confirm">Confirmar senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="register-confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12 pl-10" disabled={busy} required />
          </div>
        </div>
        <SubmitButton busy={busy} busyLabel="Criando conta...">
          Criar conta
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <AuthLink to="/login" returnTo={returnTo}>
          Entrar
        </AuthLink>
      </p>
    </AuthLayout>
  );
}