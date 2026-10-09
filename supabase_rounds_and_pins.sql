-- ==========================================================
-- GOLF NOTES: ROUNDS, HOLES, SHOTS & GREEN PINS SUPABASE MIGRATION
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==========================================================

-- 1. Table Grants for authenticated and anon roles
GRANT ALL ON public.rounds TO authenticated, anon;
GRANT ALL ON public.round_holes TO authenticated, anon;
GRANT ALL ON public.shots TO authenticated, anon;
GRANT ALL ON public.courses TO authenticated, anon;

-- 2. Row Level Security (RLS) for 'rounds'
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own rounds" ON public.rounds;
CREATE POLICY "Users can view their own rounds" ON public.rounds
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own rounds" ON public.rounds;
CREATE POLICY "Users can insert their own rounds" ON public.rounds
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own rounds" ON public.rounds;
CREATE POLICY "Users can update their own rounds" ON public.rounds
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own rounds" ON public.rounds;
CREATE POLICY "Users can delete their own rounds" ON public.rounds
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Row Level Security (RLS) for 'round_holes'
ALTER TABLE public.round_holes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage round holes" ON public.round_holes;
CREATE POLICY "Users can manage round holes" ON public.round_holes
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.rounds r WHERE r.id = round_holes.round_id AND r.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.rounds r WHERE r.id = round_holes.round_id AND r.user_id = auth.uid())
  );

-- 4. Row Level Security (RLS) for 'shots'
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage shots" ON public.shots;
CREATE POLICY "Users can manage shots" ON public.shots
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.rounds r WHERE r.id = shots.round_id AND r.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.rounds r WHERE r.id = shots.round_id AND r.user_id = auth.uid())
  );

-- 5. Create 'green_pins' table to synchronize user markers across devices
CREATE TABLE IF NOT EXISTS public.green_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  hole_number INT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id, hole_number)
);

ALTER TABLE public.green_pins ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.green_pins TO authenticated, anon;

DROP POLICY IF EXISTS "Users can manage their own green pins" ON public.green_pins;
CREATE POLICY "Users can manage their own green pins" ON public.green_pins
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Row Level Security (RLS) & Permissions for 'profiles'
GRANT ALL ON public.profiles TO authenticated, anon;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile, admins can update any" ON public.profiles;
CREATE POLICY "Users can update own profile, admins can update any" ON public.profiles
  FOR UPDATE TO authenticated USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete user profiles" ON public.profiles;
CREATE POLICY "Admins can delete user profiles" ON public.profiles
  FOR DELETE TO authenticated USING (
    auth.uid() = id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

