// --- Gestione Profilo e Dashboard ---

const db = require('../config/db');

exports.getUser = async (req, res) => {
    try {
        // 1. "Simuliamo" l'autenticazione leggendo l'header
        // In futuro, qui leggerai il token decodificato (es. req.user.id)
        const userId = req.header('X-Mock-User-Id');

        if (!userId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione mancante: Header X-Mock-User-Id non fornito" 
            });
        }

        // 2. Query al Database
        const query = `
            SELECT ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL, 
                   IS_ADMIN, IS_CITTADINO, CREATED_AT
            FROM UTENTE 
            WHERE ID_UTENTE = ?
        `;
        
        const [rows] = await db.query(query, [userId]);

        // 3. Controllo se l'utente esiste
        if (rows.length === 0) {
            return res.status(404).json({ 
                timeStamp: new Date().toISOString(),
                message: "Utente non trovato" 
            });
        }

        const user = rows[0];

        // 4. Mappatura DB -> JSON 
        const formattedUser = {
            id: user.ID_UTENTE,
            firstName: user.NOME,
            lastName: user.COGNOME,
            fiscalCode: user.CODICE_FISCALE,
            email: user.EMAIL,
            isAdmin: Boolean(user.IS_ADMIN),    // Assicuriamoci che sia true/false
            isCitizen: Boolean(user.IS_CITTADINO),
            createdAt: user.CREATED_AT
        };

        // 5. Invio Risposta
        res.status(200).json(formattedUser);

    } catch (err) {
        console.error("Errore getUser:", err);
        res.status(500).json({ 
            timeStamp: new Date().toISOString(),
            message: "Errore interno del server durante il recupero del profilo",
            details: process.env.NODE_ENV === 'development' ? [{ field: "server", issue: err.message }] : undefined
        });
    }
};

// ... (imports e getUser già presenti)

