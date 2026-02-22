const bcrypt = require("bcryptjs");
const { getSupabase } = require("../../lib/supabase");
const { requireAdmin } = require("../../lib/admin-auth");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-admin-token",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;
  if (!admin.is_super) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  try {
    const { username, password, restaurant_name, restaurant_id, is_super } =
      req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    let restaurantId = restaurant_id || null;

    if (!restaurantId) {
      if (!restaurant_name) {
        return res.status(400).json({
          error:
            "restaurant_name is required when restaurant_id is not provided",
        });
      }

      const { data: restaurantRow, error: restaurantError } = await supabase
        .from("restaurants")
        .insert([{ name: restaurant_name }])
        .select("*")
        .single();

      if (restaurantError) {
        return res.status(500).json({
          error: restaurantError.message || restaurantError,
        });
      }

      restaurantId = restaurantRow.id;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error: userError } = await supabase
      .from("admin_users")
      .insert([
        {
          username,
          password_hash,
          restaurant_id: restaurantId,
          is_super: !!is_super,
        },
      ])
      .select("id, username, restaurant_id, is_super")
      .single();

    if (userError) {
      return res.status(500).json({ error: userError.message || userError });
    }

    return res.json({ ok: true, user });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
};
