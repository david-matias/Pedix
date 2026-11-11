import { useEffect, useState } from "react";

/** Sacola do cliente, por loja, guardada na sessão do navegador. */
export default function useCart(slug) {
  const storageKey = `pedix-cart:${slug}`;
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      setItems([]);
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* sessão indisponível: a sacola segue só em memória */
    }
  }, [items, ready, storageKey]);

  function add(item) {
    setItems((prev) => [
      ...prev,
      { ...item, key: `${item.kind}-${item.ref_id}-${Date.now()}-${prev.length}` },
    ]);
  }

  function setQuantity(key, quantity) {
    setItems((prev) =>
      prev
        .map((item) => (item.key === key ? { ...item, quantity: Math.max(1, Math.min(50, quantity)) } : item))
        .filter(Boolean)
    );
  }

  function remove(key) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  function clear() {
    setItems([]);
  }

  return { items, add, setQuantity, remove, clear, ready, replace: setItems };
}