const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// --- ROTTE DI AUTENTICAZIONE ---

// 1. Google Login: Riceve il token, verifica se l'utente esiste o se deve registrarsi
// Questa è la rotta che il frontend chiama con axios.post('/auth/google-login')
router.post("/google-login", authController.googleLogin);

// 2. Invio OTP: Manda la mail con il codice (per i nuovi utenti)
router.post("/send-otp", authController.sendOtp);



// --- ALTRE ROTTE ---
router.post("/logout", authController.logout);

module.exports = router;
