import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { DEMO_PRICING, MODULES, RESERVED_SLUGS, RESERVED_SLUG_MESSAGE } from "@/lib/pedix";
import { all, nowIso, slugify, trairiDayStartIso } from "@/lib/pedix-server";

function assertAdmin(user) {
  if (user?.role !== "admin") {
    const error = new Error("Acesso restrito ao Admin Pedix");
    error.status = 403;
    throw error;
  }
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    assertAdmin(context.user);
    const db = context.getBase44().asServiceRole;

    const [establishments, subscriptions, entitlements, todayOrders, logs] = await Promise.all([
      all(db.entities.Establishment.list("-created_date")),
      all(db.entities.Subscription.list()),
      all(db.entities.Entitlement.list()),
      all(db.entities.Order.filter({ created_date: { $gte: trairiDayStartIso() } })),
      all(db.entities.NotificationLog.filter({ status: "FAILED" })),
    ]);

    const subByStore = new Map(subscriptions.map((s) => [s.establishment_id, s]));
    const modulesByStore = new Map();
    for (const entitlement of entitlements) {
      if (!entitlement.enabled) continue;
      const list = modulesByStore.get(entitlement.establishment_id) ?? [];
      list.push(entitlement.module);
      modulesByStore.set(entitlement.establishment_id, list);
    }

    const stores = establishments.map((store) => {
      const subscription = subByStore.get(store.id) ?? null;
      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        is_open: store.is_open,
        subscription_status: subscription?.status ?? null,
        monthly_fee_cents: subscription?.monthly_fee_cents ?? 0,
        modules: modulesByStore.get(store.id) ?? [],
        orders_today: todayOrders.filter((order) => order.establishment_id === store.id).length,
      };
    });

    const paying = subscriptions.filter((s) => s.status === "ACTIVE" || s.status === "TRIAL");
    const activeStores = stores.filter((s) => s.subscription_status === "ACTIVE" || s.subscription_status === "TRIAL");

    return {
      status: "ok",
      user: { full_name: context.user.full_name ?? "", email: context.user.email ?? "" },
      stats: {
        active_stores: activeStores.length,
        total_stores: stores.length,
        mrr_cents: paying.reduce((sum, s) => sum + (s.monthly_fee_cents ?? 0), 0),
        orders_today: todayOrders.length,
        whatsapp_failures: logs.length,
      },
      stores,
    };
  });

export const adminStoreDetail = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(z.object({ establishment_id: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    assertAdmin(context.user);
    const db = context.getBase44().asServiceRole;

    const store = await db.entities.Establishment.get(data.establishment_id).catch(() => null);
    if (!store) return { status: "not_found" };

    const [subscriptions, entitlements, todayOrders, users] = await Promise.all([
      all(db.entities.Subscription.filter({ establishment_id: store.id })),
      all(db.entities.Entitlement.filter({ establishment_id: store.id })),
      all(
        db.entities.Order.filter({
          establishment_id: store.id,
          created_date: { $gte: trairiDayStartIso() },
        })
      ),
      all(db.entities.User.filter({ email: store.owner_email })),
    ]);

    return {
      status: "ok",
      establishment: store,
      subscription: subscriptions[0] ?? null,
      entitlements,
      orders_today: todayOrders.length,
      owner: users[0] ? { id: users[0].id, full_name: users[0].full_name ?? "", email: users[0].email } : null,
    };
  });

export const createStore = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      name: z.string().trim().min(2).max(80),
      slug: z.string().trim().min(2).max(60),
      whatsapp: z.string().trim().min(8).max(30),
      owner_email: z.string().trim().email().max(120),
    })
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.user);
    const db = context.getBase44().asServiceRole;

    const slug = slugify(data.slug);
    if (!slug) return { status: "invalid", message: "Informe um endereço válido, com letras e números." };
    if (RESERVED_SLUGS.includes(slug)) return { status: "invalid", message: RESERVED_SLUG_MESSAGE };

    const existing = await all(db.entities.Establishment.filter({ slug }));
    if (existing[0]) return { status: "invalid", message: "Já existe uma loja com esse endereço." };

    const timestamp = nowIso();
    const store = await db.entities.Establishment.create({
      name: data.name,
      slug,
      description: "",
      whatsapp: data.whatsapp,
      street: "",
      neighborhood: "",
      city: "Trairi",
      state: "CE",
      logo_url: "",
      cover_url: "",
      is_open: true,
      delivery_enabled: true,
      pickup_enabled: true,
      min_order_cents: 0,
      eta_delivery_min: 40,
      eta_pickup_min: 20,
      owner_email: data.owner_email,
      order_number_start: 1,
      whatsapp_fail_simulated: false,
      created_at: timestamp,
    });

    await db.entities.Subscription.create({
      establishment_id: store.id,
      status: "TRIAL",
      monthly_fee_cents: DEMO_PRICING.monthly_fee_cents,
      implementation_fee_cents: DEMO_PRICING.implementation_fee_cents,
      implementation_paid: false,
      started_at: timestamp,
    });

    await db.entities.Entitlement.bulkCreate(
      MODULES.map((module) => ({
        establishment_id: store.id,
        module: module.code,
        enabled: module.code === "BASE" || module.code === "DELIVERY",
      }))
    );

    await db.entities.OpeningHour.bulkCreate(
      [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        establishment_id: store.id,
        weekday,
        opens_at: "18:00",
        closes_at: "23:00",
        closed: false,
      }))
    );

    await db.entities.PaymentMethod.bulkCreate([
      { establishment_id: store.id, code: "PIX", label: "Pix", active: true, asks_change: false },
      { establishment_id: store.id, code: "CASH", label: "Dinheiro", active: true, asks_change: true },
      { establishment_id: store.id, code: "CARD_ON_DELIVERY", label: "Cartão na entrega", active: true, asks_change: false },
    ]);

    let invited = true;
    try {
      await db.users.inviteUser(data.owner_email, "user");
    } catch {
      invited = false;
    }

    return { status: "ok", establishment: store, invited };
  });

