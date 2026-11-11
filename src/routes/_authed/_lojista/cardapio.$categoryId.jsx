import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, Plus } from "lucide-react";
import { Image } from "@/components/ui/image";
import ProductDialog from "@/components/lojista/ProductDialog";
import ComboDialog from "@/components/lojista/ComboDialog";
import { useLojista } from "@/components/lojista/LojistaProvider";
import { base44 } from "@/api/base44Client";
import { asList, brl } from "@/lib/pedix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/_lojista/cardapio/$categoryId")({ component: CategoryPage });

function CategoryPage() {
  const { categoryId } = Route.useParams();
  const { data: context } = useLojista();
  const establishmentId = context?.establishment?.id;
  const queryClient = useQueryClient();
  const queryKey = ["menu", establishmentId];

  const { data, isPending } = useQuery({
    queryKey,
    enabled: Boolean(establishmentId),
    queryFn: async () => {
      const [categories, products, combos] = await Promise.all([
        base44.entities.Category.filter({ establishment_id: establishmentId }),
        base44.entities.Product.filter({ establishment_id: establishmentId }),
        base44.entities.Combo.filter({ establishment_id: establishmentId }),
      ]);
      return {
        categories: asList(categories).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        products: asList(products).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        combos: asList(combos),
      };
    },
  });

  const [productOpen, setProductOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCombo, setEditingCombo] = useState(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const categories = data?.categories ?? [];
  const category = categories.find((entry) => entry.id === categoryId);
  const products = (data?.products ?? []).filter((product) => product.category_id === categoryId);
  const combos = (data?.combos ?? []).filter((combo) => combo.category_id === categoryId);

  async function toggleProduct(product) {
    await base44.entities.Product.update(product.id, { active: product.active === false });
    refresh();
  }

  async function toggleCombo(combo) {
    await base44.entities.Combo.update(combo.id, { active: combo.active === false });
    refresh();
  }

  if (isPending) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-[14px] font-medium text-foreground">Categoria não encontrada.</p>
        <Link to="/cardapio" className="mt-3 inline-block text-[13px] font-semibold text-brand">
          Voltar ao cardápio
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-2">
        <Link
          to="/cardapio"
          aria-label="Voltar"
          className="grid h-11 w-11 place-items-center rounded-btn hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold text-foreground">{category.name}</h1>
          <p className="text-[11px] text-muted-foreground">
            {products.length + combos.length} {products.length + combos.length === 1 ? "item" : "itens"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setEditingProduct(null);
            setProductOpen(true);
          }}
          className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-btn bg-brand text-[12.5px] font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Produto
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingCombo(null);
            setComboOpen(true);
          }}
          className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-btn border border-border bg-card text-[12.5px] font-semibold text-foreground"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Combo
        </button>
      </div>

      {products.length + combos.length === 0 ? (
        <div className="mt-5 rounded-card border border-dashed border-border px-4 py-10 text-center">
          <p className="text-[13.5px] font-medium text-foreground">Esta categoria ainda não tem produtos.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Toque em “Produto” para cadastrar o primeiro item com preço e opções.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {combos.map((combo) => (
            <li key={combo.id} className="flex items-center gap-2.5 rounded-card border border-border bg-card p-2.5">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {combo.image_url ? (
                  <Image src={combo.image_url} alt={combo.name} fittingType="fill" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-foreground">
                  {combo.name}
                  <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand">
                    combo
                  </span>
                </p>
                <p className="text-[12px] text-muted-foreground">{brl(combo.price_cents)}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={combo.active !== false}
                aria-label={`Ativar ${combo.name}`}
                onClick={() => toggleCombo(combo)}
                className={cn(
                  "relative h-[24px] w-[42px] shrink-0 rounded-full transition-colors",
                  combo.active !== false ? "bg-success" : "bg-border"
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all",
                    combo.active !== false ? "left-[21px]" : "left-[3px]"
                  )}
                />
              </button>
              <button
                type="button"
                aria-label={`Editar ${combo.name}`}
                onClick={() => {
                  setEditingCombo(combo);
                  setComboOpen(true);
                }}
                className="grid h-9 w-8 place-items-center text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}

          {products.map((product) => (
            <li key={product.id} className="flex items-center gap-2.5 rounded-card border border-border bg-card p-2.5">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fittingType="fill"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-foreground">{product.name}</p>
                <p className="text-[12px] text-muted-foreground">{brl(product.price_cents)}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={product.active !== false}
                aria-label={`Ativar ${product.name}`}
                onClick={() => toggleProduct(product)}
                className={cn(
                  "relative h-[24px] w-[42px] shrink-0 rounded-full transition-colors",
                  product.active !== false ? "bg-success" : "bg-border"
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all",
                    product.active !== false ? "left-[21px]" : "left-[3px]"
                  )}
                />
              </button>
              <button
                type="button"
                aria-label={`Editar ${product.name}`}
                onClick={() => {
                  setEditingProduct(product);
                  setProductOpen(true);
                }}
                className="grid h-9 w-8 place-items-center text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ProductDialog
        open={productOpen}
        onOpenChange={setProductOpen}
        establishmentId={establishmentId}
        categories={categories}
        product={editingProduct}
        defaultCategoryId={categoryId}
        onSaved={refresh}
      />
      <ComboDialog
        open={comboOpen}
        onOpenChange={setComboOpen}
        establishmentId={establishmentId}
        categories={categories}
        products={data?.products ?? []}
        combo={editingCombo}
        defaultCategoryId={categoryId}
        onSaved={refresh}
      />
    </div>
  );
}