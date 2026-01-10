const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middleware/authMiddleware"); // Assicurati di avere il middleware auth

// Tutte le rotte sono protette (richiedono login)
router.use(authMiddleware);

router.get("/", notificationController.getUserNotifications);
router.put("/:id/read", notificationController.markAsRead);
router.put("/read-all", notificationController.markAllAsRead);

module.exports = router;