export const updateStoreAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      establishment_id: z.string().min(1).max(80),
      establishment: z.object({
        name: z.string().trim().min(2).max(80),
        slug: z.string().trim().min(2).max(60),
        whatsapp: z.string().trim().max(30),
        street: z.string().max(160),
        neighborhood: z.string().max(80),
        description: z.string().max(400),
        owner_email: z.string().trim().max(120),
      }),
      subscription: z.object({
        status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED"]),
        monthly_fee_cents: z.number().int().min(0).max(10000000),
        implementation_fee_cents: z.number().int().min(0).max(10000000),
        implementation_paid: z.boolean(),
      }),
      entitlements: z.array(
        z.object({
          module: z.enum(["BASE", "DELIVERY", "MESAS", "COZINHA", "GESTAO", "GROWTH"]),
          enabled: z.boolean(),
        })
      ),
    })
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.user);
    const db = context.getBase44().asServiceRole;

    const slug = slugify(data.establishment.slug);
    if (!slug) return { status: "invalid", message: "Informe um endereço válido, com letras e números." };
    if (RESERVED_SLUGS.includes(slug)) return { status: "invalid", message: RESERVED_SLUG_MESSAGE };
    const conflicting = await all(db.entities.Establishment.filter({ slug }));
    if (conflicting.some((store) => store.id !== data.establishment_id)) {
      return { status: "invalid", message: "Já existe uma loja com esse endereço." };
    }

    const store = await db.entities.Establishment.update(data.establishment_id, {
      ...data.establishment,
      slug,
      city: "Trairi",
      state: "CE",
    });

    const subscriptions = await all(db.entities.Subscription.filter({ establishment_id: store.id }));
    const subscription = subscriptions[0]
      ? await db.entities.Subscription.update(subscriptions[0].id, data.subscription)
      : await db.entities.Subscription.create({ establishment_id: store.id, ...data.subscription, started_at: nowIso() });

    const existing = await all(db.entities.Entitlement.filter({ establishment_id: store.id }));
    for (const entry of data.entitlements) {
      const enabled = entry.module === "BASE" ? true : entry.enabled;
      const current = existing.find((item) => item.module === entry.module);
      if (current) {
        await db.entities.Entitlement.update(current.id, { enabled });
      } else {
        await db.entities.Entitlement.create({ establishment_id: store.id, module: entry.module, enabled });
      }
    }

    return { status: "ok", establishment: store, subscription };
  });