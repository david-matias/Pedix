import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OptionGroupsEditor from "@/components/lojista/OptionGroupsEditor";
import { base44 } from "@/api/base44Client";
import { asList, centsToInput, parseMoneyToCents } from "@/lib/pedix";

function toDraft(groups, options) {
  return asList(groups)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((group) => ({
      name: group.name,
      selection: group.selection,
      required: Boolean(group.required),
      min_select: group.min_select ?? 0,
      max_select: group.max_select ?? 1,
      options: asList(options)
        .filter((option) => option.group_id === group.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((option) => ({ name: option.name, price: centsToInput(option.price_delta_cents) })),
    }));
}

export default function ProductDialog({ open, onOpenChange, establishmentId, categories, product, defaultCategoryId, onSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0,00");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [imageUrl, setImageUrl] = useState("");
  const [active, setActive] = useState(true);
  const [stationId, setStationId] = useState("");
  const [stations, setStations] = useState([]);
  const [trackStock, setTrackStock] = useState(false);
  const [stockMin, setStockMin] = useState("0");
  const [groups, setGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(product?.name ?? "");
    setDescription(product?.description ?? "");
    setPrice(centsToInput(product?.price_cents ?? 0));
    setCategoryId(product?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "");
    setImageUrl(product?.image_url ?? "");
    setActive(product?.active !== false);
    setStationId(product?.station_id ?? "");
    setTrackStock(product?.track_stock === true);
    setStockMin(String(product?.stock_min ?? 0));

    base44.entities.Station.filter({ establishment_id: establishmentId }).then((rows) =>
      setStations(asList(rows).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    );

    if (!product) {
      setGroups([]);
      return;
    }
    (async () => {
      const [groupRows, optionRows] = await Promise.all([
        base44.entities.OptionGroup.filter({ product_id: product.id }),
        base44.entities.Option.filter({ establishment_id: establishmentId }),
      ]);
      setGroups(toDraft(groupRows, optionRows));
    })();
  }, [open, product?.id]);

  function validate() {
    if (name.trim().length < 2) return "Informe o nome do produto.";
    if (!categoryId) return "Escolha a categoria.";
    for (const group of groups) {
      if (!group.name.trim()) return "Todo grupo precisa de nome.";
      if (group.options.length === 0) return "Cada grupo precisa de pelo menos uma opção.";
      if (group.options.some((option) => !option.name.trim())) return "Toda opção precisa de nome.";
      if (group.selection === "SINGLE" && group.required && (Number(group.min_select) !== 1 || Number(group.max_select) !== 1)) {
        return "Grupo único obrigatório tem mínimo 1 e máximo 1.";
      }
      if (group.selection === "MULTIPLE" && Number(group.max_select) < Number(group.min_select)) {
        return "No grupo múltiplo, o máximo deve ser maior ou igual ao mínimo.";
      }
    }
    return "";
  }

  async function save() {
    const problem = validate();
    if (problem) {
      setError(problem);
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
        station_id: stationId,
        track_stock: trackStock,
        stock_min: Number(stockMin) || 0,
      };

      let productId = product?.id;
      if (productId) {
        await base44.entities.Product.update(productId, payload);
      } else {
        const created = await base44.entities.Product.create({ ...payload, sort_order: 99 });
        productId = created.id;
      }

      const previousGroups = asList(await base44.entities.OptionGroup.filter({ product_id: productId }));
      for (const group of previousGroups) {
        const previousOptions = asList(await base44.entities.Option.filter({ group_id: group.id }));
        for (const option of previousOptions) await base44.entities.Option.delete(option.id);
        await base44.entities.OptionGroup.delete(group.id);
      }

      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        const savedGroup = await base44.entities.OptionGroup.create({
          establishment_id: establishmentId,
          product_id: productId,
          name: group.name.trim(),
          selection: group.selection,
          required: Boolean(group.required),
          min_select: group.selection === "SINGLE" ? (group.required ? 1 : 0) : Number(group.min_select ?? 0),
          max_select: group.selection === "SINGLE" ? 1 : Number(group.max_select ?? 1),
          sort_order: index + 1,
        });
        for (let optionIndex = 0; optionIndex < group.options.length; optionIndex += 1) {
          const option = group.options[optionIndex];
          await base44.entities.Option.create({
            establishment_id: establishmentId,
            group_id: savedGroup.id,
            name: option.name.trim(),
            price_delta_cents: parseMoneyToCents(option.price),
            active: true,
            sort_order: optionIndex + 1,
          });
        }
      }

      onSaved();
      onOpenChange(false);
    } catch {
      setError("Não foi possível salvar o produto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[460px] overflow-y-auto rounded-card">
        <DialogHeader>
          <DialogTitle className="text-[17px]">{product ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label htmlFor="product-name" className="text-[12.5px] font-semibold text-foreground">
              Nome
            </label>
            <input
              id="product-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="product-description" className="text-[12.5px] font-semibold text-foreground">
              Descrição
            </label>
            <input
              id="product-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="product-price" className="text-[12.5px] font-semibold text-foreground">
                Preço (R$)
              </label>
              <input
                id="product-price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                onBlur={(event) => setPrice(centsToInput(parseMoneyToCents(event.target.value)))}
                inputMode="decimal"
                className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
              />
            </div>
            <div>
              <label htmlFor="product-category" className="text-[12.5px] font-semibold text-foreground">
                Categoria
              </label>
              <select
                id="product-category"
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
            <label htmlFor="product-image" className="text-[12.5px] font-semibold text-foreground">
              Foto (URL)
            </label>
            <input
              id="product-image"
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
            <label htmlFor="product-station" className="text-[12.5px] font-semibold text-foreground">
              Estação na cozinha
            </label>
            <select
              id="product-station"
              value={stationId}
              onChange={(event) => setStationId(event.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-2 text-[13px] outline-none focus:border-brand"
            >
              <option value="">Sem estação</option>
              {stations
                .filter((station) => station.active !== false)
                .map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">Sem estação, o item não gera ficha.</p>
          </div>

          <label className="flex min-h-[46px] items-center justify-between rounded-btn border border-border px-3.5">
            <span className="text-[13.5px] text-foreground">Controlar estoque</span>
            <input
              type="checkbox"
              checked={trackStock}
              onChange={(event) => setTrackStock(event.target.checked)}
              className="h-5 w-5 accent-[#D0121A]"
            />
          </label>

          {trackStock && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-btn border border-border px-3.5 py-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Saldo atual
                </p>
                <p className="text-[15px] font-semibold text-foreground">{product?.stock_qty ?? 0}</p>
                <p className="text-[10.5px] leading-snug text-muted-foreground">Ajustes em Gestão → Estoque.</p>
              </div>
              <div>
                <label htmlFor="product-stock-min" className="text-[12.5px] font-semibold text-foreground">
                  Mínimo
                </label>
                <input
                  id="product-stock-min"
                  value={stockMin}
                  inputMode="numeric"
                  onChange={(event) => setStockMin(event.target.value)}
                  className="mt-1.5 min-h-[46px] w-full rounded-btn border border-input px-3.5 text-[14px] outline-none focus:border-brand"
                />
              </div>
            </div>
          )}

          <div>
            <p className="text-[12.5px] font-semibold text-foreground">Grupos de opção</p>
            <div className="mt-1.5">
              <OptionGroupsEditor groups={groups} onChange={setGroups} />
            </div>
          </div>

          {error && <p className="text-[12px] font-medium text-brand">{error}</p>}

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="min-h-[48px] w-full rounded-btn bg-brand text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Salvando..." : "Salvar produto"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}