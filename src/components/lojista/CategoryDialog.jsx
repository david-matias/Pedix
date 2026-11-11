import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";

export default function CategoryDialog({ open, onOpenChange, establishmentId, category, nextSortOrder, onSaved }) {
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setActive(category?.active !== false);
    setError("");
  }, [open, category?.id]);

  async function save() {
    if (name.trim().length < 2) {
      setError("Dê um nome à categoria.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (category) {
        await base44.entities.Category.update(category.id, { name: name.trim(), active });
      } else {
        await base44.entities.Category.create({
          establishment_id: establishmentId,
          name: name.trim(),
          active,
          sort_order: nextSortOrder ?? 1,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError("Não foi possível salvar a categoria.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] rounded-card">
        <DialogHeader>
          <DialogTitle className="text-[17px]">{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="category-name" className="text-[12.5px] font-semibold text-foreground">
              Nome
            </label>
            <input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Burgers"
              className="mt-1.5 min-h-[48px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
            />
          </div>
          <label className="flex min-h-[48px] items-center justify-between rounded-btn border border-border px-3.5">
            <span className="text-[13.5px] text-foreground">Aparece no cardápio</span>
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-5 w-5 accent-[#D0121A]"
            />
          </label>
          {error && <p className="text-[12px] font-medium text-brand">{error}</p>}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="min-h-[48px] w-full rounded-btn bg-brand text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Salvando..." : "Salvar categoria"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}