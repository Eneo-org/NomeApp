/**
 * Entry Point for Production Deployment
 * 
 * This file serves as the main entry point for the application,
 * separating server startup logic from the Express app configuration.
 */

const app = require('./src/app');
const startScheduler = require('./src/cronJobs');
require('dotenv').config();

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Avvia i cron jobs per monitoraggio scadenze e importazione esterna
  startScheduler();
});
