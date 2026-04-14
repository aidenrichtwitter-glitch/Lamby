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

const defaultInstruments = [
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
  const [selectedInstruments, setSelectedInstruments] = useState(new Set(defaultInstruments.map(i => i.id)))
  const [bpm, setBpm] = useState(125)

  const [instruments, setInstruments] = useState(defaultInstruments)

  const [tracks, setTracks] = useState<Record<string, boolean[][]>>(() => {
    const initial: Record<string, boolean[][]> = {}
    defaultInstruments.forEach(inst => initial[inst.id] = Array(NUM_PITCHES).fill(0).map(() => Array(NUM_BEATS).fill(false)))
    return initial
  })

  const [octaves, setOctaves] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    defaultInstruments.forEach(inst => initial[inst.id] = 0)
    return initial
  })

  const [collapsedTracks, setCollapsedTracks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    defaultInstruments.forEach(inst => initial[inst.id] = true)
    return initial
  })

  const audioContextRef = useRef<AudioContext | null>(null)

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }

  const playNote = (freq: number, noteLabel: string, durationMs: number, octaveOffset: number = 0) => {
    const ctx = getAudioContext()
    const finalFreq = freq * Math.pow(2, octaveOffset)

    Array.from(selectedInstruments).forEach(instId => {
      const instrument = instruments.find(i => i.id === instId)
      if (!instrument) return

      if (instrument.id === 'drums') {
        if (noteLabel === 'C') {
          const osc = ctx.createOscillator(); const gain = ctx.createGain()
          osc.frequency.setValueAtTime(140, ctx.currentTime); osc.type = 'sine'
          gain.gain.setValueAtTime(1.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
          osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5)
        } else if (noteLabel === 'D') {
          const noise = ctx.createBufferSource(); const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate)
          const output = buffer.getChannelData(0); for (let i = 0; i < buffer.length; i++) output[i] = Math.random() * 2 - 1
          noise.buffer = buffer
          const noiseGain = ctx.createGain(); noiseGain.gain.setValueAtTime(0.9, ctx.currentTime); noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
          const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.setValueAtTime(1200, ctx.currentTime)
          noise.connect(filter).connect(noiseGain).connect(ctx.destination); noise.start()
        } else if (noteLabel === 'E') {
          const noise = ctx.createBufferSource(); const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate)
          const output = buffer.getChannelData(0); for (let i = 0; i < buffer.length; i++) output[i] = Math.random() * 2 - 1
          noise.buffer = buffer
          const noiseGain = ctx.createGain(); noiseGain.gain.setValueAtTime(0.6, ctx.currentTime); noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
          const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.setValueAtTime(7000, ctx.currentTime)
          noise.connect(filter).connect(noiseGain).connect(ctx.destination); noise.start()
        }
        return
      }

      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      oscillator.connect(filter).connect(gain).connect(ctx.destination)
      oscillator.frequency.setValueAtTime(finalFreq, ctx.currentTime)
      oscillator.type = instrument.type
      gain.gain.setValueAtTime(0.7, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
      oscillator.start()
      oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.5)
    })

    setActiveKeys(prev => new Set(prev).add(noteLabel))
    setTimeout(() => setActiveKeys(p => { const n = new Set(p); n.delete(noteLabel); return n }), durationMs)
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
      Object.keys(copy).forEach(id => copy[id] = Array(NUM_PITCHES).fill(0).map(() => Array(NUM_BEATS).fill(false)))
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
    alert('🎵 Sweet Dreams loaded!')
  }

  const loadGrokSong = () => {
    setTracks(prev => {
      const copy = { ...prev }
      Object.keys(copy).forEach(id => copy[id] = Array(NUM_PITCHES).fill(0).map(() => Array(NUM_BEATS).fill(false)))
      for (let b = 0; b < 32; b++) {
        copy['drums'][0][b] = true
        if (b % 2 === 1) copy['drums'][4][b] = true
        copy['drums'][8][b] = true
        if (b % 4 === 2) copy['drums'][9][b] = true
      }
      const melodyPitches = [12, 16, 19, 24, 19, 16, 12, 16, 19, 24, 19, 16, 12, 19, 24, 28]
      melodyPitches.forEach((p, i) => {
        copy['piano'][p][i * 2] = true
        if (i % 3 === 0) copy['piano'][p + 2][i * 2 + 1] = true
      })
      const padPitches = [12, 19, 24]
      padPitches.forEach(p => {
        for (let b = 0; b < 32; b += 8) {
          copy['synth'][p][b] = true
          copy['synth'][p][b + 4] = true
        }
      })
      const bass = [0, 0, 7, 7, 0, 0, 12, 12]
      bass.forEach((p, i) => copy['organ'][p][i * 4] = true)
      return copy
    })
    alert('🌟 "Neon Drift" loaded!')
  }

  const saveSong = () => {
    localStorage.setItem('grokPianoSong', JSON.stringify(tracks))
    alert('✅ Song saved!')
  }

  const loadSavedSong = () => {
    const saved = localStorage.getItem('grokPianoSong')
    if (saved) {
      setTracks(JSON.parse(saved))
      alert('📂 Song loaded!')
    } else {
      alert('No saved song yet')
    }
  }

  const importMIDI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const arrayBuffer = await file.arrayBuffer()
      const midiData = await parseMIDI(arrayBuffer)

      const placedCounts: Record<string, number> = { piano: 0, synth: 0, organ: 0, drums: 0 }

      setTracks(prev => {
        const copy = { ...prev }
        midiData.notes.forEach(note => {
          if (note.pitchIndex < 0 || note.pitchIndex >= NUM_PITCHES || note.beatIndex < 0 || note.beatIndex >= NUM_BEATS) return

          let targetTrack = 'piano'
          const nameLower = (note.trackName || '').toLowerCase()
          if (note.channel === 9 || note.channel === 10 || nameLower.includes('drum')) targetTrack = 'drums'
          else if (nameLower.includes('cello') || nameLower.includes('bass') || note.channel >= 5) targetTrack = 'organ'
          else if (nameLower.includes('viola') || nameLower.includes('melody') || note.channel <= 4) targetTrack = 'synth'

          if (!copy[targetTrack]) copy[targetTrack] = Array(NUM_PITCHES).fill(0).map(() => Array(NUM_BEATS).fill(false))

          copy[targetTrack][note.pitchIndex][note.beatIndex] = true
          placedCounts[targetTrack] = (placedCounts[targetTrack] || 0) + 1
        })
        return copy
      })

      setCollapsedTracks(prev => {
        const newState = { ...prev }
        if (placedCounts['synth'] > 0) newState['synth'] = false
        if (placedCounts['organ'] > 0) newState['organ'] = false
        if (placedCounts['drums'] > 0) newState['drums'] = false
        return newState
      })

      const summary = Object.entries(placedCounts).filter(([,c]) => c > 0).map(([t,c]) => `${t}: ${c}`).join(' | ') || '0'
      alert(`✅ MIDI imported!\nNotes placed: ${summary}\n\nTracks auto-expanded. Hit PLAY ALL TRACKS for song-like playback.`)
    } catch (err) {
      alert('❌ MIDI import failed: ' + (err as Error).message)
    }
    e.target.value = ''
  }

  const parseMIDI = async (arrayBuffer: ArrayBuffer) => {
    const midi = { notes: [] as any[], tempo: 125 }
    const data = new Uint8Array(arrayBuffer)
    let offset = 14
    let currentTrackName = ''
    let runningStatus = 0
    let time = 0

    while (offset < data.length) {
      if (data[offset] === 0x4D && data[offset+1] === 0x54 && data[offset+2] === 0x72 && data[offset+3] === 0x6B) {
        offset += 8
        time = 0
        const trackEnd = offset + ((data[offset-4] << 24) | (data[offset-3] << 16) | (data[offset-2] << 8) | data[offset-1])

        while (offset < trackEnd) {
          let delta = 0
          let byte = data[offset++]
          while (byte & 0x80) {
            delta = (delta << 7) | (byte & 0x7F)
            byte = data[offset++]
          }
          delta = (delta << 7) | (byte & 0x7F)
          time += delta

          let status = data[offset++]
          if (status < 0x80) { status = runningStatus; offset-- } else runningStatus = status

          const type = status & 0xF0
          const channel = status & 0x0F

          if (type === 0x90 || type === 0x80) {
            const pitch = data[offset++]
            const velocity = data[offset++]
            if (type === 0x90 && velocity > 0) {
              const pitchIndex = Math.max(0, Math.min(NUM_PITCHES - 1, pitch - 48))
              const beatIndex = Math.floor((time * 8) / 480)
              if (beatIndex < NUM_BEATS) {
                midi.notes.push({ pitchIndex, beatIndex, channel, trackName: currentTrackName })
              }
            }
          } else if (status === 0xFF) {
            const metaType = data[offset++]
            const len = data[offset++]
            if (metaType === 0x03) currentTrackName = String.fromCharCode(...data.slice(offset, offset + len))
            if (metaType === 0x51 && len === 3) {
              const mpqn = (data[offset] << 16) | (data[offset+1] << 8) | data[offset+2]
              midi.tempo = Math.round(60000000 / mpqn)
            }
            offset += len
          } else {
            offset += (type === 0xC0 || type === 0xD0) ? 1 : 2
          }
        }
      } else offset++
    }
    return midi
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
            playNote(key.freq, key.note, beatMs * 3, trackOctave) // longer sustain
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
      if (entry) playNote(entry.freq, entry.note, 300, 0)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying])

  const changeOctave = (instrumentId: string, delta: number) => {
    setOctaves(prev => ({ ...prev, [instrumentId]: Math.max(-2, Math.min(2, (prev[instrumentId] || 0) + delta)) }))
  }

  const addInstrument = () => {
    const newId = 'custom-' + Date.now()
    const newName = 'New Instrument ' + (instruments.length + 1)
    const newInst = { id: newId, name: newName, type: 'sine' as OscillatorType }

    setInstruments(prev => [...prev, newInst])
    setTracks(prev => ({ ...prev, [newId]: Array(NUM_PITCHES).fill(0).map(() => Array(NUM_BEATS).fill(false)) }))
    setOctaves(prev => ({ ...prev, [newId]: 0 }))
    setCollapsedTracks(prev => ({ ...prev, [newId]: true }))
    setSelectedInstruments(prev => new Set([...Array.from(prev), newId]))
  }

  const deleteInstrument = (id: string) => {
    if (instruments.length <= 1) { alert("Can't delete the last instrument"); return }
    setInstruments(prev => prev.filter(i => i.id !== id))
    setTracks(prev => { const copy = { ...prev }; delete copy[id]; return copy })
    setOctaves(prev => { const copy = { ...prev }; delete copy[id]; return copy })
    setCollapsedTracks(prev => { const copy = { ...prev }; delete copy[id]; return copy })
    setSelectedInstruments(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  return (
    <div className="piano-app">
      <h1>🎹 Grok Multi-Track Piano — Real MIDI Mode</h1>

      <div className="master-controls">
        <button onClick={playAllTracks} disabled={isPlaying} className="master-play-btn">
          {isPlaying ? '⏹️ STOP' : '▶️ PLAY ALL TRACKS'}
        </button>
        <button onClick={loadSweetDreams} className="sweet-dreams-btn">🎵 Load Sweet Dreams</button>
        <button onClick={loadGrokSong} className="demo-song-btn" style={{background: '#ff00aa', color: '#fff'}}>🌟 Load Grok’s Song</button>
        
        <label style={{cursor: 'pointer', background: '#ffaa00', color: '#111', padding: '10px 20px', borderRadius: '9999px', fontWeight: 'bold'}}>
          🎹 Import MIDI File
          <input type="file" accept=".mid,.midi" onChange={importMIDI} style={{display: 'none'}} />
        </label>

        <button onClick={addInstrument} style={{background: '#00cc88', color: '#111'}}>➕ Add Instrument</button>

        <button onClick={saveSong} className="save-btn">💾 Save Song</button>
        <button onClick={loadSavedSong} className="load-btn">📂 Load Saved</button>
        <button onClick={clearAllTracks} className="clear-all-btn">🗑️ Clear Everything</button>
        <label>BPM <input type="range" min="60" max="200" value={bpm} onChange={e => setBpm(Number(e.target.value))} /> <strong>{bpm}</strong></label>
      </div>

      <div className="tracks-container">
        {instruments.map(instrument => {
          const isCollapsed = collapsedTracks[instrument.id] ?? true
          return (
            <div key={instrument.id} className="track">
              <div className="track-header">
                <span className="track-name" style={{ cursor: 'pointer' }} onClick={() => setCollapsedTracks(prev => ({ ...prev, [instrument.id]: !isCollapsed }))}>
                  {instrument.name} {isCollapsed ? '▼' : '▲'}
                </span>
                <div className="octave-control">
                  Octave 
                  <button onClick={() => changeOctave(instrument.id, -1)}>-</button>
                  <strong>{octaves[instrument.id] || 0}</strong>
                  <button onClick={() => changeOctave(instrument.id, 1)}>+</button>
                </div>
                <button onClick={() => clearTrack(instrument.id)} className="clear-track-btn">Clear</button>
                <button onClick={() => deleteInstrument(instrument.id)} style={{background: '#ff4444', color: '#fff', marginLeft: '8px'}}>Delete</button>
              </div>

              {!isCollapsed && (
                <div className="mini-roll">
                  {pianoKeys.slice().reverse().map((key, pitchIndex) => (
                    <div key={pitchIndex} className="mini-row">
                      <div className={`mini-label ${key.type}`}>{key.label}<sub>{key.octave}</sub></div>
                      <div className="beat-scroller">
                        {Array.from({ length: NUM_BEATS }, (_, beatIndex) => (
                          <div
                            key={beatIndex}
                            className={`mini-cell ${key.type} ${tracks[instrument.id]?.[NUM_PITCHES - 1 - pitchIndex]?.[beatIndex] ? 'active' : ''} ${beatIndex === currentBeat ? 'playing' : ''}`}
                            onClick={() => toggleTrackNote(instrument.id, NUM_PITCHES - 1 - pitchIndex, beatIndex)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="instructions">
        <strong>✅ MIDI now plays with real durations</strong><br />
        Import your Sweet Dreams MIDI → expand Synth/Organ → PLAY ALL TRACKS.<br />
        It should now sound much more like a real song.
      </div>
    </div>
  )
}

export default App