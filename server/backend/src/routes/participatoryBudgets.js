const express = require('express');
const router = express.Router();
const controller = require('../controllers/participatoryBudgetController');

// GET /participatory-budgets (Archivio con paginazione)
router.get('/', controller.getAllParticipatoryBudgets);

// POST /participatory-budgets (Creazione nuovo bilancio - Richiede Admin logicamente)
router.post('/', controller.createParticipatoryBudget);

//GET /participatory-budgets/active
router.get('/active', controller.getActiveParticipatoryBudget);

// POST /participatory-budgets/{id}/votes (Votazione utente)
router.post('/:id/votes', controller.voteParticipatoryBudget);



module.exports = router;