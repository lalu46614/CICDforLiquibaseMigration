import React, {useEffect, useState} from 'react';
import { getRecentDeployments } from '../api';

export default function RecentDeployments({limit = 10}){
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load(){
    try{
      const res = await getRecentDeployments(limit);
      setDeployments(res.deployments || []);
    }catch(e){
      console.error(e);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{ 
    load(); 
    const interval = setInterval(load, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [limit]);

  if(loading) return <div className="card">Loading recent deployments...</div>;

  return (
    <div className="card">
      <h3 style={{marginTop: 0}}>Recent Deployments (Last {limit})</h3>
      {deployments.length === 0 ? (
        <div style={{padding: 12, color: '#666'}}>No deployments found</div>
      ) : (
        <div style={{overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 14}}>
            <thead>
              <tr style={{backgroundColor: '#f5f5f5'}}>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Environment</th>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Changeset</th>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Author</th>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Description</th>
                <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Executed At</th>
                <th style={{padding: 12, textAlign: 'center', border: '1px solid #ddd'}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d, idx) => (
                <tr key={idx}>
                  <td style={{padding: 12, border: '1px solid #ddd'}}>
                    <strong>{d.env.toUpperCase()}</strong>
                  </td>
                  <td style={{padding: 12, border: '1px solid #ddd'}}>{d.id}</td>
                  <td style={{padding: 12, border: '1px solid #ddd'}}>{d.author}</td>
                  <td style={{padding: 12, border: '1px solid #ddd'}}>
                    {d.description || d.filename}
                  </td>
                  <td style={{padding: 12, border: '1px solid #ddd'}}>
                    {new Date(d.dateexecuted).toLocaleString('en-US', {
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
                      backgroundColor: d.status === 'success' ? '#d4edda' : '#f8d7da',
                      color: d.status === 'success' ? '#155724' : '#721c24',
                      fontSize: 12
                    }}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

