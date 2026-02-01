const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middleware/authMiddleware");

// --- 1. Rotte relative all'utente corrente (/me) ---
router.get("/me", authMiddleware, userController.getUser);
router.get("/me/initiatives", authMiddleware, userController.initiativesDashboard);
router.get("/me/notifications", authMiddleware, notificationController.getUserNotifications);
router.patch(
  "/me/notifications/mark-all-as-read",
  authMiddleware,
  notificationController.markAllAsRead
);
router.patch("/me/notifications/:id", authMiddleware, notificationController.markAsRead);

// --- 2. Rotte generali e specifiche (/users) ---

router.post("/admin/pre-authorize", authMiddleware, userController.preAuthorizeAdmin);

router.post("/", userController.userRegistration);

router.get("/", authMiddleware, userController.showAdminUsers);

// --- 3. Rotte con parametri ID specifici (/users/:id) ---
router.patch("/:id", authMiddleware, userController.changePrivileges);

module.exports = router;
