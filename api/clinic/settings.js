// api/clinic/settings.js
// Clinic settings (working hours, slot duration, etc.)
const { getSupabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) {
    return res.status(500).json({ error: "Database connection failed" });
  }

  // ✅ GET: Get clinic settings (there's only one row)
  if (req.method === "GET") {
    try {
      const { data, error: getError } = await supabase
        .from("clinic_settings")
        .select(
          "id, timezone, working_hours, slot_step_minutes, buffer_minutes, created_at, updated_at",
        )
        .single();

      if (getError && getError.code !== "PGRST116") {
        // PGRST116 = no rows returned
        return res.status(500).json({ error: getError.message });
      }

      return res.status(200).json({
        ok: true,
        settings: data || null,
      });
    } catch (err) {
      console.error("Settings get error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ✅ POST: Update clinic settings (upsert)
  if (req.method === "POST") {
    const { timezone, working_hours, slot_step_minutes, buffer_minutes } =
      req.body;

    try {
      // First, try to get existing settings
      const { data: existing, error: getError } = await supabase
        .from("clinic_settings")
        .select("id")
        .single();

      let result;

      if (existing) {
        // Update existing
        result = await supabase
          .from("clinic_settings")
          .update({
            timezone: timezone || "Asia/Karachi",
            working_hours: working_hours || {},
            slot_step_minutes: slot_step_minutes || 15,
            buffer_minutes: buffer_minutes || 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*")
          .single();
      } else {
        // Insert new
        result = await supabase
          .from("clinic_settings")
          .insert([
            {
              timezone: timezone || "Asia/Karachi",
              working_hours: working_hours || {},
              slot_step_minutes: slot_step_minutes || 15,
              buffer_minutes: buffer_minutes || 0,
            },
          ])
          .select("*")
          .single();
      }

      if (result.error) {
        return res.status(500).json({ error: result.error.message });
      }

      return res.status(200).json({
        ok: true,
        settings: result.data,
      });
    } catch (err) {
      console.error("Settings update error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
