const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getSupabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "ADMIN_JWT_SECRET is not set" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const { data: user, error: userError } = await supabase
      .from("admin_users")
      .select("id, username, password_plain, restaurant_name, is_super")
      .eq("username", username)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    if (!user.password_plain || password !== user.password_plain) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Get restaurant by name
    let restaurant = null;
    if (user.restaurant_name) {
      const { data: restaurantRow } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("name", user.restaurant_name)
        .single();
      restaurant = restaurantRow || null;
    }

    const token = jwt.sign(
      {
        user_id: user.id,
        username: user.username,
        restaurant_id: restaurant?.id || null,
        is_super: !!user.is_super,
      },
      secret,
      { expiresIn: "7d" },
    );

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        is_super: !!user.is_super,
      },
      restaurant,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
};
