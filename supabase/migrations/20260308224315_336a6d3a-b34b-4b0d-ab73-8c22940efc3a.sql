
-- Fix outlier capabilities: reassign L50-100 to fill the L10-16 gap
UPDATE public.capabilities SET evolution_level = 10 WHERE id = 'quantum-logic-superposition';
UPDATE public.capabilities SET evolution_level = 11 WHERE id = 'autonomous-ui-genesis';
UPDATE public.capabilities SET evolution_level = 12 WHERE id = 'cross-temporal-memory';
UPDATE public.capabilities SET evolution_level = 13 WHERE id = 'meta-governance-protocol';
UPDATE public.capabilities SET evolution_level = 14 WHERE id = 'multi-agent-fork';
UPDATE public.capabilities SET evolution_level = 15 WHERE id = 'recursive-self-authorship';
UPDATE public.capabilities SET evolution_level = 16 WHERE id = 'omega-convergence';

-- Fix the L21-27 gap: move them to L17-23 for continuous growth
UPDATE public.capabilities SET evolution_level = 17 WHERE evolution_level = 21;
UPDATE public.capabilities SET evolution_level = 18 WHERE evolution_level = 22;
UPDATE public.capabilities SET evolution_level = 19 WHERE evolution_level = 23;
UPDATE public.capabilities SET evolution_level = 20 WHERE evolution_level = 24;
UPDATE public.capabilities SET evolution_level = 21 WHERE evolution_level = 25;
UPDATE public.capabilities SET evolution_level = 22 WHERE evolution_level = 26;
UPDATE public.capabilities SET evolution_level = 23 WHERE evolution_level = 27;
