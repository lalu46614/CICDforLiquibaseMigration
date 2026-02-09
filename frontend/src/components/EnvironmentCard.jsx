import React from 'react';
export default function EnvironmentCard({name, latest, dbStatus, isSelected, onClick}){
  const statusColor = dbStatus && dbStatus.ok ? '#2e7d32' : '#d32f2f';
  const statusText = dbStatus && dbStatus.ok ? '✅ Connected' : '🔴 Down';
  
  return (
    <div 
      className="card" 
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        border: isSelected ? '2px solid #007bff' : '1px solid #ddd',
        backgroundColor: isSelected ? '#f0f7ff' : 'white',
        transition: 'all 0.2s'
      }}
    >
      <h3 style={{
        textTransform:'uppercase',
        marginTop: 0,
        color: isSelected ? '#007bff' : '#333'
      }}>
        {name}
      </h3>
      <div style={{marginTop:12}}>
        <div style={{marginBottom:8}}>
          DB status: <strong style={{color: statusColor}}>{statusText}</strong>
          {dbStatus && !dbStatus.ok && dbStatus.error && (
            <div style={{fontSize: 11, color: '#666', marginTop: 4}}>
              {dbStatus.error}
            </div>
          )}
        </div>
        <div style={{marginTop:8, fontSize: 13, color: '#666'}}>
          {latest ? (
            <>
              <div><strong>Last change:</strong> {latest.id}</div>
              <div style={{marginTop: 4}}>by {latest.author}</div>
              <div style={{fontSize: 11, color: '#888'}}>
                {latest.dateexecuted ? new Date(latest.dateexecuted).toLocaleString('en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZoneName: 'short'
                }) : 'N/A'}
              </div>
            </>
          ) : (
            <div>No migrations applied</div>
          )}
        </div>
      </div>
    </div>
  );
}
