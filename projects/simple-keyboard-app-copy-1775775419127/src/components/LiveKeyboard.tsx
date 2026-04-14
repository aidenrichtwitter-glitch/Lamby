import { pianoKeys } from "../constants";

interface LiveKeyboardProps {
  activeKeys: Set<string>;
  liveOctave: number;
  onKeyClick: (freq: number, note: string) => void;
  onOctaveChange: (delta: number) => void;
  isPlaying: boolean;
}

export default function LiveKeyboard({
  activeKeys,
  liveOctave,
  onKeyClick,
  onOctaveChange,
  isPlaying,
}: LiveKeyboardProps) {
  return (
    <div className="live-keyboard">
      <div className="live-header">
        <h3>Live Keyboard (2 octaves)</h3>
        <div className="octave-control">
          Octave
          <button onClick={() => onOctaveChange(-1)}>-</button>
          <strong>{liveOctave}</strong>
          <button onClick={() => onOctaveChange(1)}>+</button>
        </div>
      </div>
      <div className="piano">
        {[...pianoKeys.slice(0, 24), ...pianoKeys.slice(0, 24)].map(
          (key, index) => (
            <button
              key={index}
              className={`piano-key ${key.type} ${activeKeys.has(key.note) ? "active" : ""}`}
              onClick={() => !isPlaying && onKeyClick(key.freq, key.note)}
            >
              <span className="note-label">{key.label}</span>
            </button>
          ),
        )}
      </div>
    </div>
  );
}
