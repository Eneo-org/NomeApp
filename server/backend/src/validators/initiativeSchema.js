const Joi = require('joi');

const initiativeSchema = Joi.object({
    title: Joi.string().max(255).required().messages({
        'string.empty': 'Il titolo è obbligatorio',
        'string.max': 'Il titolo non può superare i 255 caratteri'
    }),
    description: Joi.string().required().messages({
        'string.empty': 'La descrizione è obbligatoria'
    }),
    place: Joi.string().max(64).required().messages({
        'string.empty': 'Il luogo è obbligatorio'
    }),
    categoryId: Joi.number().integer().required().messages({
        'number.base': 'La categoria deve essere un numero intero positivo'
    }),
    attachments: Joi.array().items(
        Joi.object({
            fileName: Joi.string().required(),
            filePath: Joi.string().required(),
            fileType: Joi.string().allow(null, '').optional()
        }).unknown(true) 
    ).required()
});

module.exports = initiativeSchema;