exports.initiativesDashboard = async (req, res) => {
    try {
        // 1. Autenticazione simulata
        const userId = req.header('X-Mock-User-Id');
        if (!userId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione mancante: Header X-Mock-User-Id non fornito" 
            });
        }

        // 2. Lettura Parametri Query
        const relation = req.query.relation; // 'created', 'signed', 'followed'
        const currentPage = parseInt(req.query.currentPage) || 1;
        const limit = parseInt(req.query.objectsPerPage) || 10;
        const offset = (currentPage - 1) * limit;

        // Validazione parametro relation
        const allowedRelations = ['created', 'signed', 'followed'];
        if (!relation || !allowedRelations.includes(relation)) {
            return res.status(400).json({
                timeStamp: new Date().toISOString(),
                message: "Parametro 'relation' mancante o non valido. Valori ammessi: created, signed, followed"
            });
        }

        // 3. Costruzione Query Dinamica
        let sqlData = '';
        let sqlCount = '';
        let queryParams = [userId];

        // Base select per i campi dell'iniziativa
        const baseSelect = `
            SELECT 
                i.ID_INIZIATIVA, i.TITOLO, i.DESCRIZIONE, i.LUOGO, i.STATO, 
                i.NUM_FIRME, i.DATA_CREAZIONE, i.DATA_SCADENZA, 
                i.ID_AUTORE, i.ID_CATEGORIA, i.ID_PIATTAFORMA, i.URL_ESTERNO
            FROM INIZIATIVA i
        `;

        switch (relation) {
            case 'created':
                // Iniziative create dall'utente
                sqlData = `${baseSelect} WHERE i.ID_AUTORE = ? ORDER BY i.DATA_CREAZIONE DESC LIMIT ? OFFSET ?`;
                sqlCount = `SELECT COUNT(*) as total FROM INIZIATIVA WHERE ID_AUTORE = ?`;
                break;

            case 'signed':
                // Iniziative firmate dall'utente (JOIN con FIRMA_INIZIATIVA)
                sqlData = `
                    ${baseSelect} 
                    JOIN FIRMA_INIZIATIVA f ON i.ID_INIZIATIVA = f.ID_INIZIATIVA 
                    WHERE f.ID_UTENTE = ? 
                    ORDER BY f.DATA_FIRMA DESC 
                    LIMIT ? OFFSET ?`;
                sqlCount = `
                    SELECT COUNT(*) as total 
                    FROM INIZIATIVA i 
                    JOIN FIRMA_INIZIATIVA f ON i.ID_INIZIATIVA = f.ID_INIZIATIVA 
                    WHERE f.ID_UTENTE = ?`;
                break;

            case 'followed':
                // Iniziative seguite dall'utente (JOIN con INIZIATIVA_SALVATA)
                sqlData = `
                    ${baseSelect} 
                    JOIN INIZIATIVA_SALVATA s ON i.ID_INIZIATIVA = s.ID_INIZIATIVA 
                    WHERE s.ID_UTENTE = ? 
                    ORDER BY s.SAVED_AT DESC 
                    LIMIT ? OFFSET ?`;
                sqlCount = `
                    SELECT COUNT(*) as total 
                    FROM INIZIATIVA i 
                    JOIN INIZIATIVA_SALVATA s ON i.ID_INIZIATIVA = s.ID_INIZIATIVA 
                    WHERE s.ID_UTENTE = ?`;
                break;
        }

        // 4. Esecuzione Query
        // Query per il conteggio totale (senza paginazione)
        const [countRows] = await db.query(sqlCount, [userId]);
        const totalObjects = countRows[0].total;

        // Query per i dati (con paginazione)
        // Aggiungiamo limit e offset ai parametri
        const [rows] = await db.query(sqlData, [userId, limit, offset]);

        // 5. Mappatura Dati DB -> JSON 
        const formattedData = rows.map(row => ({
            id: row.ID_INIZIATIVA,
            title: row.TITOLO,
            description: row.DESCRIZIONE,
            place: row.LUOGO || null,
            status: row.STATO,
            signatures: row.NUM_FIRME,
            creationDate: row.DATA_CREAZIONE, // Il driver mysql di solito ritorna Date object
            expirationDate: row.DATA_SCADENZA,
            authorId: row.ID_AUTORE,
            categoryId: row.ID_CATEGORIA,
            platformId: row.ID_PIATTAFORMA,
            externalURL: row.URL_ESTERNO,
            // Nota: Gli allegati richiederebbero una query separata o una JOIN complessa. 
            // Per la dashboard lista, spesso si lascia null o si mette un placeholder.
            attachments: null, 
            reply: null 
        }));

        const totalPages = Math.ceil(totalObjects / limit);

        // 6. Invio Risposta
        res.status(200).json({
            data: formattedData,
            meta: {
                currentPage: currentPage,
                objectsPerPage: limit,
                totalObjects: totalObjects,
                totalPages: totalPages
            }
        });

    } catch (err) {
        console.error("Errore initiativesDashboard:", err);
        res.status(500).json({
            timeStamp: new Date().toISOString(),
            message: "Errore interno durante il recupero della dashboard iniziative",
            details: process.env.NODE_ENV === 'development' ? [{ field: "database", issue: err.message }] : undefined
        });
    }
};

exports.notificationsList = async (req, res) => {
    try {
        // 1. Autenticazione simulata
        const userId = req.header('X-Mock-User-Id');
        if (!userId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione mancante: Header X-Mock-User-Id non fornito" 
            });
        }

        // 2. Lettura Parametri Query
        // read: 'true', 'false', o undefined
        const { read, currentPage, objectsPerPage } = req.query;
        
        const page = parseInt(currentPage) || 1;
        const limit = parseInt(objectsPerPage) || 10;
        const offset = (page - 1) * limit;

        // 3. Costruzione Query Dinamica
        // Costruiamo una base comune per WHERE per usarla sia nel COUNT che nella SELECT dati
        let whereClause = "WHERE ID_UTENTE = ?";
        let queryParams = [userId];

        // Gestione filtro "read" (LETTA nel DB)
        if (read === 'false') {
            whereClause += " AND LETTA = 0";
        } else if (read === 'true') {
            whereClause += " AND LETTA = 1";
        }

        // 4. Esecuzione Query
        
        // A) Conteggio totale (per i metadati)
        const sqlCount = `SELECT COUNT(*) as total FROM NOTIFICA ${whereClause}`;
        const [countRows] = await db.query(sqlCount, queryParams);
        const totalObjects = countRows[0].total;

        // B) Recupero dati effettivi
        const sqlData = `
            SELECT ID_NOTIFICA, TESTO, LETTA, DATA_CREAZIONE, LINK_RIF
            FROM NOTIFICA
            ${whereClause}
            ORDER BY DATA_CREAZIONE DESC
            LIMIT ? OFFSET ?
        `;
        
        // Aggiungiamo limit e offset ai parametri per la seconda query
        const dataParams = [...queryParams, limit, offset];
        const [rows] = await db.query(sqlData, dataParams);

        // 5. Mappatura Dati DB -> JSON (Notification Schema)
        const formattedData = rows.map(row => ({
            id: row.ID_NOTIFICA,
            text: row.TESTO,
            isRead: Boolean(row.LETTA), // Converte 0/1 in false/true
            creationDate: row.DATA_CREAZIONE,
            linkRef: row.LINK_RIF || null
        }));

        const totalPages = Math.ceil(totalObjects / limit);

        // 6. Invio Risposta
        res.status(200).json({
            data: formattedData,
            meta: {
                currentPage: page,
                objectsPerPage: limit,
                totalObjects: totalObjects,
                totalPages: totalPages
            }
        });

    } catch (err) {
        console.error("Errore notificationsList:", err);
        res.status(500).json({
            timeStamp: new Date().toISOString(),
            message: "Errore interno durante il recupero delle notifiche",
            details: process.env.NODE_ENV === 'development' ? [{ field: "database", issue: err.message }] : undefined
        });
    }
};


