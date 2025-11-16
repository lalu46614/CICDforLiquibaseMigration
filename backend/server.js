require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const migrations = require('./controllers/migrations');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// endpoints
app.get('/api/environments', migrations.getEnvironments);
app.get('/api/migrations/history', migrations.getMigrationHistory);
app.get('/api/migrations/pending', migrations.getPendingMigrations);
app.get('/api/database/status', migrations.getDbStatus);
app.post('/api/migrations/execute', migrations.executeMigration);
app.post('/api/migrations/rollback', migrations.rollbackMigration);
app.post('/api/migrations/rollback-one', migrations.rollbackOne);
app.get('/api/migrations/diff', migrations.getSchemaDiff);
app.get('/api/migrations/rollback-history', migrations.getRollbackHistory);
app.get('/api/migrations/recent-deployments', migrations.getRecentDeployments);
app.get('/api/migrations/version-map', migrations.getVersionMap);
app.get('/api/migrations/metrics', migrations.getMetrics);

app.get('/health', (req, res) => res.json({status: 'ok', ts: new Date()}));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on ${port}`));
