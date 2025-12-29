const express = require('express');
const router = express.Router();
// Nota: Questo controller lo creeremo nel prossimo step
const authController = require('../controllers/authController');

// POST /auth/google
router.post('/google', authController.loginAndAuth);

// POST /auth/logout
router.post('/logout', authController.logout);

module.exports = router;