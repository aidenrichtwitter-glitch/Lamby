
-- Evolution state - single row that tracks the system's current state
CREATE TABLE public.evolution_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  evolution_level INTEGER NOT NULL DEFAULT 0,
  cycle_count INTEGER NOT NULL DEFAULT 0,
  total_changes INTEGER NOT NULL DEFAULT 0,
  phase TEXT NOT NULL DEFAULT 'scanning',
  last_action TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert the singleton row
INSERT INTO public.evolution_state (id) VALUES ('singleton');

-- Capabilities acquired by the system
CREATE TABLE public.capabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  source_file TEXT,
  built_on TEXT[] DEFAULT '{}',
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cycle_number INTEGER NOT NULL DEFAULT 0,
  evolution_level INTEGER NOT NULL DEFAULT 0,
  virtual_source TEXT
);

-- Self-directed goals
CREATE TABLE public.goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  priority TEXT NOT NULL DEFAULT 'medium',
  progress INTEGER NOT NULL DEFAULT 0,
  steps JSONB NOT NULL DEFAULT '[]',
  required_capabilities TEXT[] DEFAULT '{}',
  unlocks_capability TEXT,
  dreamed_at_cycle INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evolution journal - notable events and milestones
CREATE TABLE public.evolution_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disable RLS since this is a public autonomous system
ALTER TABLE public.evolution_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_journal ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for the autonomous system
CREATE POLICY "Public access" ON public.evolution_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.capabilities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.evolution_journal FOR ALL USING (true) WITH CHECK (true);
