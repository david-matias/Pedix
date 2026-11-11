import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { ChevronRight, GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import CategoryDialog from "@/components/lojista/CategoryDialog";
import { useLojista } from "@/components/lojista/LojistaProvider";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { asList } from "@/lib/pedix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/_lojista/cardapio/")({ component: MenuPage });

function MenuPage() {
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
        products: asList(products),
        combos: asList(combos),
      };
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);

  const categories = data?.categories ?? [];
  const products = data?.products ?? [];
  const combos = data?.combos ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  async function toggleActive(category) {
    await base44.entities.Category.update(category.id, { active: category.active === false });
    refresh();
  }

  async function onDragEnd(result) {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(categories);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    queryClient.setQueryData(queryKey, { categories: reordered, products, combos });
    await base44.entities.Category.bulkUpdate(reordered.map((category, index) => ({ id: category.id, sort_order: index + 1 })));
    refresh();
  }

  const deletingProducts = deleting ? products.filter((product) => product.category_id === deleting.id) : [];
  const deletingCombos = deleting ? combos.filter((combo) => combo.category_id === deleting.id) : [];

  async function inactivateAndClose() {
    setBusy(true);
    await base44.entities.Category.update(deleting.id, { active: false });
    setBusy(false);
    setDeleting(null);
    refresh();
  }

  async function moveAndDelete() {
    if (!moveTo) return;
    setBusy(true);
    if (deletingProducts.length > 0) {
      await base44.entities.Product.bulkUpdate(
        deletingProducts.map((product) => ({ id: product.id, category_id: moveTo }))
      );
    }
    if (deletingCombos.length > 0) {
      await base44.entities.Combo.bulkUpdate(deletingCombos.map((combo) => ({ id: combo.id, category_id: moveTo })));
    }
    await base44.entities.Category.delete(deleting.id);
    setBusy(false);
    setDeleting(null);
    setMoveTo("");
    refresh();
  }

  async function deleteEmpty() {
    setBusy(true);
    await base44.entities.Category.delete(deleting.id);
    setBusy(false);
    setDeleting(null);
    refresh();
  }

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[20px] font-semibold text-foreground">Cardápio</h1>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="flex min-h-[40px] items-center gap-1.5 rounded-btn bg-brand px-3.5 text-[12.5px] font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Nova categoria
        </button>
      </div>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        Arraste pelo ícone para mudar a ordem que o cliente vê no link da loja.
      </p>

      {isPending ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
        </div>
      ) : categories.length === 0 ? (
        <div className="mt-5 rounded-card border border-dashed border-border px-4 py-10 text-center">
          <p className="text-[13.5px] font-medium text-foreground">Seu cardápio ainda não tem categorias.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Crie a primeira categoria, como Burgers ou Bebidas, para começar a cadastrar produtos.
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="categories">
            {(provided) => (
              <ul {...provided.droppableProps} ref={provided.innerRef} className="mt-4 space-y-2">
                {categories.map((category, index) => {
                  const count =
                    products.filter((product) => product.category_id === category.id).length +
                    combos.filter((combo) => combo.category_id === category.id).length;
                  return (
                    <Draggable key={category.id} draggableId={category.id} index={index}>
                      {(drag) => (
                        <li
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className="flex items-center gap-2 rounded-card border border-border bg-card px-2.5 py-2.5"
                        >
                          <span
                            {...drag.dragHandleProps}
                            aria-label="Reordenar categoria"
                            className="grid h-11 w-8 place-items-center text-muted-foreground"
                          >
                            <GripVertical className="h-4 w-4" aria-hidden="true" />
                          </span>

                          <Link
                            to="/cardapio/$categoryId"
                            params={{ categoryId: category.id }}
                            className="min-w-0 flex-1"
                          >
                            <p className={cn("truncate text-[14px] font-semibold", category.active === false ? "text-muted-foreground" : "text-foreground")}>
                              {category.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {count} {count === 1 ? "item" : "itens"}
                              {category.active === false ? " · fora do cardápio" : ""}
                            </p>
                          </Link>

                          <button
                            type="button"
                            role="switch"
                            aria-checked={category.active !== false}
                            aria-label={`Ativar ${category.name}`}
                            onClick={() => toggleActive(category)}
                            className={cn(
                              "relative h-[24px] w-[42px] shrink-0 rounded-full transition-colors",
                              category.active !== false ? "bg-success" : "bg-border"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all",
                                category.active !== false ? "left-[21px]" : "left-[3px]"
                              )}
                            />
                          </button>

                          <button
                            type="button"
                            aria-label={`Editar ${category.name}`}
                            onClick={() => {
                              setEditing(category);
                              setDialogOpen(true);
                            }}
                            className="grid h-9 w-8 place-items-center rounded-btn text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Excluir ${category.name}`}
                            onClick={() => {
                              setDeleting(category);
                              setMoveTo("");
                            }}
                            className="grid h-9 w-8 place-items-center rounded-btn text-muted-foreground hover:text-brand"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <Link
                            to="/cardapio/$categoryId"
                            params={{ categoryId: category.id }}
                            aria-label="Abrir produtos"
                            className="grid h-9 w-7 place-items-center text-muted-foreground"
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </li>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        establishmentId={establishmentId}
        category={editing}
        nextSortOrder={categories.length + 1}
        onSaved={refresh}
      />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-[420px] rounded-card">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Excluir “{deleting?.name}”</DialogTitle>
          </DialogHeader>

          {deletingProducts.length + deletingCombos.length === 0 ? (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">Esta categoria está vazia. Pode excluir sem perder nada.</p>
              <button
                type="button"
                onClick={deleteEmpty}
                disabled={busy}
                className="min-h-[46px] w-full rounded-btn bg-brand text-[13.5px] font-semibold text-white disabled:opacity-50"
              >
                Excluir categoria
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">
                Esta categoria tem {deletingProducts.length + deletingCombos.length}{" "}
                {deletingProducts.length + deletingCombos.length === 1 ? "item" : "itens"}. Nada é apagado em silêncio:
                mova os itens para outra categoria ou apenas inative esta.
              </p>
              <select
                value={moveTo}
                onChange={(event) => setMoveTo(event.target.value)}
                className="min-h-[46px] w-full rounded-btn border border-input px-3 text-[13px]"
              >
                <option value="">Mover itens para…</option>
                {categories
                  .filter((category) => category.id !== deleting?.id)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={moveAndDelete}
                disabled={!moveTo || busy}
                className="min-h-[46px] w-full rounded-btn bg-brand text-[13.5px] font-semibold text-white disabled:opacity-50"
              >
                Mover e excluir categoria
              </button>
              <button
                type="button"
                onClick={inactivateAndClose}
                disabled={busy}
                className="min-h-[46px] w-full rounded-btn border border-border text-[13.5px] font-medium text-foreground disabled:opacity-50"
              >
                Apenas inativar categoria
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}