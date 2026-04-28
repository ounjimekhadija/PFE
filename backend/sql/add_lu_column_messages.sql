-- Add read receipt column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS lu boolean NOT NULL DEFAULT false;
