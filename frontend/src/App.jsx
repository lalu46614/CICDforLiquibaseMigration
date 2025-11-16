import React from 'react';
import Dashboard from './components/Dashboard';

export default function App() {
  return (
    <div style={{
      fontFamily: "Inter, Arial, sans-serif",
      backgroundColor: "#f5f7fa",
      minHeight: "100vh",
      padding: "0",
      margin: "0"
    }}>
      
      {/* Top Header */}
      <header style={{
        backgroundColor: "#1e293b",
        padding: "16px 24px",
        color: "white",
        fontSize: "24px",
        fontWeight: "600",
        letterSpacing: "0.5px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
      }}>
        Migration Monitoring Dashboard
      </header>

      {/* Main Content */}
      <main style={{
        padding: "32px",
        maxWidth: "1400px",
        margin: "0 auto"
      }}>
        <Dashboard />
      </main>

    </div>
  );
}
