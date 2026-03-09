import { createRoot } from "react-dom/client";
import { useState } from 'react';

function App() {
  const [display, setDisplay] = useState('0');

  const handleClick = (value: string) => {
    if (value === '=') {
      try {
        setDisplay(eval(display).toString());
      } catch {
        setDisplay('Error');
      }
    } else if (value === 'C') {
      setDisplay('0');
    } else {
      setDisplay(display === '0' ? value : display + value);
    }
  };

  return (
    <div>
      <div style={{ fontSize: '24px', marginBottom: '10px' }}>{display}</div>
      <button onClick={() => handleClick('7')}>7</button>
      <button onClick={() => handleClick('8')}>8</button>
      <button onClick={() => handleClick('9')}>9</button>
      <button onClick={() => handleClick('/')}>/</button>
      <br />
      <button onClick={() => handleClick('4')}>4</button>
      <button onClick={() => handleClick('5')}>5</button>
      <button onClick={() => handleClick('6')}>6</button>
      <button onClick={() => handleClick('*')}>*</button>
      <br />
      <button onClick={() => handleClick('1')}>1</button>
      <button onClick={() => handleClick('2')}>2</button>
      <button onClick={() => handleClick('3')}>3</button>
      <button onClick={() => handleClick('-')}>-</button>
      <br />
      <button onClick={() => handleClick('0')}>0</button>
      <button onClick={() => handleClick('=')}>=</button>
      <button onClick={() => handleClick('+')}>+</button>
      <button onClick={() => handleClick('C')}>C</button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);