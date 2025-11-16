import React, {useEffect, useState} from 'react';
import { getHistory, rollbackOne } from '../api';

export default function MigrationsTimeline({env='dev', onRefresh, onRollbackComplete}){
  const [history, setHistory] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [rollingBack, setRollingBack] = useState(null);

  async function load(){ 
    try{ 
      const r = await getHistory(env); 
      setHistory(r.history || []); 
    }catch(e){ 
      console.error(e); 
    } 
  }

  useEffect(()=>{ load(); }, [env]);
  useEffect(()=>{ if(onRefresh) load(); }, [onRefresh]);

  function toggleExpand(id){
    const newExpanded = new Set(expanded);
    if(newExpanded.has(id)){
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  }

  function closeModal(){
    setShowModal(false);
    setModalContent(null);
    setRollingBack(null);
  }

  async function handleRollback(migration){
    if(!migration) return;
    
    const confirmMsg = `Are you sure you want to rollback changeset "${migration.id}" in ${env.toUpperCase()}?\n\nThis action cannot be undone.`;
    if(!window.confirm(confirmMsg)) return;
    
    setRollingBack(migration.id);
    
    try{
      const r = await rollbackOne({
        env: env,
        changesetId: migration.id,
        author: migration.author,
        filename: migration.filename
      });
      
      const output = r.output || '';
      const warnings = r.warnings || '';
      const fullOutput = warnings ? `${output}\n\n--- Warnings ---\n${warnings}` : output;
      
      setModalContent({
        title: `Rollback "${migration.id}" completed`,
        content: fullOutput || 'Rollback executed successfully',
        isError: false
      });
      setShowModal(true);
      
      // Refresh history and notify parent
      await load();
      if (onRollbackComplete) {
        onRollbackComplete();
      }
    }catch(e){
      const errorMsg = e.response?.data?.error || e.message || 'Unknown error';
      const errorOutput = e.response?.data?.stdout || '';
      const errorStderr = e.response?.data?.stderr || '';
      const fullError = errorOutput || errorStderr ? 
        `${errorMsg}\n\n--- Output ---\n${errorOutput}\n\n--- Error Details ---\n${errorStderr}` : 
        errorMsg;
      
      setModalContent({
        title: `Rollback "${migration.id}" failed`,
        content: fullError,
        isError: true
      });
      setShowModal(true);
    }
    setRollingBack(null);
  }

  const filteredHistory = history.filter(h => {
    if(!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      h.id?.toLowerCase().includes(term) ||
      h.author?.toLowerCase().includes(term) ||
      h.filename?.toLowerCase().includes(term) ||
      h.description?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="card">
      <div style={{marginBottom: 12}}>
        <input
          type="text"
          placeholder="Search migrations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: 4,
            fontSize: 14
          }}
        />
      </div>
      <div style={{maxHeight:400, overflow:'auto'}}>
        {filteredHistory.length === 0 ? (
          <div style={{padding: 12, color: '#666', textAlign: 'center'}}>
            {searchTerm ? 'No migrations match your search' : 'No migration history'}
          </div>
        ) : (
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {filteredHistory.map(h => {
              const isExpanded = expanded.has(h.orderexecuted);
              return (
                <li key={h.orderexecuted} style={{
                  padding: 12, 
                  borderBottom: '1px solid #eee',
                  backgroundColor: isExpanded ? '#f9f9f9' : 'white',
                  cursor: 'pointer'
                }} onClick={() => toggleExpand(h.orderexecuted)}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{flex: 1}}>
                      <div><strong>{h.id}</strong> — {h.description || h.filename}</div>
                      <div style={{fontSize:12, color:'#666', marginTop: 4}}>
                        by {h.author} • {h.dateexecuted ? new Date(h.dateexecuted).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                    <div style={{fontSize: 20, color: '#999'}}>
                      {isExpanded ? '▼' : '▶'}
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{
                      marginTop: 12,
                      padding: 12,
                      backgroundColor: 'white',
                      borderRadius: 4,
                      border: '1px solid #ddd',
                      fontSize: 12,
                      fontFamily: 'monospace'
                    }}>
                      <div><strong>Order:</strong> {h.orderexecuted}</div>
                      <div style={{marginTop: 4}}><strong>Filename:</strong> {h.filename}</div>
                      {h.md5sum && <div style={{marginTop: 4}}><strong>MD5:</strong> {h.md5sum}</div>}
                      <div style={{marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee'}}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRollback(h);
                          }}
                          disabled={rollingBack === h.id}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: rollingBack === h.id ? '#ccc' : '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: rollingBack === h.id ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            fontWeight: 'bold'
                          }}
                        >
                          {rollingBack === h.id ? 'Rolling back...' : 'Rollback'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
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
