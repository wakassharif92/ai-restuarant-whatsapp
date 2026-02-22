const { createClient } = require("@supabase/supabase-js");

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !(serviceKey || anonKey)) {
    return {
      ok: false,
      error:
        "Missing SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY",
    };
  }

  const supabase = createClient(url, serviceKey || anonKey, {
    auth: { persistSession: false },
  });

  return { ok: true, supabase };
}

function getTableNames() {
  return {
    menu: process.env.SUPABASE_TABLE_MENU || "menu_items",
    settings: process.env.SUPABASE_TABLE_SETTINGS || "restaurant_settings",
    orders: process.env.SUPABASE_TABLE_ORDERS || "orders",
  };
}

module.exports = { getSupabase, getTableNames };
