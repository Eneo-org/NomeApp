const Joi = require("joi");

const optionSchema = Joi.object({
  id: Joi.number().integer(),

  text: Joi.string().max(250).required().messages({
    "string.empty": "Il testo dell'opzione è obbligatorio",
    "string.max": "Il testo dell'opzione non può superare i 250 caratteri",
  }),
  position: Joi.number().integer().min(1),
});

// Helper per calcolare data minima (14 giorni da ora)
const getMinExpirationDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(0, 0, 0, 0);
  return date;
};

exports.createBudgetSchema = Joi.object({
  id: Joi.number().integer(),
  creatorId: Joi.number().integer(),

  title: Joi.string().max(200).required().messages({
    "string.empty": "Il titolo è obbligatorio",
    "string.max": "Il titolo non può superare i 200 caratteri",
  }),

  expirationDate: Joi.date()
    .greater("now")
    .min(getMinExpirationDate())
    .required()
    .messages({
      "date.greater": "La data di scadenza deve essere futura",
      "date.min":
        "La data di scadenza deve essere almeno 14 giorni dalla data odierna (RF8)",
    }),

  options: Joi.array().items(optionSchema).min(3).max(5).required().messages({
    "array.min": "Devi inserire almeno 3 opzioni per il voto",
    "array.max": "Puoi inserire al massimo 5 opzioni per il voto",
    "any.required": "Le opzioni sono obbligatorie",
  }),

  createdAt: Joi.date(),
});

exports.voteBudgetSchema = Joi.object({
  position: Joi.number().integer().min(1).required().messages({
    "number.base": "La posizione deve essere un numero intero",
    "number.min": "La posizione deve essere almeno 1",
    "any.required": "Il campo position è obbligatorio",
  }),
});
