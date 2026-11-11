import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createStore } from "@/lib/admin-fns";

const inputClass =
  "mt-1.5 min-h-[46px] w-full rounded-btn border border-input bg-card px-3.5 text-[14px] outline-none focus:border-brand";

export default function NewStoreDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await createStore({
        data: { name: name.trim(), slug: slug.trim(), whatsapp: whatsapp.trim(), owner_email: email.trim() },
      });
      if (result.status === "ok") {
        setName("");
        setSlug("");
        setWhatsapp("");
        setEmail("");
        onCreated(result.establishment);
        onOpenChange(false);
      } else {
        setError(result.message ?? "Não foi possível criar a loja.");
      }
    } catch {
      setError("Não foi possível criar a loja.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] rounded-card">
        <DialogHeader>
          <DialogTitle className="text-[17px]">Nova loja</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[12.5px] font-semibold text-foreground">Nome do estabelecimento</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-[12.5px] font-semibold text-foreground">Endereço no Pedix</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="ex.: sabor-da-praia"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-[12.5px] font-semibold text-foreground">WhatsApp</span>
            <input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-[12.5px] font-semibold text-foreground">E-mail do lojista</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
          </label>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Cria a assinatura em demonstração, liga Pedix Base e Pedix Delivery e envia o convite ao lojista.
          </p>
          {error && <p className="text-[12px] font-medium text-brand">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={busy || name.trim().length < 2 || !email.trim() || !slug.trim()}
            className="min-h-[48px] w-full rounded-btn bg-brand text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Criando..." : "Criar loja"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}