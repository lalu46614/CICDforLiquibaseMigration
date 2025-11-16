import React, {useEffect, useState} from 'react';
import { getEnvironments, getDbStatus } from '../api';
import EnvironmentCard from './EnvironmentCard';
import PendingMigrations from './PendingMigrations';
import MigrationsTimeline from './MigrationsTimeline';
import MetricsDashboard from './MetricsDashboard';
import VersionMap from './VersionMap';
import RollbackHistory from './RollbackHistory';
import RecentDeployments from './RecentDeployments';

export default function Dashboard(){
  const [envs, setEnvs] = useState({});
  const [status, setStatus] = useState({});
  const [selectedEnv, setSelectedEnv] = useState('dev');
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');

  async function load(){
    try{
      const e = await getEnvironments();
      setEnvs(e);
      const s = await getDbStatus();
      setStatus(s);
    }catch(err){
      console.error(err);
    }
  }

  function handleMigrationComplete(){
    // Trigger refresh of all data
    load();
    setRefreshKey(prev => prev + 1);
  }

  useEffect(()=>{ 
    load(); 
    const t = setInterval(load, 15000); 
    return ()=>clearInterval(t); 
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'version-map', label: 'Version Map' },
    { id: 'rollback-history', label: 'Rollback History' },
    { id: 'recent-deployments', label: 'Recent Deployments' }
  ];

  return (
    <div>
      <div className="grid" style={{marginBottom:20}}>
        {Object.keys(envs).length === 0 ? (
          <div style={{padding: 20}}>Loading environments...</div>
        ) : (
          Object.keys(envs).map(k => (
            <EnvironmentCard 
              key={k} 
              name={k} 
              latest={envs[k].latest} 
              dbStatus={status[k]}
              isSelected={selectedEnv === k}
              onClick={() => setSelectedEnv(k)}
            />
          ))
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 20,
        borderBottom: '2px solid #ddd'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #007bff' : '3px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              color: activeTab === tab.id ? '#007bff' : '#666',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{display:'flex', gap:16, flexWrap: 'wrap'}}>
          <div style={{flex:1, minWidth: 300}}>
            <h3 style={{marginTop: 0}}>Pending Migrations ({selectedEnv.toUpperCase()})</h3>
            <PendingMigrations 
              key={`pending-${selectedEnv}-${refreshKey}`}
              env={selectedEnv} 
              onMigrationComplete={handleMigrationComplete}
            />
          </div>
          <div style={{flex:2, minWidth: 400}}>
            <h3 style={{marginTop: 0}}>Migration History ({selectedEnv.toUpperCase()})</h3>
            <MigrationsTimeline 
              key={`history-${selectedEnv}-${refreshKey}`}
              env={selectedEnv}
              onRefresh={refreshKey}
              onRollbackComplete={handleMigrationComplete}
            />
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <MetricsDashboard />
      )}

      {activeTab === 'version-map' && (
        <VersionMap />
      )}

      {activeTab === 'rollback-history' && (
        <RollbackHistory env={selectedEnv} />
      )}

      {activeTab === 'recent-deployments' && (
        <RecentDeployments limit={10} />
      )}
    </div>
  );
}
