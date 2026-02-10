const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");

// --- ROTTE DI AUTENTICAZIONE ---

// 1. Google Login: Riceve il token, verifica se l'utente esiste o se deve registrarsi
// Questa è la rotta che il frontend chiama con axios.post('/auth/google')
router.post("/google", authController.googleLogin);

// 1b. Teacher Login: accesso test per docenti con secret
router.post("/teacher-login", authController.teacherLogin);

// 2. Invio OTP: Manda la mail con il codice (per i nuovi utenti)
router.post("/otp", authController.sendOtp);

// 3. Registrazione Utente
router.post("/register", userController.userRegistration);

// --- ALTRE ROTTE ---
router.post("/logout", authController.logout);

module.exports = router;
