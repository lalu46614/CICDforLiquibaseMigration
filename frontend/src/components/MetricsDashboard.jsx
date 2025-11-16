import React, {useEffect, useState} from 'react';
import { getMetrics } from '../api';

export default function MetricsDashboard(){
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load(){
    try{
      const m = await getMetrics();
      setMetrics(m);
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
  }, []);

  if(loading) return <div className="card">Loading metrics...</div>;
  if(!metrics) return <div className="card">Error loading metrics</div>;

  return (
    <div>
      <h2 style={{marginTop: 0}}>Metrics Dashboard</h2>
      <div className="grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24}}>
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: 32, fontWeight: 'bold', color: '#007bff'}}>{metrics.totalMigrations}</div>
          <div style={{color: '#666', marginTop: 8}}>Total Migrations</div>
        </div>
        
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: 32, fontWeight: 'bold', color: '#28a745'}}>
            {metrics.appliedPerEnv.dev || 0}
          </div>
          <div style={{color: '#666', marginTop: 8}}>Applied (DEV)</div>
        </div>
        
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: 32, fontWeight: 'bold', color: '#28a745'}}>
            {metrics.appliedPerEnv.qa || 0}
          </div>
          <div style={{color: '#666', marginTop: 8}}>Applied (QA)</div>
        </div>
        
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: 32, fontWeight: 'bold', color: '#28a745'}}>
            {metrics.appliedPerEnv.prod || 0}
          </div>
          <div style={{color: '#666', marginTop: 8}}>Applied (PROD)</div>
        </div>
        
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: 32, fontWeight: 'bold', color: '#ffc107'}}>
            {metrics.pendingPerEnv.dev || 0}
          </div>
          <div style={{color: '#666', marginTop: 8}}>Pending (DEV)</div>
        </div>
        
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: 32, fontWeight: 'bold', color: '#ffc107'}}>
            {metrics.pendingPerEnv.qa || 0}
          </div>
          <div style={{color: '#666', marginTop: 8}}>Pending (QA)</div>
        </div>
        
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: 32, fontWeight: 'bold', color: '#ffc107'}}>
            {metrics.pendingPerEnv.prod || 0}
          </div>
          <div style={{color: '#666', marginTop: 8}}>Pending (PROD)</div>
        </div>
        
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: 32, fontWeight: 'bold', color: '#dc3545'}}>
            {metrics.rollbacksExecuted || 0}
          </div>
          <div style={{color: '#666', marginTop: 8}}>Rollbacks Executed</div>
        </div>
      </div>
    </div>
  );
}

