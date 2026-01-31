module.exports = {
  // Indica che stiamo testando un ambiente Node.js
  testEnvironment: 'node',

  // Dice a Jest di eseguire questo file PRIMA di ogni test
  // (Serve per caricare le variabili .env e impostare il timeout)
  setupFilesAfterEnv: ['<rootDir>/server/backend/test-setup.js'],

  // Opzionale: Se vuoi essere sicuro che cerchi i test solo nel backend
  roots: ['<rootDir>/server/backend'],
  
  // Ignora la cartella node_modules
  testPathIgnorePatterns: ['/node_modules/'],
  
  // Aumenta il timeout di default per tutti i test a 10 secondi (utile per DB lenti)
  testTimeout: 10000
};