exports.readNotification = async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.header('X-Mock-User-Id');
        
        // 1. Validazione Header
        if (!userId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione mancante: Header X-Mock-User-Id non fornito" 
            });
        }

        // 2. Validazione Body RIGOROSA
        // Accettiamo SOLO { "isRead": true }
        const { isRead } = req.body;
        
        if (isRead !== true) {
             return res.status(400).json({ 
                timeStamp: new Date().toISOString(),
                message: "Operazione non valida. È possibile solo segnare una notifica come letta (isRead: true). Non è possibile impostarla come non letta." 
            });
        }

        // 3. Verifica Esistenza e Proprietà
        const checkQuery = `
            SELECT ID_NOTIFICA, TESTO, LETTA, DATA_CREAZIONE, LINK_RIF 
            FROM NOTIFICA 
            WHERE ID_NOTIFICA = ? AND ID_UTENTE = ?
        `;
        
        const [rows] = await db.query(checkQuery, [notificationId, userId]);

        if (rows.length === 0) {
            return res.status(404).json({ 
                timeStamp: new Date().toISOString(),
                message: "Notifica non trovata o non appartenente all'utente" 
            });
        }

        const currentNotification = rows[0];

        // 4. Aggiornamento Idempotente (Solo se non è già letta)
        // Non usiamo variabili dinamiche, forziamo 1.
        if (currentNotification.LETTA === 0) {
            await db.query(
                'UPDATE NOTIFICA SET LETTA = 1 WHERE ID_NOTIFICA = ?', 
                [notificationId]
            );
            // Aggiorniamo l'oggetto in memoria
            currentNotification.LETTA = 1;
        }

        // 5. Mappatura Risposta
        const responseData = {
            id: currentNotification.ID_NOTIFICA,
            text: currentNotification.TESTO,
            isRead: true, // Ora è sicuramente true
            creationDate: currentNotification.DATA_CREAZIONE,
            linkRef: currentNotification.LINK_RIF || null
        };

        res.status(200).json(responseData);

    } catch (err) {
        console.error("Errore readNotification:", err);
        res.status(500).json({ 
            timeStamp: new Date().toISOString(),
            message: "Errore interno durante l'aggiornamento della notifica",
            details: process.env.NODE_ENV === 'development' ? [{ field: "database", issue: err.message }] : undefined
        });
    }
};
// --- Gestione Amministrativa e Registrazione ---

exports.userRegistration = async (req, res) => { //da fare dopo aver implementato google auth
    // Registra un nuovo utente (dopo il primo login Google)
    res.status(200).json({ 
        message: "TODO: Implementare userRegistration" 
    });
};


