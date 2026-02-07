-- Sync DEV DATABASECHANGELOG with actual applied migrations
INSERT INTO DATABASECHANGELOG (ID, AUTHOR, FILENAME, DATEEXECUTED, ORDEREXECUTED, MD5SUM, DESCRIPTION, COMMENTS, EXECTYPE, CONTEXTS, LABELS, LIQUIBASE, DEPLOYMENT_ID)
VALUES 
('003-add-phone', 'lalu', '003-add-phone.xml', NOW(), 3, '8:d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3', 'addColumn tableName=app_users', '', 'EXECUTED', NULL, NULL, '4.33.0', NULL),
('004-add-address', 'lalu', '004-add-address.xml', NOW(), 4, '8:e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e4', 'addColumn tableName=app_users', '', 'EXECUTED', NULL, NULL, '4.33.0', NULL),
('005-create-rollback-history', 'lalu', '005-create-rollback-history.xml', NOW(), 5, '8:f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5', 'createTable tableName=rollback_history', '', 'EXECUTED', NULL, NULL, '4.33.0', NULL),
('007-test-release', 'lalu', '007-test-release.xml', NOW(), 6, '8:a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6', 'addColumn tableName=app_users', '', 'EXECUTED', NULL, NULL, '4.33.0', NULL);

SELECT 'Changesets synced' as Status;
SELECT ID, ORDEREXECUTED FROM DATABASECHANGELOG ORDER BY ORDEREXECUTED;
