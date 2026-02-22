const { getSupabase } = require("../../lib/supabase");
const { verifyJwt } = require("../../lib/admin-auth");

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

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  const verified = verifyJwt(token);
  if (!verified.ok) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const payload = verified.payload || {};
  let restaurant = null;

  if (payload.restaurant_id) {
    const { data: restaurantRow } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", payload.restaurant_id)
      .single();
    restaurant = restaurantRow || null;
  }

  return res.json({
    ok: true,
    user: {
      id: payload.user_id,
      username: payload.username,
      is_super: !!payload.is_super,
    },
    restaurant,
  });
};
