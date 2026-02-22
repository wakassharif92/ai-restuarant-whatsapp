const { getSupabase, getTableNames } = require("../../lib/supabase");
const { requireAdmin } = require("../../lib/admin-auth");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-admin-token",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const { orders } = getTableNames();
  const requestRestaurantId =
    req.query.restaurant_id || req.query.restaurantId || null;
  const restaurantId = admin.is_super
    ? requestRestaurantId || admin.restaurant_id
    : admin.restaurant_id;

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurant_id is required" });
  }
  const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

  try {
    let query = supabase
      .from(orders)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    query = query.eq("restaurant_id", restaurantId);

    const { data, error: queryError } = await query;
    if (queryError) {
      return res.status(500).json({ error: queryError.message || queryError });
    }

    return res.json({ ok: true, orders: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
};
