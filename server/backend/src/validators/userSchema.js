const Joi = require('joi');

// Schema per il Login (POST /auth/google)
exports.loginSchema = Joi.object({
    tokenId: Joi.string().required().messages({
        'string.empty': 'Il tokenId è obbligatorio',
        'any.required': 'Il campo tokenId è richiesto'
    })
});

// Schema per la Registrazione Utente (POST /users)
exports.registrationSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Inserire un indirizzo email valido',
        'any.required': 'L\'email è obbligatoria'
    }),
    fiscalCode: Joi.string().length(16).uppercase().required().messages({
        'string.length': 'Il Codice Fiscale deve essere di 16 caratteri',
        'any.required': 'Il Codice Fiscale è obbligatorio'
    })
});

// Schema per il cambio privilegi Admin (PATCH /users/:id)
exports.changePrivilegesSchema = Joi.object({
    isAdmin: Joi.boolean().required().messages({
        'any.required': 'Il campo isAdmin è obbligatorio'
    })
});

// Schema per segnare una notifica come letta (PATCH /users/me/notifications/:id)
exports.readNotificationSchema = Joi.object({
    isRead: Joi.boolean().valid(true).required().messages({
        'any.only': 'Il valore deve essere true per segnare la notifica come letta'
    })
});