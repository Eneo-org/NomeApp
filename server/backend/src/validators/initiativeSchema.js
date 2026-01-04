const Joi = require("joi");

// attachmentSchema è stato rimosso perché la validazione dei file 
// avviene ora tramite Multer e controlli diretti nel controller.

exports.initiativeSchema = Joi.object({
  title: Joi.string().max(255).required().messages({
    "string.empty": "Il titolo è obbligatorio",
    "string.max": "Il titolo non può superare i 255 caratteri",
  }),
  description: Joi.string().required().messages({
    "string.empty": "La descrizione è obbligatoria",
  }),
  place: Joi.string().max(64).required().messages({
    "string.empty": "Il luogo è obbligatorio",
  }),
  // Joi converte automaticamente le stringhe numeriche in numeri per default
  categoryId: Joi.number().integer().required().messages({
    "number.base": "La categoria deve essere un numero intero positivo",
  }),
  // Attachments rimosso: gestito separatamente
});

exports.changeExpirationSchema = Joi.object({
  expirationDate: Joi.date().greater("now").required().messages({
    "date.base": "La data di scadenza deve essere una data valida",
    "date.greater": "La nuova data di scadenza deve essere nel futuro",
    "any.required": "Il campo expirationDate è obbligatorio",
  }),
});

exports.administrationReplySchema = Joi.object({
  status: Joi.string()
    .valid("In corso", "Approvata", "Respinta", "Scaduta", "Archiviata")
    .required()
    .messages({
      "any.only": "Lo stato deve essere uno dei valori consentiti.",
    }),
  motivations: Joi.string().required().min(10).messages({
    "string.empty": "Le motivazioni sono obbligatorie",
    "string.min": "Le motivazioni devono essere lunghe almeno 10 caratteri",
  }),
  // Attachments rimosso: gestito separatamente
});