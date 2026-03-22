import React from 'react';
import Navigation from './components/Navigation';
import Metrics from './pages/Metrics';

const App = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
      <Navigation />
      <Metrics />
    </div>
  );
};

export default App;
