import React, {useEffect, useState} from 'react';
import { getRollbackHistory, rollbackMigration } from '../api';

export default function RollbackHistory({env}){
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [running, setRunning] = useState(false);

  async function load(){
    try{
      const res = await getRollbackHistory(env);
      console.log('Rollback history response:', res);
      setHistory(res);
    }catch(e){
      console.error('Error loading rollback history:', e);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{ 
    load(); 
    // Auto-refresh every 15 seconds to see new rollbacks
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [env]);

  function closeModal(){
    setShowModal(false);
    setModalContent(null);
  }

  async function executeRollback(rollbackTag, rollbackEnv){
    const confirmMsg = `Rollback to tag "${rollbackTag}" on ${rollbackEnv.toUpperCase()}?`;
    if(!window.confirm(confirmMsg)) return;
    
    setRunning(true);
    try{
      const r = await rollbackMigration({env: rollbackEnv, tag: rollbackTag});
      const output = r.output || '';
      const warnings = r.warnings || '';
      const fullOutput = warnings ? `${output}\n\n--- Warnings ---\n${warnings}` : output;
      
      setModalContent({
        title: `Rollback to "${rollbackTag}" completed`,
        content: fullOutput || 'Rollback executed successfully',
        isError: false
      });
      setShowModal(true);
      load();
    }catch(e){
      const errorMsg = e.response?.data?.error || e.message || 'Unknown error';
      const errorOutput = e.response?.data?.stdout || '';
      const errorStderr = e.response?.data?.stderr || '';
      const fullError = errorOutput || errorStderr ? 
        `${errorMsg}\n\n--- Output ---\n${errorOutput}\n\n--- Error Details ---\n${errorStderr}` : 
        errorMsg;
      
      setModalContent({
        title: `Rollback to "${rollbackTag}" failed`,
        content: fullError,
        isError: true
      });
      setShowModal(true);
    }
    setRunning(false);
  }

  if(loading) return <div className="card">Loading rollback history...</div>;

  const allRollbacks = [];
  Object.entries(history).forEach(([envName, rollbacks]) => {
    if (Array.isArray(rollbacks)) {
      rollbacks.forEach(r => {
        allRollbacks.push({...r, env: r.env || envName});
      });
    }
  });
  allRollbacks.sort((a, b) => {
    const dateA = a.rolled_back_at ? new Date(a.rolled_back_at) : new Date(0);
    const dateB = b.rolled_back_at ? new Date(b.rolled_back_at) : new Date(0);
    return dateB - dateA;
  });

  return (
    <div className="card">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
        <h3 style={{margin: 0}}>Rollback History {env ? `(${env.toUpperCase()})` : '(All Environments)'}</h3>
        <button 
          onClick={load}
          style={{
            padding: '6px 12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          Refresh
        </button>
      </div>
      {allRollbacks.length === 0 ? (
        <div style={{padding: 12, color: '#666'}}>No rollback history</div>
      ) : (
        <div style={{overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 14}}>
            <thead>
              <tr style={{backgroundColor: '#f5f5f5'}}>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Environment</th>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Changeset</th>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Author</th>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Filename</th>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Rollback Tag</th>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Rolled Back At</th>
                <th style={{padding: 12, textAlign: 'center', border: '1px solid #ddd'}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {allRollbacks.map((r, idx) => (
                <tr key={idx}>
                  <td style={{padding: 12, border: '1px solid #ddd'}}>{r.env.toUpperCase()}</td>
                  <td style={{padding: 12, border: '1px solid #ddd'}}><strong>{r.changeset_id || r.tag}</strong></td>
                  <td style={{padding: 12, border: '1px solid #ddd'}}>{r.author || 'N/A'}</td>
                  <td style={{padding: 12, border: '1px solid #ddd'}}>{r.filename || 'N/A'}</td>
                  <td style={{padding: 12, border: '1px solid #ddd'}}>{r.rollback_tag || r.tag || 'N/A'}</td>
                  <td style={{padding: 12, border: '1px solid #ddd'}}>
                    {new Date(r.rolled_back_at || r.executed_at).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      timeZoneName: 'short'
                    })}
                  </td>
                  <td style={{padding: 12, textAlign: 'center', border: '1px solid #ddd'}}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      backgroundColor: r.status === 'SUCCESS' ? '#d4edda' : '#f8d7da',
                      color: r.status === 'SUCCESS' ? '#155724' : '#721c24',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}>
                      {r.status || 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: 24,
            borderRadius: 8,
            maxWidth: '80%',
            maxHeight: '80%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              borderBottom: '1px solid #eee',
              paddingBottom: 12
            }}>
              <h3 style={{margin: 0, color: modalContent.isError ? '#d32f2f' : '#2e7d32'}}>
                {modalContent.title}
              </h3>
              <button 
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: 12,
              backgroundColor: '#f5f5f5',
              borderRadius: 4,
              fontFamily: 'monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '60vh',
              border: `1px solid ${modalContent.isError ? '#ffcdd2' : '#c8e6c9'}`
            }}>
              {modalContent.content}
            </div>
            <div style={{marginTop: 16, textAlign: 'right'}}>
              <button 
                onClick={closeModal}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

