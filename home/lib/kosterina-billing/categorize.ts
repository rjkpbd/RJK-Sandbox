import { createAdminClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/kosterina-billing/db";

export async function deriveCategoriesForPeriod(periodId: number) {
  const admin = createAdminClient();

  const rules = await fetchAll<{ tag: string; category: string; priority: number }>(
    (from, to) => admin
      .from("sb_kos_category_rules")
      .select("tag, category, priority")
      .order("priority", { ascending: true })
      .range(from, to)
  );

  if (rules.length === 0) return;

  const ruleMap = new Map<string, { category: string; priority: number }>();
  for (const rule of rules) {
    ruleMap.set(rule.tag.trim().toLowerCase(), { category: rule.category, priority: rule.priority });
  }

  const orders = await fetchAll<{ id: number; tags_raw: string | null }>(
    (from, to) => admin
      .from("sb_kos_shopify_orders")
      .select("id, tags_raw")
      .eq("period_id", periodId)
      .range(from, to)
  );

  if (orders.length === 0) return;

  // Group order IDs by derived category, then do one UPDATE per category
  const byCategory = new Map<string, number[]>();
  for (const order of orders) {
    const tags = (order.tags_raw ?? "")
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    let bestCategory = "DTC";
    let bestPriority = Infinity;
    for (const tag of tags) {
      const rule = ruleMap.get(tag.toLowerCase());
      if (rule && rule.priority < bestPriority) {
        bestPriority = rule.priority;
        bestCategory = rule.category;
      }
    }

    const ids = byCategory.get(bestCategory) ?? [];
    ids.push(order.id);
    byCategory.set(bestCategory, ids);
  }

  // One UPDATE per category, chunked so the IN list stays manageable
  for (const [category, ids] of byCategory) {
    for (let i = 0; i < ids.length; i += 500) {
      await admin
        .from("sb_kos_shopify_orders")
        .update({ category })
        .in("id", ids.slice(i, i + 500));
    }
  }
}

export async function inheritCategoriesForPeriod(
  periodId: number,
  table: "sb_kos_pacful_line_items" | "sb_kos_wwex_shipments"
) {
  const admin = createAdminClient();

  // Fetch every row that needs a category (no 1000-row cap)
  const rows = await fetchAll<{ id: number; order_key: string }>(
    (from, to) => admin
      .from(table)
      .select("id, order_key")
      .eq("period_id", periodId)
      .is("category_override", null)
      .not("order_key", "is", null)
      .range(from, to)
  );

  if (rows.length === 0) return;

  // Fetch all Shopify orders for the period to build the key→category map;
  // avoids a potentially huge .in() filter on the order_key column
  const shopifyOrders = await fetchAll<{ order_key: string; category: string | null }>(
    (from, to) => admin
      .from("sb_kos_shopify_orders")
      .select("order_key, category")
      .eq("period_id", periodId)
      .range(from, to)
  );

  const shopifyMap = new Map<string, string>();
  for (const o of shopifyOrders) {
    if (o.category) shopifyMap.set(o.order_key, o.category);
  }

  // Group row IDs by category, then one UPDATE per category
  const byCategory = new Map<string, number[]>();
  for (const row of rows) {
    const category = shopifyMap.get(row.order_key);
    if (!category) continue;
    const ids = byCategory.get(category) ?? [];
    ids.push(row.id);
    byCategory.set(category, ids);
  }

  if (byCategory.size === 0) return;

  for (const [category_override, ids] of byCategory) {
    for (let i = 0; i < ids.length; i += 500) {
      await admin
        .from(table)
        .update({ category_override })
        .in("id", ids.slice(i, i + 500));
    }
  }
}
