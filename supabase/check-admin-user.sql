-- Check if admin user exists in database
-- Run this in Supabase SQL Editor

SELECT 
  id,
  username,
  password_hash,
  password_plain,
  restaurant_id,
  restaurant_name,
  is_super,
  created_at
FROM public.admin_users
WHERE username = 'admin';

-- If no results, create the admin user:
-- INSERT INTO public.admin_users (username, password_plain, is_super)
-- VALUES ('admin', 'admin', true);
