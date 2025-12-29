const Joi = require('joi');

// 1. Definiamo lo schema per l'allegato una volta sola
const attachmentSchema = Joi.object({
    fileName: Joi.string().required(),
    filePath: Joi.string().required(),
    fileType: Joi.string().allow(null, '').optional()
}).unknown(true); // .unknown(true) permette altri campi se necessario (es. size, encoding)

exports.initiativeSchema = Joi.object({
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
    attachments: Joi.array().items(attachmentSchema).required()
});

exports.changeExpirationSchema = Joi.object({
    expirationDate: Joi.date().greater('now').required().messages({
        'date.base': 'La data di scadenza deve essere una data valida',
        'date.greater': 'La nuova data di scadenza deve essere nel futuro',
        'any.required': 'Il campo expirationDate è obbligatorio'
    })
});

exports.administrationReplySchema = Joi.object({
    status: Joi.string()
        .valid('In corso', 'Approvata', 'Respinta', 'Scaduta', 'Archiviata')
        .required()
        .messages({
            'any.only': 'Lo stato deve essere uno dei valori consentiti (es. Approvata, Respinta)'
        }),
    motivations: Joi.string().required().min(10).messages({
        'string.empty': 'Le motivazioni sono obbligatorie',
        'string.min': 'Le motivazioni devono essere lunghe almeno 10 caratteri'
    }),
    attachments: Joi.array().items(attachmentSchema).optional().allow(null)
});
