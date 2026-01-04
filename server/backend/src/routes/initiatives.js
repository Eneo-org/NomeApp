const express = require("express");
const router = express.Router();
const initiativeController = require("../controllers/initiativeController");
const upload = require("../middleware/upload");

// -- Mapping delle rotte

router.get("/", initiativeController.getAllInitiatives);
/**
 * POST /initiatives
 * Middleware 'uploadInitiative': accetta solo immagini.
 * .array('attachments'): accetta file multipli dal campo form 'attachments'.
 * Nota: I file vengono caricati PRIMA che il controller venga eseguito.
 */
router.post(
  "/", 
  upload.uploadInitiative.array("attachments"), 
  initiativeController.createInitiative
);
router.get("/:id", initiativeController.getInitiativeById);

// Modifiche all'iniziativa
router.patch("/:id", initiativeController.changeExpirationDate);
router.put("/:id", initiativeController.updateInitiative);

// Azioni specifiche (Sotto-risorse)
// Notare come l'URL continui ad essere gestito qui perché inizia con /initiatives
/**
 * POST /initiatives/:id/responses
 * Middleware 'uploadReply': accetta immagini e PDF.
 */
router.post(
  "/:id/responses", 
  upload.uploadReply.array("attachments"), 
  initiativeController.createReply
);
router.post("/:id/signatures", initiativeController.signInitiative);

// Gestione "Segui / Non seguire più"
router.post("/:id/follows", initiativeController.followInitiative);
router.delete("/:id/unfollows", initiativeController.unfollowInitiative);

// PATCH /initiatives/:id/status - Cambio stato (Solo Admin)
router.patch("/:id/status", initiativeController.updateInitiativeStatus);

module.exports = router;
