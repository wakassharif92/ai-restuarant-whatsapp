// api/clinic/appointments.js
// CRUD for clinic appointments
const { getSupabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) {
    return res.status(500).json({ error: "Database connection failed" });
  }

  // ✅ GET: List all appointments (can filter by status, date range)
  if (req.method === "GET") {
    try {
      let query = supabase
        .from("appointments")
        .select(
          "id, patient_name, patient_phone, service_id, start_at, end_at, status, notes, source, created_at",
        )
        .order("start_at", { ascending: true });

      // Optional filters
      if (req.query.status) {
        query = query.eq("status", req.query.status);
      }

      if (req.query.after && req.query.before) {
        query = query
          .gte("start_at", req.query.after)
          .lte("start_at", req.query.before);
      }

      const { data, error: listError } = await query;

      if (listError) {
        return res.status(500).json({ error: listError.message });
      }

      return res.status(200).json({
        ok: true,
        appointments: data || [],
      });
    } catch (err) {
      console.error("Clinic appointments list error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ✅ POST: Create new appointment (booking)
  if (req.method === "POST") {
    const { patient_name, patient_phone, service_id, start_at, end_at, notes } =
      req.body;

    if (
      !patient_name ||
      !patient_phone ||
      !service_id ||
      !start_at ||
      !end_at
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: patient_name, patient_phone, service_id, start_at, end_at",
      });
    }

    try {
      // Check for double bookings (only active appointments)
      const { data: conflicts, error: conflictError } = await supabase
        .from("appointments")
        .select("id")
        .eq("status", "booked")
        .gte("start_at", start_at)
        .lt("start_at", end_at);

      if (conflictError) {
        return res.status(500).json({ error: conflictError.message });
      }

      if (conflicts && conflicts.length > 0) {
        return res.status(409).json({
          error: "Time slot already booked",
          conflict_count: conflicts.length,
        });
      }

      // Insert appointment
      const { data: appointment, error: insertError } = await supabase
        .from("appointments")
        .insert([
          {
            patient_name,
            patient_phone,
            service_id,
            start_at,
            end_at,
            notes: notes || null,
            status: "booked",
            source: req.query.source || "api",
          },
        ])
        .select("*")
        .single();

      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }

      // Send WhatsApp notification if from Vapi
      if (req.query.source === "vapi") {
        await sendAppointmentWhatsApp(appointment, supabase);
      }

      return res.status(201).json({
        ok: true,
        appointment,
      });
    } catch (err) {
      console.error("Clinic appointment creation error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ✅ PATCH: Update appointment status
  if (req.method === "PATCH") {
    const { id, status } = req.body;

    if (!id || !status) {
      return res.status(400).json({
        error: "Missing required fields: id, status",
      });
    }

    const validStatuses = ["booked", "cancelled", "completed", "no_show"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    try {
      const { data: appointment, error: updateError } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      return res.status(200).json({
        ok: true,
        appointment,
      });
    } catch (err) {
      console.error("Clinic appointment update error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};

// Helper: Send WhatsApp notification for appointment
async function sendAppointmentWhatsApp(appointment, supabase) {
  try {
    const axios = require("axios");

    // Get service name
    const { data: service } = await supabase
      .from("services")
      .select("name")
      .eq("id", appointment.service_id)
      .single();

    const serviceName = service?.name || "Appointment";

    const msg = `
🟢 New Appointment

Name: ${appointment.patient_name}
Phone: ${appointment.patient_phone}
Service: ${serviceName}
Date/Time: ${new Date(appointment.start_at).toLocaleString()}
Notes: ${appointment.notes || "None"}
    `.trim();

    const url = `https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: process.env.CLINIC_WA_TO,
        type: "text",
        text: { body: msg },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("Clinic appointment WhatsApp sent successfully");
  } catch (err) {
    console.error("Failed to send clinic appointment WhatsApp:", err.message);
    // Don't fail the request if WhatsApp fails
  }
}
