import { useState, useRef, useEffect } from 'react'
import './App.css'

const basePianoKeys = [
  { note: 'C', freq: 261.63, type: 'white', label: 'C' },
  { note: 'C#', freq: 277.18, type: 'black', label: 'C#' },
  { note: 'D', freq: 293.66, type: 'white', label: 'D' },
  { note: 'D#', freq: 311.13, type: 'black', label: 'D#' },
  { note: 'E', freq: 329.63, type: 'white', label: 'E' },
  { note: 'F', freq: 349.23, type: 'white', label: 'F' },
  { note: 'F#', freq: 369.99, type: 'black', label: 'F#' },
  { note: 'G', freq: 392.00, type: 'white', label: 'G' },
  { note: 'G#', freq: 415.30, type: 'black', label: 'G#' },
  { note: 'A', freq: 440.00, type: 'white', label: 'A' },
  { note: 'A#', freq: 466.16, type: 'black', label: 'A#' },
  { note: 'B', freq: 493.88, type: 'white', label: 'B' },
]

const pianoKeys = [
  ...basePianoKeys.map(k => ({ ...k, octave: 4 })),
  ...basePianoKeys.map(k => ({ ...k, freq: k.freq * 2, octave: 5 })),
  ...basePianoKeys.map(k => ({ ...k, freq: k.freq * 4, octave: 6 }))
]

const NUM_PITCHES = 36
const NUM_BEATS = 64

const instrumentsList = [
  { id: 'piano', name: '🎹 Piano', type: 'triangle' as OscillatorType },
  { id: 'synth', name: '⚡ Synth', type: 'sawtooth' as OscillatorType },
  { id: 'organ', name: '⛪ Organ', type: 'sine' as OscillatorType },
  { id: 'chiptune', name: '🕹️ Chiptune', type: 'square' as OscillatorType },
  { id: 'bell', name: '🛎️ Bell', type: 'sine' as OscillatorType },
  { id: 'drums', name: '🥁 Drums', type: 'sine' as OscillatorType },
]

