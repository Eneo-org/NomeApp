const express = require("express");
const router = express.Router();
const controller = require("../controllers/participatoryBudgetController");

// --- ORDINE DELLE ROTTE ---
// Regola d'oro: le rotte specifiche (es. /active) vanno definite PRIMA di quelle generiche (es. /) o dinamiche (es. /:id)

// 1. GET /participatory-budgets/active (Bilancio Attivo per la Home)
// Deve usare 'getActiveParticipatoryBudget'
router.get("/active", controller.getActiveParticipatoryBudget);

// 2. GET /participatory-budgets (Archivio storico)
// ERRORE ERA QUI: La funzione ora si chiama 'getArchivedBudgets', non più 'getAll...'
router.get("/", controller.getArchivedBudgets);

// 3. POST /participatory-budgets (Creazione nuovo bilancio - Admin)
router.post("/", controller.createParticipatoryBudget);

// 4. POST /participatory-budgets/:id/votes (Votazione utente)
router.post("/:id/votes", controller.voteParticipatoryBudget);

module.exports = router;
