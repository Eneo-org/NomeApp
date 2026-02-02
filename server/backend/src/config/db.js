const mysql = require("mysql2/promise");
require("dotenv").config(); 

// Logica per scegliere il DB:
// Se siamo in test -> usa "backend_testing"
// Altrimenti -> usa quello nel .env oppure "NomeApp"
const currentDbName = process.env.NODE_ENV === 'test' 
  ? (process.env.DB_NAME_TEST || "backend_testing") 
  : (process.env.DB_NAME || "NomeApp");

console.log(`🔌 Connessione al DB: ${currentDbName} (Mode: ${process.env.NODE_ENV || 'dev'})`);

/**
 * DigitalOcean Managed Databases Configuration:
 * - DigitalOcean uses port 25060 by default (not 3306)
 * - SSL is required for secure connections
 * - rejectUnauthorized: false bypasses CA verification for managed DB self-signed certs
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306, // DigitalOcean often uses 25060
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: currentDbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Required for DigitalOcean managed databases
  } : undefined
});

module.exports = pool;