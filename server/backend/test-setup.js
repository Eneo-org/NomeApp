// backend/__tests__/setup.js
require('dotenv').config();

// FORZA L'AMBIENTE TEST PRIMA DI TUTTO
process.env.NODE_ENV = 'test';

// Imposta un timeout più lungo per i test di integrazione con DB reale
jest.setTimeout(5000);

/*
 * NOTA: Se usi un pool di connessioni (es. mysql2), potresti dover esportare
 * la funzione di chiusura dal tuo modulo database ed eseguirla qui nel globalTeardown
 * oppure gestirla nei singoli file di test dentro afterAll().
 */
console.log("Environment SQL di test configurato.");