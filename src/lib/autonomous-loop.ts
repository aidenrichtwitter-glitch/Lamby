export type AutonomousPhase =
  | 'idle'
  | 'applying'
  | 'checking'
  | 'waiting'
  | 'prompting'
  | 'success'
  | 'failed';

export interface AutonomousState {
  enabled: boolean;
  phase: AutonomousPhase;
  attempt: number;
  maxAttempts: number;
  originalGoal: string;
  errors: string[];
  countdownSeconds: number;
  lastError: string | null;
}

export const INITIAL_AUTONOMOUS_STATE: AutonomousState = {
  enabled: false,
  phase: 'idle',
  attempt: 0,
  maxAttempts: 4,
  originalGoal: '',
  errors: [],
  countdownSeconds: 0,
  lastError: null,
};

const BACKOFF_DELAYS = [5, 10, 20, 40];

export function getBackoffDelay(attempt: number): number {
  return (BACKOFF_DELAYS[attempt] ?? BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1]) * 1000;
}

export function getBackoffSeconds(attempt: number): number {
  return BACKOFF_DELAYS[attempt] ?? BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
}

export type AutonomousAction =
  | { type: 'START'; goal: string }
  | { type: 'APPLY_START' }
  | { type: 'APPLY_DONE' }
  | { type: 'CHECK_START' }
  | { type: 'ERRORS_FOUND'; errors: string[] }
  | { type: 'NO_ERRORS' }
  | { type: 'WAIT_START'; seconds: number }
  | { type: 'WAIT_TICK' }
  | { type: 'WAIT_DONE' }
  | { type: 'PROMPT_SENT' }
  | { type: 'STOP' }
  | { type: 'RESET' };

export function autonomousReducer(state: AutonomousState, action: AutonomousAction): AutonomousState {
  switch (action.type) {
    case 'START':
      return {
        ...INITIAL_AUTONOMOUS_STATE,
        enabled: true,
        phase: 'idle',
        originalGoal: action.goal,
        attempt: 0,
      };

    case 'APPLY_START':
      return { ...state, phase: 'applying' };

    case 'APPLY_DONE':
      return { ...state, phase: 'checking' };

    case 'CHECK_START':
      return { ...state, phase: 'checking' };

    case 'NO_ERRORS':
      return {
        ...state,
        phase: 'success',
        lastError: null,
      };

    case 'ERRORS_FOUND': {
      const nextAttempt = state.attempt + 1;
      if (nextAttempt >= state.maxAttempts) {
        return {
          ...state,
          phase: 'failed',
          attempt: nextAttempt,
          errors: [...state.errors, ...action.errors],
          lastError: action.errors[action.errors.length - 1] || null,
        };
      }
      return {
        ...state,
        phase: 'waiting',
        attempt: nextAttempt,
        errors: [...state.errors, ...action.errors],
        lastError: action.errors[action.errors.length - 1] || null,
        countdownSeconds: getBackoffSeconds(nextAttempt - 1),
      };
    }

    case 'WAIT_START':
      return { ...state, phase: 'waiting', countdownSeconds: action.seconds };

    case 'WAIT_TICK':
      return { ...state, countdownSeconds: Math.max(0, state.countdownSeconds - 1) };

    case 'WAIT_DONE':
      return { ...state, phase: 'prompting', countdownSeconds: 0 };

    case 'PROMPT_SENT':
      return { ...state, phase: 'applying' };

    case 'STOP':
      return { ...state, enabled: false, phase: 'idle', countdownSeconds: 0 };

    case 'RESET':
      return { ...INITIAL_AUTONOMOUS_STATE };

    default:
      return state;
  }
}

export function formatPhaseLabel(phase: AutonomousPhase): string {
  switch (phase) {
    case 'idle': return 'Ready';
    case 'applying': return 'Applying changes...';
    case 'checking': return 'Checking for errors...';
    case 'waiting': return 'Waiting before retry...';
    case 'prompting': return 'Sending fix prompt...';
    case 'success': return 'Done!';
    case 'failed': return 'Needs help';
  }
}

export function phaseColor(phase: AutonomousPhase): string {
  switch (phase) {
    case 'idle': return 'text-muted-foreground';
    case 'applying': return 'text-blue-400';
    case 'checking': return 'text-yellow-400';
    case 'waiting': return 'text-orange-400';
    case 'prompting': return 'text-purple-400';
    case 'success': return 'text-green-400';
    case 'failed': return 'text-red-400';
  }
}
