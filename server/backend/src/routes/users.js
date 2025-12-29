const express = require('express');
const router = express.Router();
// Nota: Anche questo controller lo creeremo a breve
const userController = require('../controllers/userController');

// --- 1. Rotte relative all'utente corrente (/me) ---
// È fondamentale che queste stiano PRIMA di /:id

// GET /users/me - Profilo utente
router.get('/me', userController.getUser);

// GET /users/me/initiatives - Dashboard iniziative
router.get('/me/initiatives', userController.initiativesDashboard);

// GET /users/me/notifications - Lista notifiche
router.get('/me/notifications', userController.notificationsList);

// PATCH /users/me/notifications/:id - Segna notifica come letta
router.patch('/me/notifications/:id', userController.readNotification);


// --- 2. Rotte generali (/users) ---

// POST /users - Registrazione nuovo utente
router.post('/', userController.userRegistration);

// GET /users - Lista utenti (per Admin, es. filtro isAdmin=true)
router.get('/', userController.showAdminUsers);


// --- 3. Rotte con parametri ID specifici (/users/:id) ---

// PATCH /users/:id - Cambio privilegi (Admin)
router.patch('/:id', userController.changePrivileges);

module.exports = router;