exports.showAdminUsers = async (req, res) => {
    try {
        const userId = req.header('X-Mock-User-Id');
        
        // 1. Validazione Header
        if (!userId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione richiesta: Header X-Mock-User-Id mancante" 
            });
        }

        // 2. Controllo Permessi Admin
        // Recuperiamo solo IS_ADMIN per la verifica, non servono più i dati anagrafici del richiedente per la risposta
        const queryCheckAdmin = 'SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?';
        const [admins] = await db.query(queryCheckAdmin, [userId]);

        if (admins.length === 0) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Utente richiedente non trovato." 
            });
        }

        if (!admins[0].IS_ADMIN) {
            return res.status(403).json({ 
                timeStamp: new Date().toISOString(),
                message: "Accesso negato: solo gli amministratori possono visualizzare la lista utenti." 
            });
        }

        // 3. Gestione Parametri Query
        const { isAdmin } = req.query;
        
        // Query base: selezioniamo esplicitamente NOME e COGNOME per metterli nell'array
        let queryUsers = `
            SELECT  NOME, COGNOME, CODICE_FISCALE
            FROM UTENTE
            WHERE 1=1
        `;
        const queryParams = [];

        //mostriamo solo gli admin
        queryUsers += ' AND IS_ADMIN = 1';
        // Ordinamento alfabetico
        queryUsers += ' ORDER BY COGNOME ASC, NOME ASC';

        const [rows] = await db.query(queryUsers, queryParams);

        // 4. Mappatura Dati
        // Inseriamo nome e cognome di ogni utente trovato nell'oggetto di risposta
        const usersList = rows.map(user => ({
            firstName: user.NOME,
            lastName: user.COGNOME,
            fiscalCode: user.CODICE_FISCALE,
        }));

        // 5. Risposta
        // Restituiamo solo l'oggetto 'data', senza i dati dell'admin loggato alla radice
        res.status(200).json({
            data: usersList
        });

    } catch (err) {
        console.error("Errore showAdminUsers:", err);
        res.status(500).json({ 
            timeStamp: new Date().toISOString(),
            message: "Errore interno del server durante il recupero della lista utenti",
            details: process.env.NODE_ENV === 'development' ? [{ field: "database", issue: err.message }] : undefined
        });
    }
};

exports.changePrivileges = async (req, res) => {
    try {
        const targetUserId = req.params.id; // L'ID dell'utente da modificare
        const requesterId = req.header('X-Mock-User-Id'); // Chi sta facendo la richiesta

        // 1. Validazione Header (Autenticazione Mock)
        if (!requesterId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione richiesta: Header X-Mock-User-Id mancante" 
            });
        }

        // 2. Validazione Body
        const { isAdmin } = req.body;
        if (typeof isAdmin !== 'boolean') {
            return res.status(400).json({ 
                timeStamp: new Date().toISOString(),
                message: "Formato non valido: 'isAdmin' deve essere un booleano." 
            });
        }

        // 3. Controllo Permessi Richiedente (Deve essere Admin)
        const queryCheckAdmin = 'SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?';
        const [requesters] = await db.query(queryCheckAdmin, [requesterId]);

        if (requesters.length === 0 || !requesters[0].IS_ADMIN) {
            return res.status(403).json({ 
                timeStamp: new Date().toISOString(),
                message: "Accesso negato: operazione riservata agli amministratori." 
            });
        }

        // 4. Controllo Auto-Revoca (RF 10.3)
        // Impediamo a un admin di togliersi i privilegi da solo per non rimanere chiusi fuori
        // Nota: convertiamo in stringa o intero per sicurezza nel confronto
        if (String(targetUserId) === String(requesterId) && isAdmin === false) {
            return res.status(403).json({ 
                timeStamp: new Date().toISOString(),
                message: "Operazione non consentita: non puoi revocare i tuoi stessi privilegi di amministratore." 
            });
        }

        // 5. Verifica Esistenza Utente Target
        const checkTargetQuery = 'SELECT ID_UTENTE FROM UTENTE WHERE ID_UTENTE = ?';
        const [targets] = await db.query(checkTargetQuery, [targetUserId]);

        if (targets.length === 0) {
            return res.status(404).json({ 
                timeStamp: new Date().toISOString(),
                message: "Utente non trovato." 
            });
        }

        // 6. Aggiornamento Privilegi (RF 10.2 e RF 10.3)
        const updateQuery = 'UPDATE UTENTE SET IS_ADMIN = ? WHERE ID_UTENTE = ?';
        // Converto il booleano true/false in 1/0 per il DB
        await db.query(updateQuery, [isAdmin ? 1 : 0, targetUserId]);

        // 7. Risposta
        res.status(200).json({ 
            message: `Privilegi aggiornati con successo. Utente ${targetUserId} è ora ${isAdmin ? 'Admin' : 'Utente standard'}.`
        });

    } catch (err) {
        console.error("Errore changePrivileges:", err);
        res.status(500).json({ 
            timeStamp: new Date().toISOString(),
            message: "Errore interno durante l'aggiornamento dei privilegi",
            details: process.env.NODE_ENV === 'development' ? [{ field: "database", issue: err.message }] : undefined
        });
    }
};