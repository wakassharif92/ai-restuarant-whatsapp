// api/clinic/vapi-webhook.js
// Vapi webhook for clinic appointment booking
// Functions: check_availability, book_appointment
const { getSupabase } = require("../../lib/supabase");
const axios = require("axios");

async function checkAvailability(date, serviceId) {
  const { ok, supabase, error } = getSupabase();
  if (!ok) return { ok: false, error };

  try {
    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return { ok: false, error: "Service not found" };
    }

    // Get clinic settings
    const { data: settings, error: settingsError } = await supabase
      .from("clinic_settings")
      .select("slot_step_minutes, buffer_minutes, working_hours")
      .single();

    if (settingsError || !settings) {
      return { ok: false, error: "Clinic settings not found" };
    }

    // Get blocked times for this date
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const { data: blockedTimes, error: blockedError } = await supabase
      .from("blocked_times")
      .select("start_at, end_at")
      .gte("start_at", dateStart.toISOString())
      .lte("end_at", dateEnd.toISOString());

    if (blockedError) {
      return { ok: false, error: blockedError.message };
    }

    // Get existing appointments for this date
    const { data: appointments, error: appointmentError } = await supabase
      .from("appointments")
      .select("start_at, end_at")
      .eq("status", "booked")
      .gte("start_at", dateStart.toISOString())
      .lte("start_at", dateEnd.toISOString());

    if (appointmentError) {
      return { ok: false, error: appointmentError.message };
    }

    // Generate available slots
    const slots = generateAvailableSlots(
      date,
      service.duration_minutes,
      settings,
      blockedTimes || [],
      appointments || [],
    );

    return {
      ok: true,
      service_name: service.name,
      available_slots: slots,
      slot_count: slots.length,
    };
  } catch (err) {
    console.error("Check availability error:", err);
    return { ok: false, error: err.message };
  }
}

async function bookAppointment(
  patientName,
  patientPhone,
  serviceId,
  slotStartAt,
  notes = null,
) {
  const { ok, supabase, error } = getSupabase();
  if (!ok) return { ok: false, error };

  try {
    // Get service details for duration
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return { ok: false, error: "Service not found" };
    }

    // Calculate end time
    const startDate = new Date(slotStartAt);
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + service.duration_minutes);

    // Check for conflicts one more time (double-check)
    const { data: conflicts, error: conflictError } = await supabase
      .from("appointments")
      .select("id")
      .eq("status", "booked")
      .gte("start_at", slotStartAt)
      .lt("start_at", endDate.toISOString());

    if (conflictError) {
      return { ok: false, error: conflictError.message };
    }

    if (conflicts && conflicts.length > 0) {
      return { ok: false, error: "Time slot no longer available" };
    }

    // Create appointment
    const { data: appointment, error: insertError } = await supabase
      .from("appointments")
      .insert([
        {
          patient_name: patientName,
          patient_phone: patientPhone,
          service_id: serviceId,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          notes: notes || null,
          status: "booked",
          source: "vapi",
        },
      ])
      .select("*")
      .single();

    if (insertError) {
      return { ok: false, error: insertError.message };
    }

    // Send WhatsApp confirmation
    try {
      await sendAppointmentConfirmation(appointment, service, patientPhone);
    } catch (waErr) {
      console.error("WhatsApp send failed:", waErr.message);
      // Don't fail the appointment if WhatsApp fails
    }

    return {
      ok: true,
      appointment_id: appointment.id,
      patient_name: appointment.patient_name,
      patient_phone: appointment.patient_phone,
      service: service.name,
      scheduled_at: appointment.start_at,
      message: `Appointment confirmed for ${service.name}`,
    };
  } catch (err) {
    console.error("Book appointment error:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Vapi webhook handler
 * Receives toolCalls and returns results
 */
async function handleVapiWebhook(req, res) {
  try {
    const { message } = req.body;

    if (!message || !message.toolCalls || !Array.isArray(message.toolCalls)) {
      return res.status(400).json({ error: "Invalid toolCalls format" });
    }

    const results = [];

    for (const toolCall of message.toolCalls) {
      const { id: toolCallId, function: func } = toolCall;
      const { name: funcName, arguments: args } = func;

      let result;

      if (funcName === "check_availability") {
        result = await checkAvailability(args.date, args.service_id);
      } else if (funcName === "book_appointment") {
        result = await bookAppointment(
          args.patient_name,
          args.patient_phone,
          args.service_id,
          args.slot_start_at,
          args.notes || null,
        );
      } else {
        result = { ok: false, error: `Unknown function: ${funcName}` };
      }

      results.push({
        toolCallId,
        result: JSON.stringify(result),
      });
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error("Vapi webhook error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

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

  // Optional: token validation
  const requiredToken = process.env.VAPI_WEBHOOK_TOKEN;
  if (requiredToken) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${requiredToken}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  return handleVapiWebhook(req, res);
};

// ========================================
// HELPER FUNCTIONS
// ========================================

function generateAvailableSlots(
  date,
  durationMinutes,
  settings,
  blockedTimes,
  appointments,
) {
  const slots = [];
  const dayOfWeek = new Date(date)
    .toLocaleDateString("en-US", { weekday: "short" })
    .toLowerCase();

  // Get working hours for this day
  const workingHours = settings.working_hours[dayOfWeek];
  if (!workingHours || workingHours === "closed") {
    return slots;
  }

  const [startTime, endTime] = workingHours.split("-");
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const slotStep = settings.slot_step_minutes || 15;
  const buffer = settings.buffer_minutes || 0;

  // Generate all possible slots
  const dateObj = new Date(date);
  let currentTime = new Date(dateObj);
  currentTime.setHours(startHour, startMin, 0, 0);

  const workEnd = new Date(dateObj);
  workEnd.setHours(endHour, endMin, 0, 0);

  while (currentTime.getTime() + durationMinutes * 60000 <= workEnd.getTime()) {
    const slotStart = new Date(currentTime);
    const slotEnd = new Date(currentTime);
    slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

    // Check if slot is blocked
    const isBlocked = blockedTimes.some(
      (block) =>
        new Date(block.start_at).getTime() < slotEnd.getTime() &&
        new Date(block.end_at).getTime() > slotStart.getTime(),
    );

    // Check if slot conflicts with existing appointments
    const hasConflict = appointments.some(
      (apt) =>
        new Date(apt.start_at).getTime() < slotEnd.getTime() &&
        new Date(apt.end_at).getTime() > slotStart.getTime(),
    );

    if (!isBlocked && !hasConflict) {
      slots.push(slotStart.toISOString());
    }

    currentTime.setMinutes(currentTime.getMinutes() + slotStep);
  }

  return slots;
}

async function sendAppointmentConfirmation(appointment, service, phoneNumber) {
  const msg = `
✅ Appointment Confirmed!

Service: ${service.name}
Date/Time: ${new Date(appointment.start_at).toLocaleString()}
Duration: ${service.duration_minutes} minutes
Price: ${service.price} ${service.currency}

Our clinic will contact you if there are any changes.
  `.trim();

  const url = `https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to: phoneNumber,
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
}
