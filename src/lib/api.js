import { supabase } from "./supabase";

function client() {
  if (!supabase) throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY.");
  return supabase;
}
async function result(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}
async function updateOrderStatus(id, status) {
  const { data, error } = await client().rpc("set_order_status", {
    p_order_id: id,
    p_status: status,
  });
  if (error?.code === "PGRST202") {
    throw new Error("Order status changes need the latest Supabase database migration. Ask your project administrator to apply it.");
  }
  if (error) throw error;
  return data;
}

export const api = {
  products: {
    list: () => result(client().from("products").select("*").order("created_at", { ascending: false })),
    create: (values) => result(client().from("products").insert(values).select().single()),
    update: (id, values) => result(client().from("products").update(values).eq("id", id).select().single()),
    remove: (id) => result(client().from("products").delete().eq("id", id)),
  },
  customers: {
    list: () => result(client().from("customers").select("*").order("created_at", { ascending: false })),
    create: (values) => result(client().from("customers").insert(values).select().single()),
    update: (id, values) => result(client().from("customers").update(values).eq("id", id).select().single()),
    remove: (id) => result(client().from("customers").delete().eq("id", id)),
  },
  orders: {
    list: () => result(client().from("orders").select("*, customer:customers!orders_customer_id_fkey(id, name, email), order_items:order_items!order_items_order_owner(id, product_id, product_name, quantity, unit_price)").order("created_at", { ascending: false })),
    create: (values) => result(client().rpc("create_order", {
      p_customer_id: values.customer_id || null,
      p_status: values.status || "Pending",
      p_items: values.items,
    })),
    update: (id, values) => result(client().from("orders").update({
      customer_id: values.customer_id || null,
      status: values.status,
    }).eq("id", id).select().single()),
    updateStatus: updateOrderStatus,
    remove: (id) => result(client().from("orders").delete().eq("id", id)),
  },
};

export async function loadBusinessData() {
  const [products, customers, orders] = await Promise.all([
    api.products.list(), api.customers.list(), api.orders.list(),
  ]);
  return { products, customers, orders };
}
