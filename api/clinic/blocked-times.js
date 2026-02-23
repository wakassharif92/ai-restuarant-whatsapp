// api/clinic/blocked-times.js
// CRUD for blocked times (breaks, holidays, lunch)
const { getSupabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) {
    return res.status(500).json({ error: "Database connection failed" });
  }

  // ✅ GET: List all blocked times
  if (req.method === "GET") {
    try {
      let query = supabase
        .from("blocked_times")
        .select("id, start_at, end_at, reason, created_at")
        .order("start_at", { ascending: false });

      // Optional: filter by date range
      if (req.query.after && req.query.before) {
        query = query
          .gte("start_at", req.query.after)
          .lte("end_at", req.query.before);
      }

      const { data, error: listError } = await query;

      if (listError) {
        return res.status(500).json({ error: listError.message });
      }

      return res.status(200).json({
        ok: true,
        blocked_times: data || [],
      });
    } catch (err) {
      console.error("Blocked times list error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ✅ POST: Create new blocked time
  if (req.method === "POST") {
    const { start_at, end_at, reason } = req.body;

    if (!start_at || !end_at) {
      return res.status(400).json({
        error: "Missing required fields: start_at, end_at",
      });
    }

    try {
      const { data: blockedTime, error: insertError } = await supabase
        .from("blocked_times")
        .insert([
          {
            start_at,
            end_at,
            reason: reason || null,
          },
        ])
        .select("*")
        .single();

      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }

      return res.status(201).json({
        ok: true,
        blocked_time: blockedTime,
      });
    } catch (err) {
      console.error("Blocked time creation error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ✅ DELETE: Delete blocked time
  if (req.method === "DELETE") {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing blocked time id" });
    }

    try {
      const { error: deleteError } = await supabase
        .from("blocked_times")
        .delete()
        .eq("id", id);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      return res.status(200).json({
        ok: true,
        message: "Blocked time deleted",
      });
    } catch (err) {
      console.error("Blocked time delete error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
