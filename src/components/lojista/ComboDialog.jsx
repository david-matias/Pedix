import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { asList, brl, centsToInput, parseMoneyToCents } from "@/lib/pedix";

export default function ComboDialog({ open, onOpenChange, establishmentId, categories, products, combo, defaultCategoryId, onSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0,00");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [imageUrl, setImageUrl] = useState("");
  const [active, setActive] = useState(true);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(combo?.name ?? "");
    setDescription(combo?.description ?? "");
    setPrice(centsToInput(combo?.price_cents ?? 0));
    setCategoryId(combo?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "");
    setImageUrl(combo?.image_url ?? "");
    setActive(combo?.active !== false);

    if (!combo) {
      setItems(products[0] ? [{ product_id: products[0].id, quantity: 1 }] : []);
      return;
    }
    (async () => {
      const rows = asList(await base44.entities.ComboItem.filter({ combo_id: combo.id }));
      setItems(rows.map((row) => ({ product_id: row.product_id, quantity: row.quantity ?? 1 })));
    })();
  }, [open, combo?.id]);

  async function save() {
    if (name.trim().length < 2) {
      setError("Informe o nome do combo.");
      return;
    }
    if (items.length === 0) {
      setError("Escolha pelo menos um item do combo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        establishment_id: establishmentId,
        category_id: categoryId,
        name: name.trim(),
        description: description.trim(),
        price_cents: parseMoneyToCents(price),
        image_url: imageUrl.trim(),
        active,
      };

      let comboId = combo?.id;
      if (comboId) {
        await base44.entities.Combo.update(comboId, payload);
      } else {
        const created = await base44.entities.Combo.create(payload);
        comboId = created.id;
      }

      const previous = asList(await base44.entities.ComboItem.filter({ combo_id: comboId }));
      for (const row of previous) await base44.entities.ComboItem.delete(row.id);

      await base44.entities.ComboItem.bulkCreate(
        items.map((item) => {
          const product = products.find((entry) => entry.id === item.product_id);
          return {
            establishment_id: establishmentId,
            combo_id: comboId,
            product_id: item.product_id,
            product_name: product?.name ?? "",
            quantity: item.quantity,
          };
        })
      );

      onSaved();
      onOpenChange(false);
    } catch {
      setError("Não foi possível salvar o combo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[460px] overflow-y-auto rounded-card">
        <DialogHeader>
          <DialogTitle className="text-[17px]">{combo ? "Editar combo" : "Novo combo"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label htmlFor="combo-name" className="text-[12.5px] font-semibold text-foreground">
              Nome
            </label>
            <input
              id="combo-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="combo-description" className="text-[12.5px] font-semibold text-foreground">
              Descrição
            </label>
            <input
              id="combo-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="combo-price" className="text-[12.5px] font-semibold text-foreground">
                Preço fechado (R$)
              </label>
              <input
                id="combo-price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                onBlur={(event) => setPrice(centsToInput(parseMoneyToCents(event.target.value)))}
                inputMode="decimal"
                className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
              />
            </div>
            <div>
              <label htmlFor="combo-category" className="text-[12.5px] font-semibold text-foreground">
                Categoria
              </label>
              <select
                id="combo-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-2 text-[13px] outline-none focus:border-brand"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="combo-image" className="text-[12.5px] font-semibold text-foreground">
              Foto (URL)
            </label>
            <input
              id="combo-image"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://..."
              className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[13px] outline-none focus:border-brand"
            />
          </div>
          <label className="flex min-h-[46px] items-center justify-between rounded-btn border border-border px-3.5">
            <span className="text-[13.5px] text-foreground">Ativo no cardápio</span>
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-5 w-5 accent-[#D0121A]"
            />
          </label>

          <div>
            <p className="text-[12.5px] font-semibold text-foreground">Itens do combo</p>
            <p className="text-[11px] text-muted-foreground">
              O preço do combo é fechado, não é a soma dos itens.
            </p>
            <div className="mt-2 space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <select
                    value={item.product_id}
                    onChange={(event) =>
                      setItems(items.map((entry, position) =>
                        position === index ? { ...entry, product_id: event.target.value } : entry
                      ))
                    }
                    className="min-h-[42px] flex-1 rounded-btn border border-input bg-card px-2 text-[12.5px]"
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {brl(product.price_cents)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) =>
                      setItems(items.map((entry, position) =>
                        position === index ? { ...entry, quantity: Math.max(1, Number(event.target.value)) } : entry
                      ))
                    }
                    className="h-[42px] w-14 rounded-btn border border-input bg-card px-2 text-[12.5px]"
                  />
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, position) => position !== index))}
                    aria-label="Remover item"
                    className="grid h-10 w-8 place-items-center text-muted-foreground hover:text-brand"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setItems([...items, { product_id: products[0]?.id ?? "", quantity: 1 }])}
              className="mt-2 flex min-h-[36px] items-center gap-1 text-[12px] font-semibold text-brand"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar item
            </button>
          </div>

          {error && <p className="text-[12px] font-medium text-brand">{error}</p>}

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="min-h-[48px] w-full rounded-btn bg-brand text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Salvando..." : "Salvar combo"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}