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

  // Ho aggiunto allow('', null) perché place potrebbe arrivare vuoto dal form
  place: Joi.string().max(64).allow("", null).optional().messages({
    "string.max": "Il luogo non può superare i 64 caratteri",
  }),

  // FIX IMPORTANTE: Accetta sia numeri che stringhe numeriche (per FormData)
  categoryId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string().pattern(/^[0-9]+$/))
    .required()
    .messages({
      "any.required": "La categoria è obbligatoria",
      "alternatives.match": "La categoria deve essere un numero valido",
    }),

  // FIX IMPORTANTE: Aggiunto platformId che mancava e causava l'errore 400
  platformId: Joi.alternatives()
    .try(Joi.number().integer(), Joi.string())
    .optional(),

  // .unknown(true) permette di ignorare campi extra (come il file stesso) senza dare errore
}).unknown(true);

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
