import { useState } from 'react'
import './App.css'

function App() {
  const [input, setInput] = useState('')

  const keys = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ]

  const handleKeyClick = (key: string) => {
    setInput(prev => prev + key)
  }

  const handleBackspace = () => {
    setInput(prev => prev.slice(0, -1))
  }

  const handleClear = () => {
    setInput('')
  }

  return (
    <div className="keyboard-app">
      <div className="header">
        <h1>🧠 Grok Keyboard</h1>
        <p className="tagline">Maximum truth • Maximum helpfulness</p>
      </div>

      <input 
        type="text" 
        value={input} 
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type here or tap the keys below..."
        className="input-display"
        spellCheck={false}
      />
      
      <div className="keyboard">
        {keys.map((row, i) => (
          <div key={i} className="row">
            {row.map(key => (
              <button 
                key={key} 
                className="key"
                onClick={() => handleKeyClick(key)}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
        
        {/* Bottom row with special keys */}
        <div className="row">
          <button className="key special" onClick={handleBackspace}>⌫</button>
          <button className="key special wide" onClick={handleClear}>CLEAR</button>
          <button className="key special" onClick={() => handleKeyClick(' ')}>␣</button>
        </div>
      </div>

      <div className="footer">
        <p>Built as a browser-only Grok keyboard • Powered by xAI</p>
      </div>
    </div>
  )
}

export default App