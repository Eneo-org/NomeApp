const express = require("express");
const router = express.Router();
const initiativeController = require("../controllers/initiativeController");
const upload = require("../middleware/upload");

// --- 1. ROTTE STATICHE E LISTE (Devono stare IN CIMA) ---

// QUESTA deve stare prima di /:id
router.get("/admin/expiring", initiativeController.getExpiringInitiatives);

router.get("/", initiativeController.getAllInitiatives);

router.post(
  "/",
  upload.uploadInitiative.array("attachments"),
  initiativeController.createInitiative
);

// --- 2. ROTTE DINAMICHE (Con :id) ---

// Questa cattura tutto quello che assomiglia a un ID.
// Se metti /admin/expiring sotto a questa, non verrà mai raggiunta!
router.get("/:id", initiativeController.getInitiativeById);

// ... il resto delle rotte rimangono uguali ...
router.patch("/:id", initiativeController.changeExpirationDate);
router.put("/:id", initiativeController.updateInitiative);

// (Assicurati che questa parte combaci con il frontend come abbiamo detto prima)
router.post(
  "/:id/responses",
  upload.uploadReply.array("attachments"),
  initiativeController.createReply
);

router.post("/:id/signatures", initiativeController.signInitiative);
router.post("/:id/follows", initiativeController.followInitiative);
router.delete("/:id/unfollows", initiativeController.unfollowInitiative);
router.patch("/:id/status", initiativeController.updateInitiativeStatus);

module.exports = router;
