const Joi = require('joi');

const optionSchema = Joi.object({
    id: Joi.number().integer(), 
    
    text: Joi.string().max(250).required().messages({
        'string.empty': 'Il testo dell\'opzione è obbligatorio',
        'string.max': 'Il testo dell\'opzione non può superare i 250 caratteri'
    }),
    position: Joi.number().integer().min(1)
});

exports.createBudgetSchema = Joi.object({

    id: Joi.number().integer(),
    creatorId: Joi.number().integer(),


    title: Joi.string().max(200).required().messages({
        'string.empty': 'Il titolo è obbligatorio',
        'string.max': 'Il titolo non può superare i 200 caratteri'
    }),
    expirationDate: Joi.date().greater('now').required().messages({
        'date.greater': 'La data di scadenza deve essere futura'
    }),
    options: Joi.array().items(optionSchema).min(2).required().messages({
        'array.min': 'Devi inserire almeno 2 opzioni per il voto'
    }),
    
    createdAt: Joi.date() 
});

exports.voteBudgetSchema = Joi.object({
    position: Joi.number().integer().min(1).required().messages({
        'number.base': 'La posizione deve essere un numero intero',
        'number.min': 'La posizione deve essere almeno 1',
        'any.required': 'Il campo position è obbligatorio'
    })
});