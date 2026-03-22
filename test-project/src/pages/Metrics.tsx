import React, { useState } from 'react';

const Metrics = () => {
  const [refreshed, setRefreshed] = useState(false);

  const handleRefresh = () => {
    setRefreshed(!refreshed);
    // Simulate refresh; metrics remain static
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center' }}>Metrics Dashboard</h1>
      <button 
        onClick={handleRefresh} 
        style={{ 
          display: 'block', 
          margin: '0 auto 20px', 
          padding: '10px 20px', 
          backgroundColor: 'green', 
          color: 'white', 
          border: 'none', 
          cursor: 'pointer' 
        }}
      >
        Refresh
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <div style={{ border: '1px solid #ccc', padding: '15px', width: '200px', textAlign: 'center' }}>
          <h2>Total Users</h2>
          <p>1,234</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '15px', width: '200px', textAlign: 'center' }}>
          <h2>Revenue</h2>
          <p>$5,678</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '15px', width: '200px', textAlign: 'center' }}>
          <h2>Active Sessions</h2>
          <p>89</p>
        </div>
      </div>
    </div>
  );
};

export default Metrics;
