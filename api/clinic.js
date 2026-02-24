const jwt = require("jsonwebtoken");
const { getSupabase, getTableNames } = require("../lib/supabase");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function normalizeQueryValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function verifyClinicToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const secret = process.env.CLINIC_JWT_SECRET || "clinic_secret";
  try {
    return jwt.verify(token, secret);
  } catch (e) {
    return null;
  }
}

async function handleClinicLogin(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.CLINIC_JWT_SECRET || "clinic_secret";
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
      .from("clinic_admin_users")
      .select("id, username, password_plain, is_super")
      .eq("username", username)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.password_plain || password !== user.password_plain) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        user_id: user.id,
        username: user.username,
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
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
}

async function handleClinicAppointments(req, res) {
  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const { appointments } = getTableNames();

  try {
    if (req.method === "GET") {
      const status = normalizeQueryValue(req.query.status);
      let query = supabase
        .from(appointments)
        .select("*")
        .order("start_at", { ascending: true });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error: queryError } = await query;
      if (queryError) {
        return res
          .status(500)
          .json({ error: queryError.message || queryError });
      }
      return res.json({ ok: true, appointments: data || [] });
    }

    if (req.method === "POST") {
      const {
        patient_name,
        patient_phone,
        service_id,
        start_at,
        end_at,
        notes,
      } = req.body || {};

      if (!patient_name || !patient_phone || !service_id || !start_at) {
        return res.status(400).json({
          error: "Required: patient_name, patient_phone, service_id, start_at",
        });
      }

      const { data: appointment, error: insertError } = await supabase
        .from(appointments)
        .insert([
          {
            patient_name,
            patient_phone,
            service_id,
            start_at,
            end_at,
            notes,
            source: "api",
            status: "booked",
          },
        ])
        .select("*")
        .single();

      if (insertError) {
        return res
          .status(500)
          .json({ error: insertError.message || insertError });
      }

      return res.json({ ok: true, appointment });
    }

    if (req.method === "PATCH") {
      const token = verifyClinicToken(req);
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id, status } = req.body || {};
      if (!id || !status) {
        return res.status(400).json({ error: "Required: id, status" });
      }

      const { data: appointment, error: updateError } = await supabase
        .from(appointments)
        .update({ status })
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        return res
          .status(500)
          .json({ error: updateError.message || updateError });
      }

      return res.json({ ok: true, appointment });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
}

async function handleClinicServices(req, res) {
  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const { services } = getTableNames();

  try {
    if (req.method === "GET") {
      const { data, error: queryError } = await supabase
        .from(services)
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (queryError) {
        return res
          .status(500)
          .json({ error: queryError.message || queryError });
      }

      return res.json({ ok: true, services: data || [] });
    }

    const token = verifyClinicToken(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.method === "POST") {
      const { name, duration_minutes, price, currency } = req.body || {};
      if (!name || !duration_minutes) {
        return res
          .status(400)
          .json({ error: "Required: name, duration_minutes" });
      }

      const { data, error: insertError } = await supabase
        .from(services)
        .insert([
          {
            name,
            duration_minutes,
            price: price || 0,
            currency: currency || "PKR",
            is_active: true,
          },
        ])
        .select("*")
        .single();

      if (insertError) {
        return res
          .status(500)
          .json({ error: insertError.message || insertError });
      }

      return res.json({ ok: true, service: data });
    }

    if (req.method === "PUT") {
      const { id, ...updates } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: "id is required" });
      }

      const { data, error: updateError } = await supabase
        .from(services)
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        return res
          .status(500)
          .json({ error: updateError.message || updateError });
      }

      return res.json({ ok: true, service: data });
    }

    if (req.method === "DELETE") {
      const id = req.body?.id || req.query.id;
      if (!id) {
        return res.status(400).json({ error: "id is required" });
      }

      const { error: deleteError } = await supabase
        .from(services)
        .delete()
        .eq("id", id);

      if (deleteError) {
        return res
          .status(500)
          .json({ error: deleteError.message || deleteError });
      }

      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
}

