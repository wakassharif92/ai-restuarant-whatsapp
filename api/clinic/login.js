// api/clinic/login.js
// Clinic admin login (separate from restaurant login)
const jwt = require("jsonwebtoken");
const { getSupabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) {
    return res.status(500).json({ error: "Database connection failed" });
  }

  try {
    const { data: adminRow, error: queryError } = await supabase
      .from("clinic_admin_users")
      .select("id, username, password_plain, is_super")
      .eq("username", username)
      .single();

    if (queryError || !adminRow) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Plain password comparison
    if (adminRow.password_plain !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token (7 day expiry)
    const token = jwt.sign(
      {
        admin_id: adminRow.id,
        username: adminRow.username,
        is_super: adminRow.is_super,
        type: "clinic",
      },
      process.env.ADMIN_JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      ok: true,
      token,
      admin_id: adminRow.id,
      username: adminRow.username,
      type: "clinic",
    });
  } catch (err) {
    console.error("Clinic login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