function App() {
  const [activeKeys, setActiveKeys] = useState(new Set<string>())
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(-1)
  const [selectedInstruments, setSelectedInstruments] = useState(new Set(['piano', 'synth', 'organ', 'bell', 'drums']))
  const [bpm, setBpm] = useState(125)

  const [tracks, setTracks] = useState<Record<string, boolean[][]>>(() => {
    const initial: Record<string, boolean[][]> = {}
    instrumentsList.forEach(inst => {
      initial[inst.id] = Array(NUM_PITCHES).fill(0).map(() => Array(NUM_BEATS).fill(false))
    })
    return initial
  })

  const [octaves, setOctaves] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    instrumentsList.forEach(inst => initial[inst.id] = 0)
    return initial
  })

  const [liveOctave, setLiveOctave] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }

  const playNote = (freq: number, noteLabel: string, durationMs: number, octaveOffset: number = 0) => {
    const ctx = getAudioContext()
    const finalFreq = freq * Math.pow(2, octaveOffset + liveOctave)

    Array.from(selectedInstruments).forEach(instId => {
      const instrument = instrumentsList.find(i => i.id === instId)
      if (!instrument) return

      if (instrument.id === 'drums') {
        if (noteLabel === 'C') { // Kick
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.frequency.setValueAtTime(140, ctx.currentTime)
          osc.type = 'sine'
          gain.gain.setValueAtTime(1.2, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
          osc.connect(gain).connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + 0.5)
        } else if (noteLabel === 'D') { // Snare
          const noise = ctx.createBufferSource()
          const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate)
          const output = buffer.getChannelData(0)
          for (let i = 0; i < buffer.length; i++) output[i] = Math.random() * 2 - 1
          noise.buffer = buffer
          const noiseGain = ctx.createGain()
          noiseGain.gain.setValueAtTime(0.9, ctx.currentTime)
          noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
          const filter = ctx.createBiquadFilter()
          filter.type = 'highpass'
          filter.frequency.setValueAtTime(1200, ctx.currentTime)
          noise.connect(filter).connect(noiseGain).connect(ctx.destination)
          noise.start()
        } else if (noteLabel === 'E') { // Closed Hat
          const noise = ctx.createBufferSource()
          const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate)
          const output = buffer.getChannelData(0)
          for (let i = 0; i < buffer.length; i++) output[i] = Math.random() * 2 - 1
          noise.buffer = buffer
          const noiseGain = ctx.createGain()
          noiseGain.gain.setValueAtTime(0.6, ctx.currentTime)
          noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
          const filter = ctx.createBiquadFilter()
          filter.type = 'highpass'
          filter.frequency.setValueAtTime(7000, ctx.currentTime)
          noise.connect(filter).connect(noiseGain).connect(ctx.destination)
          noise.start()
        }
        return
      }

      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      oscillator.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      oscillator.frequency.setValueAtTime(finalFreq, ctx.currentTime)
      oscillator.type = instrument.type

      gain.gain.setValueAtTime(0.45, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000 + 0.3)

      oscillator.start()
      oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.4)
    })

    setActiveKeys(prev => new Set(prev).add(noteLabel))
    setTimeout(() => {
      setActiveKeys(prev => {
        const next = new Set(prev)
        next.delete(noteLabel)
        return next
      })
    }, durationMs)
  }

  const toggleTrackNote = (instrumentId: string, pitchIndex: number, beatIndex: number) => {
    setTracks(prev => {
      const copy = { ...prev }
      copy[instrumentId] = copy[instrumentId].map(row => [...row])
      copy[instrumentId][pitchIndex][beatIndex] = !copy[instrumentId][pitchIndex][beatIndex]
      return copy
    })
  }

  const clearTrack = (instrumentId: string) => {
    setTracks(prev => {
      const copy = { ...prev }
      copy[instrumentId] = Array(NUM_PITCHES).fill(0).map(() => Array(NUM_BEATS).fill(false))
      return copy
    })
  }

  const clearAllTracks = () => {
    setTracks(prev => {
      const copy = { ...prev }
      Object.keys(copy).forEach(id => {
        copy[id] = Array(NUM_PITCHES).fill(0).map(() => Array(NUM_BEATS).fill(false))
      })
      return copy
    })
    setCurrentBeat(-1)
  }

  const loadSweetDreams = () => {
    setTracks(prev => {
      const copy = { ...prev }
      copy['synth'] = Array(NUM_PITCHES).fill(0).map(() => Array(NUM_BEATS).fill(false))
      copy['organ'] = Array(NUM_PITCHES).fill(0).map(() => Array(NUM_BEATS).fill(false))

      const violaRiff = [0, 3, 5, 7, 8, 10, 0, 10, 0, 3, 5, 7, 8, 10, 0, 10]
      violaRiff.forEach((pitch, beat) => copy['synth'][pitch + 12][beat * 2] = true)

      const celloRiff = [0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0]
      celloRiff.forEach((pitch, beat) => copy['organ'][pitch][beat * 2] = true)

      return copy
    })
    alert('🎵 Sweet Dreams riff loaded (Viola + Cello layers)!')
  }

  const playAllTracks = async () => {
    if (isPlaying) return
    setIsPlaying(true)
    setCurrentBeat(-1)

    const beatMs = 60000 / bpm / 2

    for (let beat = 0; beat < NUM_BEATS; beat++) {
      setCurrentBeat(beat)

      Object.keys(tracks).forEach(instrumentId => {
        if (!selectedInstruments.has(instrumentId)) return
        const trackOctave = octaves[instrumentId] || 0
        for (let pitch = 0; pitch < NUM_PITCHES; pitch++) {
          if (tracks[instrumentId][pitch][beat]) {
            const key = pianoKeys[pitch]
            playNote(key.freq, key.note, beatMs * 0.85, trackOctave)
          }
        }
      })
      await new Promise(r => setTimeout(r, beatMs))
    }

    setIsPlaying(false)
    setCurrentBeat(-1)
  }

  useEffect(() => {
    const keyMap: Record<string, { note: string; freq: number }> = {
      a: { note: 'C', freq: 261.63 }, w: { note: 'C#', freq: 277.18 },
      s: { note: 'D', freq: 293.66 }, e: { note: 'D#', freq: 311.13 },
      d: { note: 'E', freq: 329.63 }, f: { note: 'F', freq: 349.23 },
      t: { note: 'F#', freq: 369.99 }, g: { note: 'G', freq: 392.00 },
      y: { note: 'G#', freq: 415.30 }, h: { note: 'A', freq: 440.00 },
      u: { note: 'A#', freq: 466.16 }, j: { note: 'B', freq: 493.88 },
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPlaying) return
      const entry = keyMap[e.key.toLowerCase()]
      if (entry) {
        e.preventDefault()
        playNote(entry.freq, entry.note, 180)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying])

  const toggleInstrument = (id: string) => {
    setSelectedInstruments(prev => {
      const next = new Set(prev)
      next.has(id) && next.size > 1 ? next.delete(id) : next.add(id)
      return next
    })
  }

  const changeOctave = (instrumentId: string, delta: number) => {
    setOctaves(prev => {
      const copy = { ...prev }
      copy[instrumentId] = Math.max(-2, Math.min(2, (copy[instrumentId] || 0) + delta))
      return copy
    })
  }

  const changeLiveOctave = (delta: number) => {
    setLiveOctave(prev => Math.max(-2, Math.min(2, prev + delta)))
  }

  return (
    <div className="piano-app">
      <h1>🎹 Grok Piano — Play & Build</h1>

      <div className="master-controls">
        <button onClick={playAllTracks} disabled={isPlaying} className="master-play-btn">
          {isPlaying ? '⏹️ STOP' : '▶️ PLAY ALL TRACKS'}
        </button>
        <button onClick={loadSweetDreams} className="sweet-dreams-btn">
          🎵 Load Sweet Dreams
        </button>
        <button onClick={clearAllTracks} className="clear-all-btn">🗑️ Clear Everything</button>
        <label>BPM <input type="range" min="60" max="200" value={bpm} onChange={e => setBpm(Number(e.target.value))} /> <strong>{bpm}</strong></label>
      </div>

      <div className="tracks-container">
        {Array.from(selectedInstruments).map(instrumentId => {
          const instrument = instrumentsList.find(i => i.id === instrumentId)!
          return (
            <div key={instrumentId} className="track">
              <div className="track-header">
                <span className="track-name">{instrument.name}</span>
                <div className="octave-control">
                  Octave 
                  <button onClick={() => changeOctave(instrumentId, -1)}>-</button>
                  <strong>{octaves[instrumentId]}</strong>
                  <button onClick={() => changeOctave(instrumentId, 1)}>+</button>
                </div>
                <button onClick={() => clearTrack(instrumentId)} className="clear-track-btn">Clear</button>
              </div>
              <div className="mini-roll">
                {pianoKeys.slice().reverse().map((key, pitchIndex) => (
                  <div key={pitchIndex} className="mini-row">
                    <div className={`mini-label ${key.type}`}>{key.label}<sub>{key.octave}</sub></div>
                    <div className="beat-scroller">
                      {Array.from({ length: NUM_BEATS }, (_, beatIndex) => (
                        <div
                          key={beatIndex}
                          className={`mini-cell ${key.type} 
                            ${tracks[instrumentId][NUM_PITCHES - 1 - pitchIndex][beatIndex] ? 'active' : ''}
                            ${beatIndex === currentBeat ? 'playing' : ''}`}
                          onClick={() => toggleTrackNote(instrumentId, NUM_PITCHES - 1 - pitchIndex, beatIndex)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="live-keyboard">
        <div className="live-header">
          <h3>Live Keyboard (click or A–J keys)</h3>
          <div className="octave-control">
            Octave 
            <button onClick={() => changeLiveOctave(-1)}>-</button>
            <strong>{liveOctave}</strong>
            <button onClick={() => changeLiveOctave(1)}>+</button>
          </div>
        </div>
        <div className="piano">
          {pianoKeys.slice(0, 24).map((key, index) => (
            <button
              key={index}
              className={`piano-key ${key.type} ${activeKeys.has(key.note) ? 'active' : ''}`}
              onClick={() => playNote(key.freq, key.note, 180)}
            >
              {key.label}
            </button>
          ))}
        </div>
      </div>

      <div className="instructions">
        <strong>✅ 3 octaves • 64 beats • live playhead • save/load</strong><br />
        Click cells to draw notes • Use octave buttons • Hit PLAY ALL TRACKS • Load Sweet Dreams to hear the riff
      </div>
    </div>
  )
}

export default App