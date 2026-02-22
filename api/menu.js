const { getSupabase, getTableNames } = require("../lib/supabase");

async function fetchMenuItems(supabase, table, restaurantId) {
  let query = supabase.from(table).select("*");

  if (restaurantId) {
    query = query.eq("restaurant_id", restaurantId);
  }

  let { data, error } = await query.eq("available_today", true);

  if (error) {
    ({ data, error } = await query.eq("is_available", true));
  }

  if (error) {
    ({ data, error } = await query);
  }

  return { data: data || [], error };
}

async function fetchSettings(supabase, table, restaurantId) {
  let query = supabase.from(table).select("*").limit(1);

  if (restaurantId) {
    query = query.eq("restaurant_id", restaurantId);
  }

  const { data, error } = await query;
  return { data: data?.[0] || null, error };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) {
    return res.status(500).json({ error });
  }

  const { menu, settings } = getTableNames();
  const restaurantId =
    req.query.restaurant_id || req.query.restaurantId || null;

  const [menuResult, settingsResult] = await Promise.all([
    fetchMenuItems(supabase, menu, restaurantId),
    fetchSettings(supabase, settings, restaurantId),
  ]);

  if (menuResult.error) {
    return res.status(500).json({
      error: "Failed to load menu",
      details: menuResult.error?.message || menuResult.error,
    });
  }

  if (settingsResult.error) {
    return res.status(500).json({
      error: "Failed to load settings",
      details: settingsResult.error?.message || settingsResult.error,
    });
  }

  const rules = {
    delivery_enabled: settingsResult.data?.delivery_enabled,
    pickup_enabled: settingsResult.data?.pickup_enabled,
    delivery_time_minutes: settingsResult.data?.delivery_time_minutes,
    payment_methods: settingsResult.data?.payment_methods,
    notes_allowed: settingsResult.data?.notes_allowed,
  };

  return res.json({
    ok: true,
    menu: menuResult.data,
    rules,
    settings: settingsResult.data,
  });
};
