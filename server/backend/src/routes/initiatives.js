const express = require("express");
const router = express.Router();
const initiativeController = require("../controllers/initiativeController");
const upload = require("../middleware/upload");
const authMiddleware = require("../middleware/authMiddleware");

// --- 1. ROTTE STATICHE E LISTE (Devono stare IN CIMA) ---

// QUESTA deve stare prima di /:id
router.get("/admin/expiring", authMiddleware, initiativeController.getExpiringInitiatives);
router.get("/cooldown", authMiddleware, initiativeController.checkCooldown);


router.get("/", initiativeController.getAllInitiatives);

router.post(
  "/",
  authMiddleware,
  upload.uploadInitiative.array("attachments"),
  initiativeController.createInitiative
);

// --- 2. ROTTE DINAMICHE (Con :id) ---

// Questa cattura tutto quello che assomiglia a un ID.
// Se metti /admin/expiring sotto a questa, non verrà mai raggiunta!
router.get("/:id", initiativeController.getInitiativeById);

// ... il resto delle rotte rimangono uguali ...
router.patch("/:id", authMiddleware, initiativeController.changeExpirationDate);
router.put("/:id", authMiddleware, initiativeController.updateInitiative);

// (Assicurati che questa parte combaci con il frontend come abbiamo detto prima)
router.post(
  "/:id/responses",
  authMiddleware,
  upload.uploadReply.array("attachments"),
  initiativeController.createReply
);

router.post("/:id/signatures", authMiddleware, initiativeController.signInitiative);
router.post("/:id/follows", authMiddleware, initiativeController.followInitiative);
router.delete("/:id/unfollows", authMiddleware, initiativeController.unfollowInitiative);
router.patch("/:id/status", authMiddleware, initiativeController.updateInitiativeStatus);

module.exports = router;
