const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// --- 1. Rotte relative all'utente corrente (/me) ---
router.get("/me", userController.getUser);
router.get("/me/initiatives", userController.initiativesDashboard);
router.get("/me/notifications", userController.notificationsList);
router.patch("/me/notifications/:id", userController.readNotification);

// --- 2. Rotte generali e specifiche (/users) ---

// >>> NUOVA ROTTA: Pre-autorizzazione Admin <<<
router.post("/admin/pre-authorize", userController.preAuthorizeAdmin);

router.get("/admin/list", userController.showAdminUsers);
router.post("/", userController.userRegistration);

// >>> NUOVA ROTTA: Ricerca (METTERE PRIMA DI /:id) <<<
router.get("/search", userController.searchUserByFiscalCode);

router.get("/", userController.showAdminUsers);

// --- 3. Rotte con parametri ID specifici (/users/:id) ---
router.patch("/:id/role", userController.changePrivileges);

module.exports = router;
