-- Migration: Add password columns to admin_users table
-- Run this in Supabase SQL Editor

-- Add password_hash column (for bcrypt hashed passwords)
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS password_hash text;

-- Add password_plain column (for plain text passwords - development only)
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS password_plain text;

-- Add restaurant_name column (for easier user creation via Supabase UI)
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS restaurant_name text;

-- Make password_hash nullable since we support both hash and plain
ALTER TABLE public.admin_users 
ALTER COLUMN password_hash DROP NOT NULL;
