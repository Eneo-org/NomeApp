const express = require("express");
const router = express.Router();
const initiativeController = require("../controllers/initiativeController");

// -- Mapping delle rotte

router.get("/", initiativeController.getAllInitiatives);
router.post("/", initiativeController.createInitiative);
router.get("/:id", initiativeController.getInitiativeById);

// Modifiche all'iniziativa
router.patch("/:id", initiativeController.changeExpirationDate);
router.put("/:id", initiativeController.updateInitiative);

// Azioni specifiche (Sotto-risorse)
// Notare come l'URL continui ad essere gestito qui perché inizia con /initiatives
router.post("/:id/responses", initiativeController.createReply);
router.post("/:id/signatures", initiativeController.signInitiative);

// Gestione "Segui / Non seguire più"
router.post("/:id/follows", initiativeController.followInitiative);
router.delete("/:id/unfollows", initiativeController.unfollowInitiative);

// PATCH /initiatives/:id/status - Cambio stato (Solo Admin)
router.patch("/:id/status", initiativeController.updateInitiativeStatus);

module.exports = router;
