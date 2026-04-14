import React, { useEffect, useRef, useState, useCallback } from 'react';
import './index.css';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const formatTime = (secs: number): string => {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('audio/')) {
      alert('Please select a valid audio file (MP3, WAV, OGG, etc.)');
      return;
    }
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.load();
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioContext) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 128;
      analyserNode.smoothingTimeConstant = 0.85;

      const source = ctx.createMediaElementSource(audio);
      source.connect(analyserNode);
      analyserNode.connect(ctx.destination);

      setAudioContext(ctx);
      setAnalyser(analyserNode);
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  };

  const draw = useCallback(() => {
    if (!analyser || !canvasRef.current) {
      animationRef.current = requestAnimationFrame(draw);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = 'rgba(10, 10, 10, 0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 1.9;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const height = (dataArray[i] / 255) * canvas.height * 0.82;
      const hue = 260 + (i / bufferLength) * 80;

      ctx.fillStyle = `hsl(${hue}, 95%, 68%)`;
      ctx.fillRect(x, canvas.height - height, barWidth - 3, height);

      if (dataArray[i] > 190) {
        ctx.fillStyle = `hsla(${hue}, 100%, 90%, 0.35)`;
        ctx.fillRect(x - 3, canvas.height - height - 12, barWidth + 6, height + 24);
      }
      x += barWidth + 2;
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [analyser]);

  useEffect(() => {
    if (analyser) draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, draw]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnd = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnd);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  return (
    <div className="visualizer-container bg-zinc-950">
      <canvas ref={canvasRef} className="canvas" />

      <audio ref={audioRef} />

      {/* Title */}
      <div className="absolute top-8 left-8 z-20">
        <div className="text-6xl font-black tracking-[-3px] bg-gradient-to-br from-violet-400 via-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
          VOLT VIZ
        </div>
        <div className="text-zinc-500 text-sm tracking-widest mt-1">MUSIC VISUALIZER</div>
      </div>

      {/* Main Control Panel */}
      <div className="control-panel bottom-10 left-1/2 -translate-x-1/2 rounded-3xl p-8 w-[460px] shadow-2xl">
        {!audioFile ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => document.getElementById('audio-upload')?.click()}
            className="border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-2xl p-14 text-center cursor-pointer transition-all hover:bg-zinc-900/50"
          >
            <div className="mx-auto text-6xl mb-6">🎧</div>
            <p className="text-xl font-medium mb-2">Drop your track here</p>
            <p className="text-zinc-400">MP3 • WAV • OGG supported</p>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        ) : (
          <>
            <div className="text-center mb-5">
              <p className="font-medium truncate text-lg">{audioFile.name}</p>
            </div>

            <div className="mb-6">
              <input
                type="range"
                min={0}
                max={duration}
                value={currentTime}
                onChange={(e) => { if (audioRef.current) audioRef.current.currentTime = +e.target.value; }}
                className="w-full accent-violet-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-zinc-400 mt-1.5">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <button
              onClick={togglePlay}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 font-semibold text-xl flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>

            <button
              onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                setAudioFile(null);
                setIsPlaying(false);
                setCurrentTime(0);
              }}
              className="mt-4 w-full text-sm text-zinc-400 hover:text-zinc-200"
            >
              Load another song
            </button>
          </>
        )}
      </div>

      {!audioFile && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-zinc-500 text-sm z-10">
          Drag & drop an audio file or click the area above
        </div>
      )}
    </div>
  );
};

export default App;