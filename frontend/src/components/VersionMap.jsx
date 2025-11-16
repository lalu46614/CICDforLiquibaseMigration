import React, {useEffect, useState} from 'react';
import { getVersionMap } from '../api';

export default function VersionMap(){
  const [versionMap, setVersionMap] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load(){
    try{
      const res = await getVersionMap();
      setVersionMap(res.versionMap || []);
    }catch(e){
      console.error(e);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);

  if(loading) return <div className="card">Loading version map...</div>;

  return (
    <div className="card">
      <h3 style={{marginTop: 0}}>Version Comparison Matrix</h3>
      <div style={{overflowX: 'auto'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 14}}>
          <thead>
            <tr style={{backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd'}}>
              <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Changeset</th>
              <th style={{padding: 12, textAlign: 'left', border: '1px solid #ddd'}}>Description</th>
              <th style={{padding: 12, textAlign: 'center', border: '1px solid #ddd'}}>DEV</th>
              <th style={{padding: 12, textAlign: 'center', border: '1px solid #ddd'}}>QA</th>
              <th style={{padding: 12, textAlign: 'center', border: '1px solid #ddd'}}>PROD</th>
            </tr>
          </thead>
          <tbody>
            {versionMap.map((row, idx) => (
              <tr key={idx} style={{borderBottom: '1px solid #eee'}}>
                <td style={{padding: 12, border: '1px solid #ddd'}}>
                  <strong>{row.changeset}</strong>
                  <div style={{fontSize: 11, color: '#666'}}>by {row.author}</div>
                </td>
                <td style={{padding: 12, border: '1px solid #ddd'}}>
                  {row.description || row.filename}
                </td>
                <td style={{padding: 12, textAlign: 'center', border: '1px solid #ddd'}}>
                  {row.dev ? '✔' : '✖'}
                </td>
                <td style={{padding: 12, textAlign: 'center', border: '1px solid #ddd'}}>
                  {row.qa ? '✔' : '✖'}
                </td>
                <td style={{padding: 12, textAlign: 'center', border: '1px solid #ddd'}}>
                  {row.prod ? '✔' : '✖'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

