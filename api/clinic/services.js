// api/clinic/services.js
// CRUD for clinic services
const { getSupabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) {
    return res.status(500).json({ error: "Database connection failed" });
  }

  // ✅ GET: List all services
  if (req.method === "GET") {
    try {
      const { data, error: listError } = await supabase
        .from("services")
        .select(
          "id, name, duration_minutes, price, currency, is_active, created_at",
        )
        .order("created_at", { ascending: true });

      if (listError) {
        return res.status(500).json({ error: listError.message });
      }

      return res.status(200).json({
        ok: true,
        services: data || [],
      });
    } catch (err) {
      console.error("Services list error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ✅ POST: Create new service
  if (req.method === "POST") {
    const { name, duration_minutes, price, currency } = req.body;

    if (!name || !duration_minutes || !price) {
      return res.status(400).json({
        error: "Missing required fields: name, duration_minutes, price",
      });
    }

    try {
      const { data: service, error: insertError } = await supabase
        .from("services")
        .insert([
          {
            name,
            duration_minutes: parseInt(duration_minutes),
            price: parseFloat(price),
            currency: currency || "PKR",
            is_active: true,
          },
        ])
        .select("*")
        .single();

      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }

      return res.status(201).json({
        ok: true,
        service,
      });
    } catch (err) {
      console.error("Service creation error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ✅ PUT: Update service
  if (req.method === "PUT") {
    const { id, name, duration_minutes, price, is_active } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing service id" });
    }

    try {
      const updates = {};
      if (name) updates.name = name;
      if (duration_minutes)
        updates.duration_minutes = parseInt(duration_minutes);
      if (price) updates.price = parseFloat(price);
      if (is_active !== undefined) updates.is_active = is_active;

      const { data: service, error: updateError } = await supabase
        .from("services")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      return res.status(200).json({
        ok: true,
        service,
      });
    } catch (err) {
      console.error("Service update error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ✅ DELETE: Delete service
  if (req.method === "DELETE") {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing service id" });
    }

    try {
      const { error: deleteError } = await supabase
        .from("services")
        .delete()
        .eq("id", id);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      return res.status(200).json({
        ok: true,
        message: "Service deleted",
      });
    } catch (err) {
      console.error("Service delete error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
