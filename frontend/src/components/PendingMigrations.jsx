import React, {useEffect, useState} from 'react';
import { getPending, executeMigration } from '../api';

export default function PendingMigrations({env='dev', onMigrationComplete}){
  const [pending, setPending] = useState([]);
  const [running, setRunning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [currentMigration, setCurrentMigration] = useState(null);

  async function load(){ 
    try{ 
      const res = await getPending(env); 
      setPending(res.pending || []); 
    }catch(e){ 
      console.error(e); 
    } 
  }

  useEffect(()=>{ load(); }, [env]);

  function closeModal(){
    setShowModal(false);
    setModalContent(null);
    setCurrentMigration(null);
  }

  async function runOne(migration){
    if(!migration) return;
    
    const confirmMsg = `Execute migration "${migration.id}" (${migration.description || migration.filename}) on ${env.toUpperCase()}?`;
    if(!window.confirm(confirmMsg)) return;
    
    setRunning(true);
    setCurrentMigration(migration);
    
    try{
      // Ensure we send the filename with "changelogs/" prefix if not already present
      let changelogFile = migration.filename;
      if (!changelogFile.startsWith('changelogs/')) {
        changelogFile = `changelogs/${changelogFile}`;
      }
      
      const r = await executeMigration({env, changelogFile: changelogFile});
      
      // Show modal with full output
      const output = r.output || '';
      const warnings = r.warnings || '';
      const fullOutput = warnings ? `${output}\n\n--- Warnings ---\n${warnings}` : output;
      
      setModalContent({
        title: `Migration "${migration.id}" completed`,
        content: fullOutput || 'Migration executed successfully (no output)',
        isError: false
      });
      setShowModal(true);
      
      // Refresh pending list and notify parent
      await load();
      if (onMigrationComplete) {
        onMigrationComplete();
      }
    }catch(e){ 
      const errorMsg = e.response?.data?.error || e.message || 'Unknown error';
      const errorOutput = e.response?.data?.stdout || '';
      const errorStderr = e.response?.data?.stderr || '';
      const fullError = errorOutput || errorStderr ? 
        `${errorMsg}\n\n--- Output ---\n${errorOutput}\n\n--- Error Details ---\n${errorStderr}` : 
        errorMsg;
      
      setModalContent({
        title: `Migration "${migration.id}" failed`,
        content: fullError,
        isError: true
      });
      setShowModal(true);
    }
    setRunning(false);
  }

  return (
    <div className="card">
      {pending.length === 0 ? (
        <div style={{padding: '12px', color: '#666'}}>No pending migrations</div>
      ) : (
        <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
          {pending.map(p => (
            <li key={p.id} style={{
              marginBottom: 12, 
              padding: 12, 
              border: '1px solid #ddd', 
              borderRadius: 4,
              backgroundColor: '#f9f9f9'
            }}>
              <div style={{marginBottom: 8}}>
                <strong style={{color: '#333'}}>{p.id}</strong>
                {p.description && (
                  <span style={{color: '#666', marginLeft: 8}}>— {p.description}</span>
                )}
              </div>
              <div style={{fontSize: 12, color: '#888', marginBottom: 8}}>
                File: {p.filename}
              </div>
              <button 
                onClick={()=>runOne(p)} 
                disabled={running}
                style={{
                  padding: '6px 12px',
                  backgroundColor: running ? '#ccc' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: running ? 'not-allowed' : 'pointer'
                }}
              >
                {running && currentMigration?.id === p.id ? 'Running...' : 'Run'}
              </button>
            </li>
          ))}
        </ul>
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
