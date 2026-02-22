-- Add RLS policies for admin users to manage menu items, settings, and orders
-- Run this in Supabase SQL Editor

-- Menu Items: allow insert/update/delete for authenticated users (admin panel)
CREATE POLICY "menu_items_insert" ON public.menu_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "menu_items_update" ON public.menu_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "menu_items_delete" ON public.menu_items
  FOR DELETE
  TO authenticated
  USING (true);

-- Restaurant Settings: allow insert/update/delete for authenticated users
CREATE POLICY "settings_insert" ON public.restaurant_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "settings_update" ON public.restaurant_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "settings_delete" ON public.restaurant_settings
  FOR DELETE
  TO authenticated
  USING (true);
