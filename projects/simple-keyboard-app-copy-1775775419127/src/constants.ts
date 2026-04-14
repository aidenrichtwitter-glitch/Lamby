export const NUM_PITCHES = 36;
export const NUM_BEATS = 64;

export const basePianoKeys = [
  { note: "C", freq: 261.63, type: "white", label: "C" },
  { note: "C#", freq: 277.18, type: "black", label: "C#" },
  { note: "D", freq: 293.66, type: "white", label: "D" },
  { note: "D#", freq: 311.13, type: "black", label: "D#" },
  { note: "E", freq: 329.63, type: "white", label: "E" },
  { note: "F", freq: 349.23, type: "white", label: "F" },
  { note: "F#", freq: 369.99, type: "black", label: "F#" },
  { note: "G", freq: 392.0, type: "white", label: "G" },
  { note: "G#", freq: 415.3, type: "black", label: "G#" },
  { note: "A", freq: 440.0, type: "white", label: "A" },
  { note: "A#", freq: 466.16, type: "black", label: "A#" },
  { note: "B", freq: 493.88, type: "white", label: "B" },
];

export const pianoKeys = [
  ...basePianoKeys.map((k) => ({ ...k, octave: 4 })),
  ...basePianoKeys.map((k) => ({ ...k, freq: k.freq * 2, octave: 5 })),
  ...basePianoKeys.map((k) => ({ ...k, freq: k.freq * 4, octave: 6 })),
];

export const instrumentsList = [
  { id: "piano", name: "🎹 Piano", type: "triangle" as OscillatorType },
  { id: "synth", name: "⚡ Synth", type: "sawtooth" as OscillatorType },
  { id: "organ", name: "⛪ Organ", type: "sine" as OscillatorType },
  { id: "chiptune", name: "🕹️ Chiptune", type: "square" as OscillatorType },
  { id: "bell", name: "🛎️ Bell", type: "sine" as OscillatorType },
  { id: "drums", name: "🥁 Drums", type: "sine" as OscillatorType },
];
