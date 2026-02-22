const { getSupabase, getTableNames } = require("../../lib/supabase");
const { requireAdmin } = require("../../lib/admin-auth");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-admin-token",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const { settings } = getTableNames();
  const requestRestaurantId =
    req.query.restaurant_id || req.query.restaurantId || null;
  const restaurantId = admin.is_super
    ? requestRestaurantId || admin.restaurant_id
    : admin.restaurant_id;

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurant_id is required" });
  }

  try {
    if (req.method === "GET") {
      let query = supabase.from(settings).select("*").limit(1);
      query = query.eq("restaurant_id", restaurantId);
      const { data, error: queryError } = await query;
      if (queryError) {
        return res
          .status(500)
          .json({ error: queryError.message || queryError });
      }
      return res.json({ ok: true, settings: data?.[0] || null });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const payload = { ...(req.body || {}), restaurant_id: restaurantId };

      const { data, error: upsertError } = await supabase
        .from(settings)
        .upsert(payload, { onConflict: "restaurant_id" })
        .select("*")
        .single();

      if (upsertError) {
        return res
          .status(500)
          .json({ error: upsertError.message || upsertError });
      }

      return res.json({ ok: true, settings: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
};
