import { useState, useRef, KeyboardEvent } from 'react';

const GrokKeyboard = () => {
  const [text, setText] = useState('');
  const [isCaps, setIsCaps] = useState(false);
  const [isShift, setIsShift] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const numberRow = [
    { key: '1', shift: '!' },
    { key: '2', shift: '@' },
    { key: '3', shift: '#' },
    { key: '4', shift: '$' },
    { key: '5', shift: '%' },
    { key: '6', shift: '^' },
    { key: '7', shift: '&' },
    { key: '8', shift: '*' },
    { key: '9', shift: '(' },
    { key: '0', shift: ')' },
  ];

  const row1 = 'qwertyuiop'.split('');
  const row2 = 'asdfghjkl'.split('');
  const row3 = 'zxcvbnm'.split('');

  const handleKeyPress = (key: string) => {
    let char = key;

    if (/^[a-z]$/.test(key)) {
      // Letter
      char = (isCaps || isShift) ? key.toUpperCase() : key;
      setText((prev) => prev + char);
    } else if (numberRow.some((n) => n.key === key || n.shift === key)) {
      // Number/symbol
      const numKey = numberRow.find((n) => n.key === key || n.shift === key);
      if (numKey) {
        char = isShift ? numKey.shift : numKey.key;
        setText((prev) => prev + char);
      }
    } else if (key === 'Backspace') {
      setText((prev) => prev.slice(0, -1));
    } else if (key === 'Space') {
      setText((prev) => prev + ' ');
    } else if (key === 'Enter') {
      setText((prev) => prev + '\n');
    } else if (key === 'Tab') {
      setText((prev) => prev + '\t');
    }

    // Release shift after use (unless caps is on)
    if (isShift && !isCaps) setIsShift(false);
  };

  const toggleCaps = () => {
    setIsCaps((prev) => !prev);
  };

  const toggleShift = () => {
    setIsShift((prev) => !prev);
  };

  const clearText = () => {
    setText('');
    textareaRef.current?.focus();
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow normal typing in the textarea as fallback
    if (e.key === 'Backspace' || e.key === 'Enter') return;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 font-mono">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold tracking-tighter flex items-center gap-3">
            <span className="text-emerald-400">⌨️</span>
            GROK KEYBOARD
          </h1>
          <button
            onClick={clearText}
            className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            CLEAR
          </button>
        </div>

        {/* Display */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder="Type here... or use the keyboard below"
          className="w-full h-40 bg-zinc-900 border border-zinc-700 focus:border-emerald-400 rounded-3xl p-6 text-2xl resize-none outline-none font-light leading-relaxed mb-8 shadow-inner"
          spellCheck={false}
        />

        {/* Keyboard */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl">
          {/* Number row */}
          <div className="flex gap-1.5 mb-2 justify-center flex-wrap">
            {numberRow.map(({ key, shift }) => (
              <button
                key={key}
                data-key={key}
                onClick={() => handleKeyPress(isShift ? shift : key)}
                className="keyboard-key min-w-[42px] h-12 bg-zinc-800 hover:bg-zinc-700 active:bg-emerald-400 active:text-zinc-950 text-lg font-medium rounded-2xl flex items-center justify-center transition-all border border-zinc-700"
              >
                {isShift ? shift : key}
              </button>
            ))}
          </div>

          {/* Row 1 */}
          <div className="flex gap-1.5 mb-2 justify-center flex-wrap">
            {row1.map((key) => (
              <button
                key={key}
                data-key={key}
                onClick={() => handleKeyPress(key)}
                className="keyboard-key min-w-[42px] h-12 bg-zinc-800 hover:bg-zinc-700 active:bg-emerald-400 active:text-zinc-950 text-lg font-medium rounded-2xl flex items-center justify-center transition-all border border-zinc-700"
              >
                {(isCaps || isShift) ? key.toUpperCase() : key}
              </button>
            ))}
          </div>

          {/* Row 2 */}
          <div className="flex gap-1.5 mb-2 justify-center flex-wrap">
            {row2.map((key) => (
              <button
                key={key}
                data-key={key}
                onClick={() => handleKeyPress(key)}
                className="keyboard-key min-w-[42px] h-12 bg-zinc-800 hover:bg-zinc-700 active:bg-emerald-400 active:text-zinc-950 text-lg font-medium rounded-2xl flex items-center justify-center transition-all border border-zinc-700"
              >
                {(isCaps || isShift) ? key.toUpperCase() : key}
              </button>
            ))}
          </div>

          {/* Row 3 */}
          <div className="flex gap-1.5 mb-2 justify-center flex-wrap">
            {/* Shift */}
            <button
              onClick={toggleShift}
              className={`keyboard-key min-w-[52px] h-12 px-4 text-sm font-medium rounded-2xl flex items-center justify-center transition-all border border-zinc-700 ${
                isShift ? 'bg-emerald-400 text-zinc-950' : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              SHIFT
            </button>

            {row3.map((key) => (
              <button
                key={key}
                data-key={key}
                onClick={() => handleKeyPress(key)}
                className="keyboard-key min-w-[42px] h-12 bg-zinc-800 hover:bg-zinc-700 active:bg-emerald-400 active:text-zinc-950 text-lg font-medium rounded-2xl flex items-center justify-center transition-all border border-zinc-700"
              >
                {(isCaps || isShift) ? key.toUpperCase() : key}
              </button>
            ))}

            {/* Backspace */}
            <button
              data-key="Backspace"
              onClick={() => handleKeyPress('Backspace')}
              className="keyboard-key min-w-[68px] h-12 px-4 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 active:bg-red-400 active:text-white rounded-2xl flex items-center justify-center transition-all border border-zinc-700"
            >
              ⌫
            </button>
          </div>

          {/* Bottom row */}
          <div className="flex gap-1.5 justify-center flex-wrap">
            {/* Caps Lock */}
            <button
              onClick={toggleCaps}
              className={`keyboard-key min-w-[68px] h-12 px-4 text-xs font-medium rounded-2xl flex items-center justify-center transition-all border border-zinc-700 ${
                isCaps ? 'bg-emerald-400 text-zinc-950' : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              Caps Lock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};