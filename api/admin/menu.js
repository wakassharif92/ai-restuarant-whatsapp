const { getSupabase, getTableNames } = require("../../lib/supabase");
const { requireAdmin } = require("../../lib/admin-auth");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
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

  const { menu } = getTableNames();
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
      let query = supabase
        .from(menu)
        .select("*")
        .order("name", { ascending: true });
      query = query.eq("restaurant_id", restaurantId);
      const { data, error: queryError } = await query;
      if (queryError) {
        return res
          .status(500)
          .json({ error: queryError.message || queryError });
      }
      return res.json({ ok: true, items: data || [] });
    }

    if (req.method === "POST") {
      const payload = { ...(req.body || {}), restaurant_id: restaurantId };
      if (!payload.name) {
        return res.status(400).json({ error: "Name is required" });
      }
      const { data, error: insertError } = await supabase
        .from(menu)
        .insert([payload])
        .select("*")
        .single();
      if (insertError) {
        return res
          .status(500)
          .json({ error: insertError.message || insertError });
      }
      return res.json({ ok: true, item: data });
    }

    if (req.method === "PUT") {
      const payload = { ...(req.body || {}), restaurant_id: restaurantId };
      if (!payload.id) {
        return res.status(400).json({ error: "id is required" });
      }
      const { id, ...updates } = payload;
      const { data, error: updateError } = await supabase
        .from(menu)
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      if (updateError) {
        return res
          .status(500)
          .json({ error: updateError.message || updateError });
      }
      return res.json({ ok: true, item: data });
    }

    if (req.method === "DELETE") {
      const id = req.body?.id || req.query.id;
      if (!id) {
        return res.status(400).json({ error: "id is required" });
      }
      const { error: deleteError } = await supabase
        .from(menu)
        .delete()
        .eq("id", id);
      if (deleteError) {
        return res
          .status(500)
          .json({ error: deleteError.message || deleteError });
      }
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
};
