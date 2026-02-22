-- Fix admin user password - ensure password_hash is NULL, not empty string
UPDATE public.admin_users
SET password_hash = NULL
WHERE username = 'admin' AND password_hash = '';

-- Verify the update
SELECT 
  username,
  password_hash IS NULL as hash_is_null,
  password_plain,
  restaurant_name
FROM public.admin_users
WHERE username = 'admin';
