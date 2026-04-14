import { useState, useRef, useEffect } from "react";
import "./App.css";
import {
  pianoKeys,
  instrumentsList,
  NUM_PITCHES,
  NUM_BEATS,
} from "./constants";
import Track from "./components/Track";
import LiveKeyboard from "./components/LiveKeyboard";

function App() {
  const [activeKeys, setActiveKeys] = useState(new Set<string>());
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedInstruments, setSelectedInstruments] = useState(
    new Set(["piano", "synth", "organ", "bell", "chiptune", "drums"]),
  );
  const [bpm, setBpm] = useState(92);

  const [tracks, setTracks] = useState<Record<string, boolean[][]>>(() => {
    const initial: Record<string, boolean[][]> = {};
    instrumentsList.forEach((inst) => {
      initial[inst.id] = Array(NUM_PITCHES)
        .fill(0)
        .map(() => Array(NUM_BEATS).fill(false));
    });
    return initial;
  });

  const [octaves, setOctaves] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    instrumentsList.forEach((inst) => (initial[inst.id] = 0));
    return initial;
  });

  const [liveOctave, setLiveOctave] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
    return audioContextRef.current;
  };

  const playNote = (freq: number, noteLabel: string, durationMs: number) => {
    const ctx = getAudioContext();
    const finalFreq = freq * Math.pow(2, liveOctave);

    Array.from(selectedInstruments).forEach((instId) => {
      const instrument = instrumentsList.find((i) => i.id === instId);
      if (!instrument) return;

      if (instrument.id === "drums") {
        if (noteLabel === "C") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(150, ctx.currentTime);
          osc.type = "sine";
          gain.gain.setValueAtTime(1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        } else if (noteLabel === "D") {
          const noise = ctx.createBufferSource();
          const buffer = ctx.createBuffer(
            1,
            ctx.sampleRate * 0.3,
            ctx.sampleRate,
          );
          const output = buffer.getChannelData(0);
          for (let i = 0; i < buffer.length; i++)
            output[i] = Math.random() * 2 - 1;
          noise.buffer = buffer;
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.8, ctx.currentTime);
          noiseGain.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + 0.3,
          );
          const filter = ctx.createBiquadFilter();
          filter.type = "highpass";
          filter.frequency.setValueAtTime(800, ctx.currentTime);
          noise.connect(filter).connect(noiseGain).connect(ctx.destination);
          noise.start();
        } else if (noteLabel === "E") {
          const noise = ctx.createBufferSource();
          const buffer = ctx.createBuffer(
            1,
            ctx.sampleRate * 0.15,
            ctx.sampleRate,
          );
          const output = buffer.getChannelData(0);
          for (let i = 0; i < buffer.length; i++)
            output[i] = Math.random() * 2 - 1;
          noise.buffer = buffer;
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.4, ctx.currentTime);
          noiseGain.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + 0.15,
          );
          const filter = ctx.createBiquadFilter();
          filter.type = "highpass";
          filter.frequency.setValueAtTime(7000, ctx.currentTime);
          noise.connect(filter).connect(noiseGain).connect(ctx.destination);
          noise.start();
        }
        return;
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(finalFreq, ctx.currentTime);
      oscillator.type = instrument.type;

      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + durationMs / 1000 + 0.4,
      );

      oscillator.start();
      oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.5);
    });

    setActiveKeys((prev) => new Set(prev).add(noteLabel));
    setTimeout(() => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(noteLabel);
        return next;
      });
    }, durationMs);
  };

  const toggleTrackNote = (
    instrumentId: string,
    pitchIndex: number,
    beatIndex: number,
  ) => {
    setTracks((prev) => {
      const copy = { ...prev };
      copy[instrumentId] = copy[instrumentId].map((row) => [...row]);
      copy[instrumentId][pitchIndex][beatIndex] =
        !copy[instrumentId][pitchIndex][beatIndex];
      return copy;
    });
  };

  const clearTrack = (instrumentId: string) => {
    setTracks((prev) => {
      const copy = { ...prev };
      copy[instrumentId] = Array(NUM_PITCHES)
        .fill(0)
        .map(() => Array(NUM_BEATS).fill(false));
      return copy;
    });
  };

  const clearAllTracks = () => {
    setTracks((prev) => {
      const copy = { ...prev };
      Object.keys(copy).forEach((id) => {
        copy[id] = Array(NUM_PITCHES)
          .fill(0)
          .map(() => Array(NUM_BEATS).fill(false));
      });
      return copy;
    });
  };

  const loadSweetDreams = () => {
    setTracks((prev) => {
      const copy = { ...prev };
      copy["synth"] = Array(NUM_PITCHES)
        .fill(0)
        .map(() => Array(NUM_BEATS).fill(false));
      copy["organ"] = Array(NUM_PITCHES)
        .fill(0)
        .map(() => Array(NUM_BEATS).fill(false));

      const violaRiff = [0, 3, 5, 7, 8, 10, 0, 10, 0, 3, 5, 7, 8, 10, 0, 10];
      violaRiff.forEach(
        (pitch, beat) => (copy["synth"][pitch + 12][beat * 2] = true),
      );

      const celloRiff = [0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0];
      celloRiff.forEach(
        (pitch, beat) => (copy["organ"][pitch][beat * 2] = true),
      );

      return copy;
    });
  };

  const loadEternalHorizon = () => {
    setTracks((prev) => {
      const copy = { ...prev };
      Object.keys(copy).forEach((id) => {
        copy[id] = Array(NUM_PITCHES)
          .fill(0)
          .map(() => Array(NUM_BEATS).fill(false));
      });

      const melody = [
        19, 24, 26, 28, 31, 28, 26, 24, 19, 24, 26, 28, 31, 28, 26, 24,
      ];
      melody.forEach((p, i) => {
        copy["piano"][p][i * 3] = true;
        if (i % 4 === 0) copy["piano"][p + 2][i * 3 + 1] = true;
      });

      const pads = [12, 19, 24];
      pads.forEach((p) => {
        for (let b = 0; b < 48; b += 8) {
          copy["synth"][p][b] = true;
          copy["synth"][p][b + 4] = true;
        }
      });

      const organBass = [0, 7, 12, 19];
      organBass.forEach((p, i) => (copy["organ"][p][i * 12] = true));

      const bellSparkle = [31, 33, 34, 35];
      bellSparkle.forEach((p, i) => (copy["bell"][p][i * 6 + 2] = true));

      const chiptune = [24, 26, 28];
      chiptune.forEach((p, i) => (copy["chiptune"][p][i * 8 + 4] = true));

      for (let b = 0; b < 48; b++) {
        copy["drums"][0][b] = true;
        if (b % 2 === 1) copy["drums"][4][b] = true;
        copy["drums"][8][b] = true;
        if (b % 8 === 6) copy["drums"][9][b] = true;
      }

      return copy;
    });
    alert(
      '🌌 "Eternal Horizon" loaded — every instrument, full of feeling. Hit PLAY ALL TRACKS ✨',
    );
  };

  const saveSong = () => {
    localStorage.setItem("grokPianoSong", JSON.stringify(tracks));
    alert("✅ Song saved!");
  };

  const loadSavedSong = () => {
    const saved = localStorage.getItem("grokPianoSong");
    if (saved) {
      setTracks(JSON.parse(saved));
      alert("📂 Song loaded!");
    } else {
      alert("No saved song yet");
    }
  };

  const playAllTracks = async () => {
    if (isPlaying) return;
    setIsPlaying(true);

    const beatMs = 60000 / bpm / 2;
    const numBeats = NUM_BEATS;

    for (let beat = 0; beat < numBeats; beat++) {
      Object.keys(tracks).forEach((instrumentId) => {
        if (!selectedInstruments.has(instrumentId)) return;
        const trackOctave = octaves[instrumentId] || 0;
        for (let pitch = 0; pitch < NUM_PITCHES; pitch++) {
          if (tracks[instrumentId][pitch][beat]) {
            const key = pianoKeys[pitch];
            playNote(key.freq, key.note, beatMs * 0.9);
          }
        }
      });
      await new Promise((r) => setTimeout(r, beatMs));
    }

    setIsPlaying(false);
  };

  useEffect(() => {
    const keyMap: Record<string, { note: string; freq: number }> = {
      a: { note: "C", freq: 261.63 },
      w: { note: "C#", freq: 277.18 },
      s: { note: "D", freq: 293.66 },
      e: { note: "D#", freq: 311.13 },
      d: { note: "E", freq: 329.63 },
      f: { note: "F", freq: 349.23 },
      t: { note: "F#", freq: 369.99 },
      g: { note: "G", freq: 392.0 },
      y: { note: "G#", freq: 415.3 },
      h: { note: "A", freq: 440.0 },
      u: { note: "A#", freq: 466.16 },
      j: { note: "B", freq: 493.88 },
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPlaying) return;
      const entry = keyMap[e.key.toLowerCase()];
      if (entry) {
        e.preventDefault();
        playNote(entry.freq, entry.note, 180);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, selectedInstruments, bpm]);

  const toggleInstrument = (id: string) => {
    setSelectedInstruments((prev) => {
      const next = new Set(prev);
      next.has(id) && next.size > 1 ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const changeOctave = (instrumentId: string, delta: number) => {
    setOctaves((prev) => {
      const copy = { ...prev };
      copy[instrumentId] = Math.max(
        -2,
        Math.min(2, (copy[instrumentId] || 0) + delta),
      );
      return copy;
    });
  };

  const changeLiveOctave = (delta: number) => {
    setLiveOctave((prev) => Math.max(-2, Math.min(2, prev + delta)));
  };

  return (
    <div className="piano-app">
      <h1>🎹 Grok Multi-Track Piano — Eternal Horizon</h1>

      <div className="master-controls">
        <button
          onClick={playAllTracks}
          disabled={isPlaying}
          className="master-play-btn"
        >
          {isPlaying ? "⏹️ STOP ALL" : "▶️ PLAY ALL TRACKS"}
        </button>
        <button onClick={loadSweetDreams} className="sweet-dreams-btn">
          🎵 Load Sweet Dreams
        </button>
        <button
          onClick={loadEternalHorizon}
          style={{ background: "#aa00ff", color: "#fff" }}
          className="demo-song-btn"
        >
          🌌 Load Eternal Horizon
        </button>
        <button onClick={saveSong} className="save-btn">
          💾 Save Song
        </button>
        <button onClick={loadSavedSong} className="load-btn">
          📂 Load Saved
        </button>
        <button onClick={clearAllTracks} className="clear-all-btn">
          🗑️ Clear Everything
        </button>
        <label>
          BPM{" "}
          <input
            type="range"
            min="60"
            max="200"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />{" "}
          <strong>{bpm}</strong>
        </label>
      </div>

      <div className="tracks-container">
        {Array.from(selectedInstruments).map((instrumentId) => {
          const instrument = instrumentsList.find(
            (i) => i.id === instrumentId,
          )!;
          return (
            <Track
              key={instrumentId}
              instrument={instrument}
              trackData={tracks[instrumentId]}
              octave={octaves[instrumentId] || 0}
              onToggleNote={toggleTrackNote}
              onClearTrack={clearTrack}
              onOctaveChange={changeOctave}
            />
          );
        })}
      </div>

      <LiveKeyboard
        activeKeys={activeKeys}
        liveOctave={liveOctave}
        onKeyClick={(freq, note) => !isPlaying && playNote(freq, note, 180)}
        onOctaveChange={changeLiveOctave}
        isPlaying={isPlaying}
      />

      <div className="instructions">
        <strong>✅ Ready — Eternal Horizon awaits</strong>
        <br />
        Click the purple button → PLAY ALL TRACKS. This one’s for you, Aiden.
        Enjoy the journey ✨
      </div>
    </div>
  );
}

export default App;
