import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import Brand from "@/components/Brand";
import StoreHeader from "@/components/store/StoreHeader";
import ProductCard from "@/components/store/ProductCard";
import ProductModal from "@/components/store/ProductModal";
import CartSheet from "@/components/store/CartSheet";
import CheckoutView from "@/components/store/CheckoutView";
import ConfirmationView from "@/components/store/ConfirmationView";
import useCart from "@/hooks/useCart";
import { getStorefront } from "@/lib/storefront-fns";
import { brl } from "@/lib/pedix";

export const Route = createFileRoute("/loja/$slug")({
  loader: ({ params }) => getStorefront({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.establishment?.name ?? "Cardápio"} · Pedix` },
      {
        name: "description",
        content:
          loaderData?.establishment?.description ??
          "Cardápio online com pedidos por entrega e retirada em Trairi, CE.",
      },
    ],
  }),
  component: StorePage,
});

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#EFEAE3]">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-background shadow-[0_0_60px_-20px_rgba(31,26,23,0.25)]">
        {children}
      </div>
    </div>
  );
}

function StorePage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const router = useRouter();
  const cart = useCart(slug);
  const [step, setStep] = useState("menu");
  const [selection, setSelection] = useState(null);
  const [productOpen, setProductOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [banner, setBanner] = useState("");
  const [created, setCreated] = useState(null);

  if (data.status === "not_found") {
    return (
      <Shell>
        <div className="px-6 py-16 text-center">
          <Brand size="md" className="justify-center" />
          <p className="mt-6 text-[16px] font-semibold text-foreground">Loja não encontrada</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Confira o link enviado pelo estabelecimento.</p>
          <Link to="/" className="mt-6 inline-block text-[13px] font-semibold text-brand">
            Ir para a entrada do Pedix
          </Link>
        </div>
      </Shell>
    );
  }

  const { establishment, storefront, hours } = data;
  const canOrder = storefront.can_order;

  if (!storefront.menu_visible) {
    return (
      <Shell>
        <div className="px-6 py-16 text-center">
          <Brand size="md" className="justify-center" />
          <p className="mt-8 text-[18px] font-semibold text-foreground">{establishment.name}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Esta loja não está recebendo pedidos online
          </p>
        </div>
      </Shell>
    );
  }

  const catalog = {
    products: data.products,
    combos: data.combos,
    option_groups: data.option_groups,
    options: data.options,
    combo_items: data.combo_items,
    zones: data.zones,
    payments: data.payments,
    establishment_name: establishment.name,
    growth: data.growth === true,
    loyalty_rule: data.loyalty_rule ?? null,
  };

  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.items.reduce((sum, item) => {
    if (item.kind === "combo") {
      const combo = data.combos.find((entry) => entry.id === item.ref_id);
      return sum + (combo?.price_cents ?? 0) * item.quantity;
    }
    const product = data.products.find((entry) => entry.id === item.ref_id);
    const deltas = (item.option_ids ?? []).reduce((acc, id) => {
      const option = data.options.find((entry) => entry.id === id);
      return acc + (option?.price_delta_cents ?? 0);
    }, 0);
    const base = product?.promo_price_cents ?? product?.price_cents ?? 0;
    return sum + (base + deltas) * item.quantity;
  }, 0);

  if (step === "confirmation" && created) {
    return (
      <Shell>
        <ConfirmationView
          result={created}
          onNewOrder={() => {
            setCreated(null);
            setStep("menu");
            setNotes("");
          }}
        />
      </Shell>
    );
  }

  if (step === "checkout") {
    return (
      <Shell>
        <CheckoutView
          catalog={catalog}
          establishment={establishment}
          items={cart.items}
          notes={notes}
          totals={{ count, subtotal }}
          onBack={() => setStep("menu")}
          onOrderCreated={(result) => {
            cart.clear();
            setCreated(result);
            setStep("confirmation");
            window.scrollTo({ top: 0 });
          }}
          onMismatch={async (result) => {
            // Recarrega o catálogo para a sacola mostrar os preços atuais da loja.
            await router.invalidate();
            cart.replace(
              result.cart.map((line) => ({
                key: line.key,
                kind: line.kind,
                ref_id: line.ref_id,
                quantity: line.quantity,
                option_ids: line.option_ids,
                notes: line.notes,
              }))
            );
            setBanner(result.message);
            setStep("menu");
            setCartOpen(true);
          }}
        />
      </Shell>
    );
  }

  const hasProducts = data.products.length > 0 || data.combos.length > 0;

  return (
    <Shell>
      <div className={count > 0 ? "pb-28" : "pb-10"}>
        <StoreHeader establishment={establishment} storefront={storefront} hours={hours} />

        {hasProducts ? (
          <>
            <nav className="sticky top-0 z-20 border-y border-border bg-background/95 backdrop-blur">
              <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
                {data.categories.map((category) => (
                  <a
                    key={category.id}
                    href={`#cat-${category.id}`}
                    className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-[12.5px] font-medium text-foreground"
                  >
                    {category.name}
                  </a>
                ))}
              </div>
            </nav>

            <main className="space-y-7 px-5 pt-5">
              {data.categories.map((category) => {
                const products = data.products.filter((product) => product.category_id === category.id);
                const combos = data.combos.filter((combo) => combo.category_id === category.id);
                if (products.length === 0 && combos.length === 0) return null;
                return (
                  <section key={category.id} id={`cat-${category.id}`} className="scroll-mt-16">
                    <h2 className="text-[15px] font-semibold text-foreground">{category.name}</h2>
                    <div className="mt-2.5 space-y-2.5">
                      {combos.map((combo) => (
                        <ProductCard
                          key={combo.id}
                          item={combo}
                          isCombo
                          onSelect={(item, isCombo) => {
                            setSelection({ item, isCombo });
                            setProductOpen(true);
                          }}
                        />
                      ))}
                      {products.map((product) => (
                        <ProductCard
                          key={product.id}
                          item={product}
                          onSelect={(item, isCombo) => {
                            setSelection({ item, isCombo });
                            setProductOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </main>
          </>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] font-medium text-foreground">Esta loja ainda não publicou o cardápio.</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Volte em breve ou fale com a loja no WhatsApp.</p>
          </div>
        )}

        <footer className="mt-8 border-t border-border px-5 py-6 text-center">
          <p className="text-[11.5px] text-muted-foreground">
            {establishment.name} · {establishment.street} · {establishment.city}/{establishment.state}
          </p>
          <Link to="/" className="mt-2 inline-block text-[11.5px] font-medium text-muted-foreground">
            feito com Pedix
          </Link>
        </footer>
      </div>

      {count > 0 && canOrder && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] p-3">
          <button
            type="button"
            onClick={() => {
              setBanner("");
              setCartOpen(true);
            }}
            className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-btn bg-brand px-5 text-[14.5px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(208,18,26,0.7)]"
          >
            <span>
              Ver sacola · {count} {count === 1 ? "item" : "itens"}
            </span>
            <span>{brl(subtotal)}</span>
          </button>
        </div>
      )}

      <ProductModal
        open={productOpen}
        onOpenChange={setProductOpen}
        selection={selection}
        catalog={catalog}
        onAdd={(item) => {
          cart.add(item);
          setProductOpen(false);
        }}
      />

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        catalog={catalog}
        items={cart.items}
        banner={banner}
        canOrder={canOrder}
        onQuantity={cart.setQuantity}
        onRemove={cart.remove}
        notes={notes}
        onNotes={setNotes}
        onContinue={() => {
          setCartOpen(false);
          setBanner("");
          setStep("checkout");
        }}
      />
    </Shell>
  );
}