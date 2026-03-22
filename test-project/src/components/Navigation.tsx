import React from 'react';

const Navigation = () => {
  return (
    <nav style={{ backgroundColor: 'blue', color: 'white', padding: '10px', display: 'flex', justifyContent: 'center' }}>
      <a href="/dashboard" style={{ margin: '0 15px', color: 'white', textDecoration: 'none' }}>Dashboard</a>
      <a href="/metrics" style={{ margin: '0 15px', color: 'white', textDecoration: 'none' }}>Metrics</a>
      <a href="/settings" style={{ margin: '0 15px', color: 'white', textDecoration: 'none' }}>Settings</a>
    </nav>
  );
};

export default Navigation;