async function handleClinicBlockedTimes(req, res) {
  const token = verifyClinicToken(req);
  if (!token && req.method !== "GET") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const { blocked_times } = getTableNames();

  try {
    if (req.method === "GET") {
      const { data, error: queryError } = await supabase
        .from(blocked_times)
        .select("*")
        .order("start_at", { ascending: true });

      if (queryError) {
        return res
          .status(500)
          .json({ error: queryError.message || queryError });
      }

      return res.json({ ok: true, blocked_times: data || [] });
    }

    if (req.method === "POST") {
      const { start_at, end_at, reason } = req.body || {};
      if (!start_at || !end_at) {
        return res.status(400).json({ error: "Required: start_at, end_at" });
      }

      const { data, error: insertError } = await supabase
        .from(blocked_times)
        .insert([{ start_at, end_at, reason }])
        .select("*")
        .single();

      if (insertError) {
        return res
          .status(500)
          .json({ error: insertError.message || insertError });
      }

      return res.json({ ok: true, blocked_time: data });
    }

    if (req.method === "DELETE") {
      const id = req.body?.id || req.query.id;
      if (!id) {
        return res.status(400).json({ error: "id is required" });
      }

      const { error: deleteError } = await supabase
        .from(blocked_times)
        .delete()
        .eq("id", id);

      if (deleteError) {
        return res
          .status(500)
          .json({ error: deleteError.message || deleteError });
      }

      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
}

async function handleClinicSettings(req, res) {
  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const { clinic_settings } = getTableNames();

  try {
    if (req.method === "GET") {
      const { data, error: queryError } = await supabase
        .from(clinic_settings)
        .select("*")
        .limit(1);

      if (queryError) {
        return res
          .status(500)
          .json({ error: queryError.message || queryError });
      }

      return res.json({ ok: true, settings: data?.[0] || null });
    }

    const token = verifyClinicToken(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const payload = req.body || {};
      const { data, error: upsertError } = await supabase
        .from(clinic_settings)
        .upsert(payload, { onConflict: "true" })
        .select("*")
        .single();

      if (upsertError) {
        return res
          .status(500)
          .json({ error: upsertError.message || upsertError });
      }

      return res.json({ ok: true, settings: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
}

async function handleClinicVapiWebhook(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requiredToken = process.env.VAPI_WEBHOOK_TOKEN;
  if (requiredToken) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${requiredToken}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const { message } = req.body;

    if (!message?.toolCalls || message.toolCalls.length === 0) {
      return res.status(200).json({
        results: [{ toolCallId: "none", result: "No function called" }],
      });
    }

    const { ok, supabase, error: dbError } = getSupabase();
    if (!ok) {
      return res.status(500).json({ error: dbError });
    }

    const { services, appointments, clinic_settings } = getTableNames();
    const results = [];

    for (const toolCall of message.toolCalls) {
      const { id, function: fn } = toolCall;
      const functionName = fn?.name;
      const args =
        typeof fn?.arguments === "string"
          ? JSON.parse(fn.arguments)
          : fn?.arguments || {};

      console.log(`[Clinic Vapi] Function: ${functionName}`, args);

      let result;

      if (functionName === "check_availability") {
        const { date, service_id } = args;
        const { data: svc } = await supabase
          .from(services)
          .select("duration_minutes")
          .eq("id", service_id)
          .single();

        const duration = svc?.duration_minutes || 30;
        const startTime = new Date(`${date}T09:00:00Z`);
        const slots = [];

        for (let i = 0; i < 8; i++) {
          const slotStart = new Date(startTime.getTime() + i * 60 * 60 * 1000);
          slots.push(slotStart.toISOString());
        }

        result = { ok: true, available_slots: slots, slot_count: slots.length };
      } else if (functionName === "book_appointment") {
        const {
          patient_name,
          patient_phone,
          service_id,
          slot_start_at,
          notes,
        } = args;

        const { data: appt, error: apptError } = await supabase
          .from(appointments)
          .insert([
            {
              patient_name,
              patient_phone,
              service_id,
              start_at: slot_start_at,
              end_at: new Date(
                new Date(slot_start_at).getTime() + 30 * 60000,
              ).toISOString(),
              notes,
              source: "vapi",
              status: "booked",
            },
          ])
          .select("id")
          .single();

        result = apptError
          ? { ok: false, error: apptError.message }
          : {
              ok: true,
              appointment_id: appt.id,
              message: `Appointment booked for ${patient_name}`,
            };
      } else {
        result = { error: `Unknown function: ${functionName}` };
      }

      results.push({
        toolCallId: id,
        result: JSON.stringify(result),
      });
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error("[Clinic Vapi] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const path = normalizeQueryValue(req.query.path) || "";

  if (path === "login") return handleClinicLogin(req, res);
  if (path === "appointments") return handleClinicAppointments(req, res);
  if (path === "services") return handleClinicServices(req, res);
  if (path === "blocked-times") return handleClinicBlockedTimes(req, res);
  if (path === "settings") return handleClinicSettings(req, res);
  if (path === "vapi-webhook") return handleClinicVapiWebhook(req, res);

  return res.status(404).json({ error: "Unknown clinic endpoint" });
};
