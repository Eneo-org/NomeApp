const express = require("express");
const router = express.Router();
const controller = require("../controllers/participatoryBudgetController");
const authMiddleware = require("../middleware/authMiddleware");


// --- ORDINE DELLE ROTTE ---
// Regola d'oro: le rotte specifiche (es. /active) vanno definite PRIMA di quelle generiche (es. /) o dinamiche (es. /:id)

// 1. GET /participatory-budgets/active (Bilancio Attivo per la Home)
// Deve usare 'getActiveParticipatoryBudget'
// ROTTA PUBBLICA: non richiede autenticazione
router.get("/active", controller.getActiveParticipatoryBudget);

// 2. GET /participatory-budgets (Archivio storico)
// SOLO ADMIN
router.get("/", authMiddleware, controller.getArchivedBudgets);


// 3. POST /participatory-budgets (Creazione nuovo bilancio - Admin)
router.post("/", authMiddleware, controller.createParticipatoryBudget);


// 4. POST /participatory-budgets/:id/votes (Votazione utente)
router.post("/:id/votes", authMiddleware, controller.voteParticipatoryBudget);

module.exports = router;
