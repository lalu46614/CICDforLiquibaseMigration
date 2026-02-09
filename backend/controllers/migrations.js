// controllers/migrations.js
const { DEV, QA, PROD } = require('../db/pool');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// DDL for rollback_history - used as a safe-create if the table is missing
const ROLLBACK_HISTORY_DDL = `CREATE TABLE IF NOT EXISTS rollback_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  env VARCHAR(20) NOT NULL,
  changeset_id VARCHAR(200) NOT NULL,
  author VARCHAR(200) NOT NULL,
  filename VARCHAR(300) NOT NULL,
  rollback_tag VARCHAR(200) NULL,
  rolled_back_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL
)`;

// All DB environments
const envPools = { dev: DEV, qa: QA, prod: PROD };

// ----------------------
// Helper: Query database
// ----------------------
async function queryDatabase(pool, sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// ----------------------
// Helper: Execute Liquibase command
// ----------------------
function executeLiquibaseCommand(cmd, cwd, maxBuffer = 1024 * 1024 * 10) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer, cwd }, (err, stdout, stderr) => {
      if (err) {
        reject({ error: err, stdout: stdout || '', stderr: stderr || '' });
      } else {
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      }
    });
  });
}

// ----------------------
// Get Latest Change Per Environment
// ----------------------
exports.getEnvironments = async (req, res) => {
  try {
    const results = {};
    for (const [name, pool] of Object.entries(envPools)) {
      try {
        const rows = await queryDatabase(
          pool,
          `SELECT id, author, filename, dateexecuted, orderexecuted 
           FROM DATABASECHANGELOG 
           ORDER BY dateexecuted DESC, orderexecuted DESC LIMIT 1`
        );
        
        // Format timestamp to ISO format if present
        if (rows[0]) {
          rows[0].dateexecuted = rows[0].dateexecuted instanceof Date ? 
            rows[0].dateexecuted.toISOString() : 
            new Date(rows[0].dateexecuted).toISOString();
        }
        
        results[name] = { latest: rows[0] || null, status: 'initialized' };
      } catch (err) {
        // Handle case where DATABASECHANGELOG table doesn't exist (Liquibase not initialized)
        if (err.code === 'ER_NO_SUCH_TABLE') {
          results[name] = { latest: null, status: 'not_initialized', message: 'Liquibase has not been initialized yet' };
        } else {
          throw err;
        }
      }
    }
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Get Migration History
// ----------------------
exports.getMigrationHistory = async (req, res) => {
  const env = (req.query.env || 'dev').toLowerCase();
  const pool = envPools[env];
  if (!pool) return res.status(400).json({ error: 'invalid env' });

  try {
    const rows = await queryDatabase(
      pool,
      `SELECT id, author, filename, description, dateexecuted, orderexecuted, md5sum
       FROM DATABASECHANGELOG 
       ORDER BY orderexecuted DESC`
    );
    
    // Format timestamps to ISO format
    const formattedRows = rows.map(row => ({
      ...row,
      dateexecuted: row.dateexecuted instanceof Date ? row.dateexecuted.toISOString() : new Date(row.dateexecuted).toISOString()
    }));
    
    res.json({ env, history: formattedRows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ env, history: [], status: 'not_initialized', message: 'Liquibase has not been initialized yet' });
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Get Pending Migrations
// ----------------------
exports.getPendingMigrations = async (req, res) => {
  const env = (req.query.env || 'dev').toLowerCase();
  const pool = envPools[env];
  if (!pool) return res.status(400).json({ error: 'invalid env' });

  try {
    const manifestPath = path.resolve(__dirname, '..', 'changelogs', 'master-changelog.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    try {
      const dbRows = await queryDatabase(pool, `SELECT id, author, filename FROM DATABASECHANGELOG`);
      
      // Use basename for filename comparison since DATABASECHANGELOG stores absolute paths
      const appliedSet = new Set(
        dbRows.map(r => {
          const basename = path.basename(r.filename);
          return `${r.id}||${r.author}||${basename}`;
        })
      );

      // Compare using basename of manifest filename
      const pending = manifest.changesets.filter(cs => {
        const manifestBasename = path.basename(cs.filename);
        const key = `${cs.id}||${cs.author}||${manifestBasename}`;
        return !appliedSet.has(key);
      });

      res.json({ env, pending });
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        // If table doesn't exist, all changesets are pending
        res.json({ env, pending: manifest.changesets, status: 'not_initialized', message: 'Liquibase has not been initialized yet' });
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// DB Status Check
// ----------------------
exports.getDbStatus = async (req, res) => {
  const statuses = {};
  for (const [name, pool] of Object.entries(envPools)) {
    try {
      await pool.query('SELECT 1');
      statuses[name] = { ok: true };
    } catch (err) {
      statuses[name] = { ok: false, error: err.message };
    }
  }
  res.json(statuses);
};

// ----------------------
// Get Approvers (QA/PROD)
// ----------------------
exports.getApprovers = async (req, res) => {
  try {
    const qaRaw = process.env.QA_APPROVERS || '';
    const prodRaw = process.env.PROD_APPROVERS || '';

    const parse = (s) => s.split(',').map(x => x.trim()).filter(x => x.length > 0);

    res.json({ qa: parse(qaRaw), prod: parse(prodRaw) });
  } catch (err) {
    console.error('Error reading approvers:', err);
    res.status(500).json({ error: 'could not read approvers' });
  }
};

// ----------------------
// Execute Migration
// ----------------------
// Execute migration using Liquibase CLI with robust path handling and auto-tagging
exports.executeMigration = async (req, res) => {
  const { env = 'dev', changelogFile } = req.body;
  if (!changelogFile)
    return res.status(400).json({ error: 'changelogFile required' });

  const liquibasePath = process.env.LIQUIBASE_PATH || 'C:/Program Files/liquibase/liquibase.bat';
  const dbUrl = process.env[`${env.toUpperCase()}_DATABASE_URL`];
  if (!dbUrl)
    return res.status(400).json({ error: 'db url not configured for env' });

  try {
    // Resolve absolute path: changelogFile may be "changelogs/001-create-users.xml"
    // or just "001-create-users.xml" - we resolve from backend/changelogs/
    let absolutePath;
    if (changelogFile.startsWith('changelogs/')) {
      absolutePath = path.resolve(__dirname, '..', changelogFile);
    } else {
      absolutePath = path.resolve(__dirname, '..', 'changelogs', changelogFile);
    }

    // Verify file exists
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: `Changelog file not found: ${absolutePath}` });
    }

    // Read the changelog file to extract changeset ID and author
    const changelogContent = fs.readFileSync(absolutePath, 'utf8');
    const changesetIdMatch = changelogContent.match(/id=["']([^"']+)["']/);
    const authorMatch = changelogContent.match(/author=["']([^"']+)["']/);
    
    const changesetId = changesetIdMatch ? changesetIdMatch[1] : null;
    const author = authorMatch ? authorMatch[1] : null;
    
    if (!changesetId || !author) {
      console.warn(`Could not extract changeset ID or author from ${changelogFile}, skipping auto-tag`);
    }

    // Convert backslashes to forward slashes for Liquibase (Windows compatibility)
    absolutePath = absolutePath.replace(/\\/g, '/');
    
    // Get the changelogs directory path for searchPath
    const changelogsDir = path.resolve(__dirname, '..', 'changelogs').replace(/\\/g, '/');

    // When using --searchPath, --changeLogFile must be relative to the searchPath
    // Extract just the filename (e.g., "004-add-address.xml")
    const changelogFileName = path.basename(absolutePath);

    // Quote the Liquibase executable path (handles spaces in path)
    const liquibaseQuoted = `"${liquibasePath}"`;
    const backendDir = path.resolve(__dirname, '..');

    // Step 1: Auto-tag before applying migration (if we have changeset info)
    let tagName = null;
    if (changesetId && author) {
      tagName = `${changesetId}-before`;
      const tagCmd = `${liquibaseQuoted} --url="${dbUrl}" --changeLogFile="${changelogFileName}" --searchPath="${changelogsDir}" tag ${tagName}`;
      
      console.log(`[${new Date().toISOString()}] Auto-tagging before migration on ${env}:`);
      console.log(`  Tag command: ${tagCmd}`);
      
      try {
        await executeLiquibaseCommand(tagCmd, backendDir);
        console.log(`[${new Date().toISOString()}] Tagged successfully: ${tagName}`);
      } catch (tagErr) {
        // Log warning but continue - tag might already exist or tagging might fail
        console.warn(`[${new Date().toISOString()}] Tagging warning:`, tagErr.stderr || tagErr.error?.message);
      }
    }

    // Step 2: Apply the migration
    const updateCmd = `${liquibaseQuoted} --url="${dbUrl}" --changeLogFile="${changelogFileName}" --searchPath="${changelogsDir}" update`;

    console.log(`[${new Date().toISOString()}] Executing migration on ${env}:`);
    console.log(`  Command: ${updateCmd}`);
    console.log(`  Changelog file: ${changelogFileName}`);
    console.log(`  Full path: ${absolutePath}`);
    console.log(`  SearchPath: ${changelogsDir}`);

    try {
      const result = await executeLiquibaseCommand(updateCmd, backendDir);
      
      const output = result.stdout || '';
      const warnings = result.stderr || '';
      
      console.log(`[${new Date().toISOString()}] Migration completed successfully`);
      if (warnings) {
        console.warn('Warnings:', warnings);
      }

      res.json({ 
        ok: true, 
        output: output,
        warnings: warnings || null,
        tag: tagName
      });
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Liquibase execution error:`, err.stderr || err.error?.message);
      return res.status(500).json({ 
        error: err.stderr || err.error?.message || 'Unknown error',
        stdout: err.stdout || '',
        stderr: err.stderr || ''
      });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error preparing migration:`, error);
    res.status(500).json({ error: error.message });
  }
};



// ----------------------
// Rollback One Migration (Individual Changeset)
// ----------------------
exports.rollbackOne = async (req, res) => {
  const { env = 'dev', changesetId, author, filename } = req.body;
  
  if (!changesetId || !author || !filename) {
    return res.status(400).json({ error: 'changesetId, author, and filename are required' });
  }

  const liquibasePath = process.env.LIQUIBASE_PATH || 'C:/Program Files/liquibase/liquibase.bat';
  const dbUrl = process.env[`${env.toUpperCase()}_DATABASE_URL`];
  if (!dbUrl)
    return res.status(400).json({ error: 'db url not configured for env' });

  const pool = envPools[env.toLowerCase()];
  if (!pool) return res.status(400).json({ error: 'invalid env' });

  const backendDir = path.resolve(__dirname, '..');
  const changelogsDir = path.resolve(__dirname, '..', 'changelogs').replace(/\\/g, '/');
  const liquibaseQuoted = `"${liquibasePath}"`;

  try {
    // Use master-changelog.xml if it exists, otherwise use the first changelog
    const masterChangelogXml = path.resolve(__dirname, '..', 'changelogs', 'master-changelog.xml');
    const fallbackChangelog = path.resolve(__dirname, '..', 'changelogs', '001-create-users.xml');
    
    let changelogPath;
    if (fs.existsSync(masterChangelogXml)) {
      changelogPath = masterChangelogXml;
    } else {
      changelogPath = fallbackChangelog;
    }
    
    const changelogFileName = path.basename(changelogPath);

    // Step 0: Find the orderexecuted of the changeset to determine rollback count
    const filenameBasename = path.basename(filename);
    const changesetRow = await queryDatabase(pool,
      `SELECT orderexecuted FROM DATABASECHANGELOG 
       WHERE id = ? AND author = ? AND filename LIKE ? 
       LIMIT 1`,
      [changesetId, author, `%${filenameBasename}%`]
    );
    
    if (!changesetRow || changesetRow.length === 0) {
      return res.status(400).json({ error: `Changeset ${changesetId} not found in DATABASECHANGELOG` });
    }
    
    const changesetOrder = changesetRow[0].orderexecuted;
    
    // Get the max order to calculate rollback count
    const maxOrderRow = await queryDatabase(pool,
      `SELECT MAX(orderexecuted) as max_order FROM DATABASECHANGELOG`
    );
    
    const maxOrder = maxOrderRow[0].max_order || 0;
    const rollbackCount = maxOrder - changesetOrder + 1;
    
    if (rollbackCount <= 0) {
      return res.status(400).json({ error: 'Cannot rollback - changeset order invalid' });
    }

    // Step 1: Execute rollback using rollback-count
    const rollbackCmd = `${liquibaseQuoted} --url="${dbUrl}" --changeLogFile="${changelogFileName}" --searchPath="${changelogsDir}" rollback-count ${rollbackCount}`;

    console.log(`[${new Date().toISOString()}] Rolling back changeset ${changesetId} on ${env}:`);
    console.log(`  Command: ${rollbackCmd}`);
    console.log(`  Changeset order: ${changesetOrder}, Max order: ${maxOrder}, Rollback count: ${rollbackCount}`);

    let rollbackResult;
    let rollbackStatus = 'SUCCESS';
    let rollbackError = null;

    try {
      rollbackResult = await executeLiquibaseCommand(rollbackCmd, backendDir);
      console.log(`[${new Date().toISOString()}] Rollback completed successfully`);
    } catch (rollbackErr) {
      rollbackStatus = 'FAILED';
      rollbackError = rollbackErr.stderr || rollbackErr.error?.message || 'Unknown error';
      console.error(`[${new Date().toISOString()}] Rollback error:`, rollbackError);
      
      // Still record the failed rollback attempt
      rollbackResult = {
        stdout: rollbackErr.stdout || '',
        stderr: rollbackErr.stderr || ''
      };
    }

    // Step 2: Delete from DATABASECHANGELOG (only if rollback succeeded)
    if (rollbackStatus === 'SUCCESS') {
      try {
        // Delete the changeset from DATABASECHANGELOG
        // Match by id, author, and filename (using LIKE for basename matching)
        await queryDatabase(pool, 
          `DELETE FROM DATABASECHANGELOG 
           WHERE id = ? AND author = ? AND filename LIKE ?`,
          [changesetId, author, `%${filenameBasename}%`]
        );
        
        console.log(`[${new Date().toISOString()}] Removed changeset ${changesetId} from DATABASECHANGELOG`);
      } catch (deleteErr) {
        console.error(`[${new Date().toISOString()}] Error deleting from DATABASECHANGELOG:`, deleteErr.message);
        // Continue - rollback succeeded even if delete failed
      }
    }

    // Step 3: Record in rollback_history
    try {
      // Ensure rollback_history exists (some environments may not have this changeset applied)
      try {
        await queryDatabase(pool, ROLLBACK_HISTORY_DDL);
      } catch (createErr) {
        console.warn(`[${new Date().toISOString()}] Could not ensure rollback_history table:`, createErr.message);
      }
      await queryDatabase(pool, 
        `INSERT INTO rollback_history (env, changeset_id, author, filename, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [env, changesetId, author, filenameBasename, rollbackStatus]
      );
      console.log(`[${new Date().toISOString()}] Recorded rollback in rollback_history`);
    } catch (historyErr) {
      // Log but don't fail - table might not exist yet
      console.warn(`[${new Date().toISOString()}] Could not record rollback in history:`, historyErr.message);
    }

    // Step 4: Release DATABASECHANGELOGLOCK if needed (Liquibase usually handles this)
    // But we can try to release it manually if there's an error
    if (rollbackStatus === 'FAILED') {
      try {
        // Try to release lock
        await queryDatabase(pool, `DELETE FROM DATABASECHANGELOGLOCK`);
        console.log(`[${new Date().toISOString()}] Released DATABASECHANGELOGLOCK after rollback failure`);
      } catch (lockErr) {
        // Ignore - lock might not exist or already released
      }
    }

    // Return response
    if (rollbackStatus === 'SUCCESS') {
      res.json({ 
        ok: true, 
        output: rollbackResult.stdout,
        warnings: rollbackResult.stderr || null,
        status: rollbackStatus
      });
    } else {
      res.status(500).json({ 
        ok: false,
        error: rollbackError,
        stdout: rollbackResult.stdout || '',
        stderr: rollbackResult.stderr || '',
        status: rollbackStatus
      });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error preparing rollback:`, error);
    res.status(500).json({ error: error.message });
  }
};

// ----------------------
// Rollback Migration (Legacy - uses tag parameter)
// ----------------------
exports.rollbackMigration = async (req, res) => {
  const { env = 'dev', tag } = req.body;
  if (!tag) return res.status(400).json({ error: 'tag required for rollback' });

  const liquibasePath = process.env.LIQUIBASE_PATH || 'C:/Program Files/liquibase/liquibase.bat';
  const dbUrl = process.env[`${env.toUpperCase()}_DATABASE_URL`];
  if (!dbUrl)
    return res.status(400).json({ error: 'db url not configured for env' });

  try {
    const liquibaseQuoted = `"${liquibasePath}"`;
    
    // Use master-changelog.xml if it exists, otherwise use the first changelog
    const masterChangelogXml = path.resolve(__dirname, '..', 'changelogs', 'master-changelog.xml');
    const fallbackChangelog = path.resolve(__dirname, '..', 'changelogs', '001-create-users.xml');
    
    let changelogPath;
    if (fs.existsSync(masterChangelogXml)) {
      changelogPath = masterChangelogXml;
    } else {
      changelogPath = fallbackChangelog;
    }
    
    changelogPath = changelogPath.replace(/\\/g, '/');
    
    // Get the changelogs directory path for searchPath
    const changelogsDir = path.resolve(__dirname, '..', 'changelogs').replace(/\\/g, '/');
    
    // When using --searchPath, --changeLogFile must be relative to the searchPath
    // Extract just the filename (e.g., "master-changelog.xml" or "001-create-users.xml")
    const changelogFileName = path.basename(changelogPath);

    const cmd = `${liquibaseQuoted} --url="${dbUrl}" --changeLogFile="${changelogFileName}" --searchPath="${changelogsDir}" rollback ${tag}`;

    console.log(`[${new Date().toISOString()}] Rolling back to tag '${tag}' on ${env}:`);
    console.log(`  Command: ${cmd}`);
    console.log(`  Changelog file: ${changelogFileName}`);
    console.log(`  Full path: ${changelogPath}`);
    console.log(`  SearchPath: ${changelogsDir}`);

    // Set working directory to backend folder for proper path resolution
    const backendDir = path.resolve(__dirname, '..');

    exec(cmd, { 
      maxBuffer: 1024 * 1024 * 10,
      cwd: backendDir
    }, async (err, stdout, stderr) => {
    if (err) {
        console.error(`[${new Date().toISOString()}] Rollback error:`, stderr || err.message);
        return res.status(500).json({ 
          error: stderr || err.message,
          stdout: stdout || '',
          stderr: stderr || ''
        });
      }
      
      const output = stdout || '';
      const warnings = stderr || '';
      
      // Record rollback in rollback_history table
      try {
        const pool = envPools[env];
        if (pool) {
          // Ensure table exists, then insert using rollback_tag column
          try {
            await queryDatabase(pool, ROLLBACK_HISTORY_DDL);
          } catch (createErr) {
            console.warn(`[${new Date().toISOString()}] Could not ensure rollback_history table:`, createErr.message);
          }

          await queryDatabase(pool, 
            `INSERT INTO rollback_history (env, rollback_tag) VALUES (?, ?)`,
            [env, tag]
          );
        }
      } catch (dbErr) {
        // Log but don't fail the rollback if table doesn't exist yet or insert fails
        console.warn(`[${new Date().toISOString()}] Could not record rollback in history:`, dbErr.message);
      }
      
      console.log(`[${new Date().toISOString()}] Rollback completed successfully`);
      if (warnings) {
        console.warn('Warnings:', warnings);
      }

      res.json({ 
        ok: true, 
        output: output,
        warnings: warnings || null
      });
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error preparing rollback:`, error);
    res.status(500).json({ error: error.message });
  }
};

// ----------------------
// Get Rollback History
// ----------------------
exports.getRollbackHistory = async (req, res) => {
  const { env } = req.query;
  
  try {
    const results = {};
    
    if (env) {
      // Get rollback history for specific environment
      const pool = envPools[env.toLowerCase()];
      if (!pool) return res.status(400).json({ error: 'invalid env' });
      
      try {
        const rows = await queryDatabase(pool, 
          `SELECT id, env, changeset_id, author, filename, rollback_tag, rolled_back_at, status 
           FROM rollback_history 
           ORDER BY rolled_back_at DESC`
        );
        results[env] = rows;
      } catch (err) {
        // Table might not exist yet
        results[env] = [];
      }
    } else {
      // Get rollback history for all environments
      for (const [name, pool] of Object.entries(envPools)) {
        try {
          const rows = await queryDatabase(pool, 
            `SELECT id, env, changeset_id, author, filename, rollback_tag, rolled_back_at, status 
             FROM rollback_history 
             ORDER BY rolled_back_at DESC`
          );
          results[name] = rows;
        } catch (err) {
          // Table might not exist yet
          results[name] = [];
        }
      }
    }
    
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Get Recent Deployments
// ----------------------
exports.getRecentDeployments = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    const allDeployments = [];
    
    for (const [envName, pool] of Object.entries(envPools)) {
      try {
        const rows = await queryDatabase(pool, 
          `SELECT id, author, filename, description, dateexecuted, orderexecuted 
           FROM DATABASECHANGELOG 
           ORDER BY dateexecuted DESC, orderexecuted DESC 
           LIMIT ?`,
          [limit]
        );
        
        // Add environment info to each row and format timestamp
        rows.forEach(row => {
          // Convert timestamp to ISO 8601 format for proper client-side timezone handling
          let dateExecutedISO = row.dateexecuted;
          if (row.dateexecuted instanceof Date) {
            dateExecutedISO = row.dateexecuted.toISOString();
          } else if (typeof row.dateexecuted === 'string') {
            // Ensure it's ISO format
            dateExecutedISO = new Date(row.dateexecuted).toISOString();
          }
          
          allDeployments.push({
            ...row,
            dateexecuted: dateExecutedISO, // Override with ISO format
            env: envName,
            status: 'success' // All recorded migrations are successful
          });
        });
      } catch (err) {
        console.warn(`Error fetching deployments for ${envName}:`, err.message);
      }
    }
    
    // Sort by dateexecuted descending and limit
    allDeployments.sort((a, b) => {
      const dateA = new Date(a.dateexecuted);
      const dateB = new Date(b.dateexecuted);
      return dateB - dateA;
    });
    
    res.json({ deployments: allDeployments.slice(0, limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Get Version Map (Changeset vs Environment Matrix)
// ----------------------
exports.getVersionMap = async (req, res) => {
  try {
    const manifestPath = path.resolve(__dirname, '..', 'changelogs', 'master-changelog.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    const versionMap = [];
    
    // For each changeset in manifest
    for (const changeset of manifest.changesets) {
      const manifestBasename = path.basename(changeset.filename);
      const row = {
        changeset: changeset.id,
        author: changeset.author,
        filename: manifestBasename,
        description: changeset.description,
        dev: false,
        qa: false,
        prod: false
      };
      
      // Check each environment
      for (const [envName, pool] of Object.entries(envPools)) {
        try {
          const dbRows = await queryDatabase(pool, 
            `SELECT id, author, filename 
             FROM DATABASECHANGELOG 
             WHERE id = ? AND author = ?`,
            [changeset.id, changeset.author]
          );
          
          // Check if any row matches by basename
          const isApplied = dbRows.some(r => {
            const dbBasename = path.basename(r.filename);
            return dbBasename === manifestBasename;
          });
          
          row[envName] = isApplied;
        } catch (err) {
          console.warn(`Error checking ${envName} for ${changeset.id}:`, err.message);
          row[envName] = false;
        }
      }
      
      versionMap.push(row);
    }
    
    res.json({ versionMap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Get Metrics
// ----------------------
exports.getMetrics = async (req, res) => {
  try {
    const metrics = {
      totalMigrations: 0,
      appliedPerEnv: {},
      pendingPerEnv: {},
      rollbacksExecuted: 0,
      recentDeployments: []
    };
    
    // Get manifest
    const manifestPath = path.resolve(__dirname, '..', 'changelogs', 'master-changelog.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    metrics.totalMigrations = manifest.changesets.length;
    
    // Get applied and pending per environment
    for (const [envName, pool] of Object.entries(envPools)) {
      try {
        const dbRows = await queryDatabase(pool, 
          `SELECT id, author, filename FROM DATABASECHANGELOG`
        );
        
        const appliedSet = new Set(
          dbRows.map(r => {
            const basename = path.basename(r.filename);
            return `${r.id}||${r.author}||${basename}`;
          })
        );
        
        const pending = manifest.changesets.filter(cs => {
          const manifestBasename = path.basename(cs.filename);
          const key = `${cs.id}||${cs.author}||${manifestBasename}`;
          return !appliedSet.has(key);
        });
        
        metrics.appliedPerEnv[envName] = dbRows.length;
        metrics.pendingPerEnv[envName] = pending.length;
        
        // Get rollback count
        try {
          const rollbackRows = await queryDatabase(pool, 
            `SELECT COUNT(*) as count FROM rollback_history`
          );
          metrics.rollbacksExecuted += rollbackRows[0]?.count || 0;
        } catch (err) {
          // Table might not exist
        }
      } catch (err) {
        metrics.appliedPerEnv[envName] = 0;
        metrics.pendingPerEnv[envName] = manifest.changesets.length;
      }
    }
    
    // Get recent deployments (last 10) - fetch directly
    try {
      const allDeployments = [];
      for (const [envName, pool] of Object.entries(envPools)) {
        try {
          const rows = await queryDatabase(pool, 
            `SELECT id, author, filename, description, dateexecuted, orderexecuted 
             FROM DATABASECHANGELOG 
             ORDER BY dateexecuted DESC, orderexecuted DESC 
             LIMIT 10`
          );
          rows.forEach(row => {
            // Format timestamp to ISO format
            let dateExecutedISO = row.dateexecuted;
            if (row.dateexecuted instanceof Date) {
              dateExecutedISO = row.dateexecuted.toISOString();
            } else if (typeof row.dateexecuted === 'string') {
              dateExecutedISO = new Date(row.dateexecuted).toISOString();
            }
            
            allDeployments.push({
              ...row,
              dateexecuted: dateExecutedISO,
              env: envName,
              status: 'success'
            });
          });
        } catch (err) {
          // Ignore
        }
      }
      allDeployments.sort((a, b) => {
        const dateA = new Date(a.dateexecuted);
        const dateB = new Date(b.dateexecuted);
        return dateB - dateA;
      });
      metrics.recentDeployments = allDeployments.slice(0, 10);
    } catch (err) {
      // Ignore errors
    }
    
    res.json(metrics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Schema Diff
// ----------------------
exports.getSchemaDiff = async (req, res) => {
  const { source = 'dev', target = 'qa' } = req.query;

  const liquibasePath = process.env.LIQUIBASE_PATH || 'C:/Program Files/liquibase/liquibase.bat';
  const srcUrl = process.env[`${source.toUpperCase()}_DATABASE_URL`];
  const tgtUrl = process.env[`${target.toUpperCase()}_DATABASE_URL`];

  if (!srcUrl || !tgtUrl)
    return res.status(400).json({ error: 'source/target db missing' });

  try {
    const liquibaseQuoted = `"${liquibasePath}"`;
    const cmd = `${liquibaseQuoted} --url="${srcUrl}" --referenceUrl="${tgtUrl}" diff`;

    console.log(`[${new Date().toISOString()}] Running schema diff ${source} -> ${target}:`);
    console.log(`  Command: ${cmd}`);

    // Set working directory to backend folder for proper path resolution
    const backendDir = path.resolve(__dirname, '..');

    exec(cmd, { 
      maxBuffer: 1024 * 1024 * 10,
      cwd: backendDir
    }, (err, stdout, stderr) => {
    if (err) {
        console.error(`[${new Date().toISOString()}] Diff error:`, stderr || err.message);
        return res.status(500).json({ 
          error: stderr || err.message,
          stdout: stdout || '',
          stderr: stderr || ''
        });
      }
      
      const output = stdout || '';
      const warnings = stderr || '';
      
      res.json({ 
        diff: output,
        warnings: warnings || null
      });
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error preparing diff:`, error);
    res.status(500).json({ error: error.message });
  }
};
