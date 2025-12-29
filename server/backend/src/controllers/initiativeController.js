const db = require('../config/db');
const { initiativeSchema } = require('../validators/initiativeSchema');
const { changeExpirationSchema } = require('../validators/initiativeSchema');
const { administrationReplySchema } = require('../validators/initiativeSchema');
const { INITIATIVE_SORT_MAP } = require('../config/constants'); 

exports.getAllInitiatives = async (req, res) => {
    try {
        // 1. Estrazione e Parsing dei Parametri
        const { 
            currentPage = 1, 
            objectsPerPage = 10, 
            status, 
            search, 
            categoryID, 
            sortBy, 
            order, 
            minSignatures, 
            maxSignatures 
        } = req.query;

        const page = Math.max(1, parseInt(currentPage));
        const limit = Math.max(1, parseInt(objectsPerPage));
        const offset = (page - 1) * limit;

        // 2. Costruzione Dinamica della Clausola WHERE
        let whereConditions = ['1=1']; 
        let queryParams = [];

        // Filtro: Status (colonna 'STATO')
        if (status) {
            whereConditions.push('i.STATO = ?');
            queryParams.push(status);
        }

        // Filtro: Categoria (colonna 'ID_CATEGORIA')
        if (categoryID) {
            whereConditions.push('i.ID_CATEGORIA = ?');
            queryParams.push(parseInt(categoryID));
        }

        // Filtro: Range Firme (colonna 'NUM_FIRME')
        if (minSignatures !== undefined) {
            whereConditions.push('i.NUM_FIRME >= ?');
            queryParams.push(parseInt(minSignatures));
        }
        if (maxSignatures !== undefined) {
            whereConditions.push('i.NUM_FIRME <= ?');
            queryParams.push(parseInt(maxSignatures));
        }

        // Filtro: Ricerca Libera (Titolo, Descrizione, Luogo)
        if (search) {
            whereConditions.push('(i.TITOLO LIKE ? OR i.DESCRIZIONE LIKE ? OR i.LUOGO LIKE ?)');
            const likeTerm = `%${search}%`;
            queryParams.push(likeTerm, likeTerm, likeTerm);
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ');

        // // 3. Gestione Ordinamento (Mappatura colonne DB)
        // const sortMap = {
        //     1: 'i.DATA_CREAZIONE', // Default o ID 1
        //     2: 'i.TITOLO',
        //     3: 'i.NUM_FIRME'       // Aggiornato da FIRME a NUM_FIRME
        // };
        
        const sortColumn = INITIATIVE_SORT_MAP[sortBy] || 'i.DATA_CREAZIONE';
        const sortDirection = (order && order.toLowerCase() === 'asc') ? 'ASC' : 'DESC';

        // 4. Query per il conteggio totale (per MetaData)
        const countQuery = `SELECT COUNT(*) as total FROM INIZIATIVA i ${whereClause}`;
        const [countRows] = await db.query(countQuery, queryParams);
        const totalObjects = countRows[0].total;

        // 5. Query per i dati (Con subquery corretta per ALLEGATO)
        const dataQuery = `
            SELECT 
                i.*,
                (SELECT FILE_PATH 
                 FROM ALLEGATO a 
                 WHERE a.ID_INIZIATIVA = i.ID_INIZIATIVA 
                 LIMIT 1) as first_attachment
            FROM INIZIATIVA i
            ${whereClause}
            ORDER BY ${sortColumn} ${sortDirection}
            LIMIT ? OFFSET ?
        `;

        const dataParams = [...queryParams, limit, offset];
        const [rows] = await db.query(dataQuery, dataParams);

        // 6. Formattazione (Mapping DB -> JSON API)
        const formattedData = rows.map(row => ({
            id: row.ID_INIZIATIVA,      // Corretto: ID_INIZIATIVA
            title: row.TITOLO,
            description: row.DESCRIZIONE,
            place: row.LUOGO,
            status: row.STATO,
            signatures: row.NUM_FIRME || 0, // Corretto: NUM_FIRME
            creationDate: row.DATA_CREAZIONE,
            expirationDate: row.DATA_SCADENZA,
            authorId: row.ID_AUTORE,
            categoryId: row.ID_CATEGORIA,
            platformId: row.ID_PIATTAFORMA,
            externalURL: row.URL_ESTERNO,
            attachment: row.first_attachment 
        }));

        // 7. Invio Risposta
        res.status(200).json({
            data: formattedData,
            meta: {
                currentPage: page,
                objectsPerPage: limit,
                totalObjects: totalObjects,
                totalPages: Math.ceil(totalObjects / limit)
            }
        });

    } catch (err) {
        console.error("Errore getAllInitiatives:", err);
        res.status(500).json({ 
            message: "Errore interno del server",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};


// --- 2. Logica del Controller ---
exports.createInitiative = async (req, res) => {
    let connection; // Variabile per la connessione dedicata alla transazione

    try {
        // A. VALIDAZIONE INPUT
        // ---------------------------------------------------------
        // Validiamo l'Header (Mock User)
        const mockUserId = req.header('X-Mock-User-Id');
        if (!mockUserId) {
            return res.status(400).json({ 
                timestamp: new Date().toISOString(),
                message: "Header X-Mock-User-Id mancante",
            });
        }

        // Validiamo il Body con Joi
        const { error, value } = initiativeSchema.validate(req.body, { abortEarly: false });
        
        if (error) {
            return res.status(400).json({
                message: "Errore di validazione",
                details: error.details.map(err => ({
                    field: err.context.key,
                    issue: err.message
                }))
            });
        }

        // Estraiamo i dati puliti e validati
        const { title, description, place, categoryId, attachments } = value;


        // B. AVVIO TRANSAZIONE DATABASE
        // ---------------------------------------------------------
        // Otteniamo una connessione specifica dal pool (non usiamo db.query diretto)
        connection = await db.getConnection();
        
        // Iniziamo la transazione: da qui in poi, o tutto va bene, o nulla viene salvato
        await connection.beginTransaction();


        // C. QUERY 1: INSERIMENTO INIZIATIVA
        // ---------------------------------------------------------
        const queryIniziativa = `
            INSERT INTO INIZIATIVA (TITOLO, DESCRIZIONE, LUOGO, ID_CATEGORIA, ID_AUTORE, STATO)
            VALUES (?, ?, ?, ?, ?, 'In corso')
        `;

        const [resultInit] = await connection.execute(queryIniziativa, [
            title, description, place, categoryId, mockUserId
        ]);

        const newInitiativeId = resultInit.insertId;


        // D. QUERY 2: INSERIMENTO ALLEGATI (Ciclo)
        // ---------------------------------------------------------
        if (attachments && attachments.length > 0) {
            const queryAllegato = `
                INSERT INTO ALLEGATO (FILE_NAME, FILE_PATH, FILE_TYPE, ID_INIZIATIVA)
                VALUES (?, ?, ?, ?)
            `;

            // 1. Creiamo un array di "Promesse"
            // Invece di eseguire e aspettare, mappiamo ogni file a una richiesta DB
            const insertPromises = attachments.map(file => {
                return connection.execute(queryAllegato, [
                    file.fileName,
                    file.filePath,
                    file.fileType || null,
                    newInitiativeId
                ]);
            });

            // 2. Lanciamo tutte le richieste insieme e aspettiamo che finiscano tutte
            await Promise.all(insertPromises);
        }


        // E. COMMIT E CHIUSURA
        // ---------------------------------------------------------
        // Se siamo arrivati qui senza errori, confermiamo le modifiche al DB
        await connection.commit();

        // Rispondiamo al client (201 Created)
        res.status(201).json({
            id: newInitiativeId,
            title,
            description,
            place,
            categoryId,
            status: 'In corso',
            attachments: attachments,
            authorId: mockUserId,
            createdAt: new Date().toISOString()
        });

    } catch (err) {
        // F. GESTIONE ERRORI E ROLLBACK
        // ---------------------------------------------------------
        // Se qualcosa è andato storto, annulliamo tutto
        if (connection) await connection.rollback();

        console.error("Errore CreateInitiative:", err);

        // Gestione errore specifico foreign key (es. utente o categoria non trovati)
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                timestamp: new Date().toISOString(),
                message: "Riferimento non valido: ID Categoria o ID Utente inesistente."
        
            });
        }

        // Errore generico del server
        res.status(500).json({
            timestamp: new Date().toISOString(),
            message: "Errore interno del server durante la creazione."
        });

    } finally {
        // G. RILASCIO CONNESSIONE
        // ---------------------------------------------------------
        // È fondamentale rilasciare la connessione al pool, altrimenti il server si blocca dopo 10 richieste
        if (connection) connection.release();
    }
};

exports.getInitiativeById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
             return res.status(400).json({
                timeStamp: new Date().toISOString(),
                message: "ID Iniziativa non valido o mancante",
                details: [{ field: "id", issue: "L'ID deve essere un numero intero positivo" }]
            });
        }

        // Richiamiamo la funzione helper che contiene tutta la logica complessa
        const data = await _getDetailedInitiativeData(id);

        // Se la funzione helper ritorna null, significa che non esiste
        if (!data) {
            return res.status(404).json({ 
                timeStamp: new Date().toISOString(),
                message: "Iniziativa non trovata"
            });
        }

        // Se esiste, restituiamo i dati
        res.status(200).json(data);

    } catch (err) {
        console.error("Errore getInitiativeById:", err);
        res.status(500).json({
            timeStamp: new Date().toISOString(),
            message: "Errore interno del server durante il recupero dei dettagli.",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.changeExpirationDate = async (req, res) => {
    try {
        const initiativeId = req.params.id;
        const userId = req.header('X-Mock-User-Id');
        
        // 1. Validazione Header
        if (!userId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione richiesta: Header X-Mock-User-Id mancante" 
            });
        }

        // 2. Validazione Body (Joi)
        const { error, value } = changeExpirationSchema.validate(req.body);
        if (error) {
            return res.status(422).json({
                timeStamp: new Date().toISOString(),
                message: "Errore di validazione",
                details: error.details.map(d => ({ field: d.context.key, issue: d.message }))
            });
        }
        const { expirationDate } = value;

        // 3. Controllo Permessi (Solo Admin)
        const [users] = await db.query('SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?', [userId]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: "Utente non trovato" });
        }
        if (!users[0].IS_ADMIN) {
            return res.status(403).json({ 
                timeStamp: new Date().toISOString(),
                message: "Operazione non consentita: solo gli amministratori possono estendere le scadenze." 
            });
        }

        // 4. Verifica Esistenza Iniziativa
        const [initiatives] = await db.query('SELECT ID_INIZIATIVA FROM INIZIATIVA WHERE ID_INIZIATIVA = ?', [initiativeId]);
        if (initiatives.length === 0) {
            return res.status(404).json({ 
                timeStamp: new Date().toISOString(),
                message: "Iniziativa non trovata" 
            });
        }

        // 5. Update nel Database
        // Logica: Aggiorna la data E se lo stato era 'Scaduta', lo riporta a 'In corso'.
        const updateQuery = `
            UPDATE INIZIATIVA 
            SET DATA_SCADENZA = ?, 
                STATO = CASE WHEN STATO = 'Scaduta' THEN 'In corso' ELSE STATO END 
            WHERE ID_INIZIATIVA = ?
        `;
        
        await db.query(updateQuery, [expirationDate, initiativeId]);

        // 6. Recupero Dati Aggiornati (Formato DetailedInitiative)
        // Usiamo una funzione helper per non duplicare la logica di lettura complessa
        const updatedInitiative = await _getDetailedInitiativeData(initiativeId);

        return res.status(200).json(updatedInitiative);

    } catch (err) {
        console.error("Errore changeExpirationDate:", err);
        return res.status(500).json({ 
            timeStamp: new Date().toISOString(),
            message: "Errore interno del server durante l'aggiornamento della scadenza" 
        });
    }
};

exports.updateInitiative = async (req, res) => {
    res.json({ message: "TODO" });
};

// Assicurati di importare lo schema di validazione all'inizio del file se non c'è già
// const { administrationReplySchema } = require('../validators/initiativeSchema');

exports.createReply = async (req, res) => {
    let connection;

    try {
        const initiativeId = req.params.id;
        const adminId = req.header('X-Mock-User-Id');

        // 1. VALIDAZIONE AUTENTICAZIONE
        if (!adminId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione richiesta: Header X-Mock-User-Id mancante" 
            });
        }

        // 2. VALIDAZIONE BODY
        const { error, value } = administrationReplySchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                timeStamp: new Date().toISOString(),
                message: "Errore di validazione",
                details: error.details.map(err => ({ field: err.context.key, issue: err.message }))
            });
        }
        const { status, motivations, attachments } = value;

        // 3. AVVIO TRANSAZIONE
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 4. CONTROLLI PRELIMINARI
        const [users] = await connection.query('SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?', [adminId]);
        if (users.length === 0 || !users[0].IS_ADMIN) {
            await connection.rollback();
            return res.status(403).json({ timeStamp: new Date().toISOString(), message: "Operazione non consentita." });
        }

        // Recupero titolo per la notifica
        const [initiatives] = await connection.query('SELECT ID_INIZIATIVA, TITOLO FROM INIZIATIVA WHERE ID_INIZIATIVA = ?', [initiativeId]);
        if (initiatives.length === 0) {
            await connection.rollback();
            return res.status(404).json({ timeStamp: new Date().toISOString(), message: "Iniziativa non trovata" });
        }
        const initiativeTitle = initiatives[0].TITOLO;

        // Controllo risposta esistente
        const [existingReply] = await connection.query('SELECT ID_RISPOSTA FROM RISPOSTA WHERE ID_INIZIATIVA = ?', [initiativeId]);
        if (existingReply.length > 0) {
            await connection.rollback();
            return res.status(409).json({ timeStamp: new Date().toISOString(), message: "Risposta già presente." });
        }

        // 5. INSERIMENTO RISPOSTA
        const queryInsertReply = `INSERT INTO RISPOSTA (ID_INIZIATIVA, ID_ADMIN, TEXT_RISP) VALUES (?, ?, ?)`;
        const [replyResult] = await connection.execute(queryInsertReply, [initiativeId, adminId, motivations]);
        const newReplyId = replyResult.insertId;

        // 6. AGGIORNAMENTO STATO
        await connection.execute('UPDATE INIZIATIVA SET STATO = ? WHERE ID_INIZIATIVA = ?', [status, initiativeId]);

        // 7. INSERIMENTO ALLEGATI
        let savedAttachments = [];
        if (attachments && attachments.length > 0) {
            const queryAllegato = `INSERT INTO ALLEGATO (FILE_NAME, FILE_PATH, FILE_TYPE, ID_RISPOSTA) VALUES (?, ?, ?, ?)`;
            const insertPromises = attachments.map(file => connection.execute(queryAllegato, [file.fileName, file.filePath, file.fileType || null, newReplyId]));
            await Promise.all(insertPromises);
            savedAttachments = attachments; // Semplificato per la risposta
        }

        // ---------------------------------------------------------
        // 8. GESTIONE NOTIFICHE (Autori + Firmatari + Followers)
        // ---------------------------------------------------------
        
        // Query con UNION per ottenere ID unici da tre tabelle diverse
        const queryRecipients = `
            -- 1. L'autore dell'iniziativa
            SELECT ID_AUTORE AS ID_UTENTE 
            FROM INIZIATIVA 
            WHERE ID_INIZIATIVA = ? AND ID_AUTORE IS NOT NULL
            
            UNION
            
            -- 2. Chi ha firmato l'iniziativa
            SELECT ID_UTENTE 
            FROM FIRMA_INIZIATIVA 
            WHERE ID_INIZIATIVA = ?
            
            UNION
            
            -- 3. Chi segue l'iniziativa (salvata)
            SELECT ID_UTENTE 
            FROM INIZIATIVA_SALVATA 
            WHERE ID_INIZIATIVA = ?
        `;

        // Passiamo l'ID tre volte (una per ogni SELECT della UNION)
        const [recipients] = await connection.query(queryRecipients, [initiativeId, initiativeId, initiativeId]);

        if (recipients.length > 0) {
            const notificationText = `L'iniziativa "${initiativeTitle}" ha ricevuto una risposta ufficiale ed è passata allo stato: ${status}`;
            const linkRef = `/initiatives/${initiativeId}`;

            const queryInsertNotifica = `INSERT INTO NOTIFICA (ID_UTENTE, TESTO, LINK_RIF) VALUES (?, ?, ?)`;

            // Inserimento parallelo delle notifiche
            const notificationPromises = recipients.map(user => {
                return connection.execute(queryInsertNotifica, [user.ID_UTENTE, notificationText, linkRef]);
            });

            await Promise.all(notificationPromises);
        }
        // ---------------------------------------------------------

        // 9. COMMIT
        await connection.commit();

        res.status(201).json({
            id: newReplyId,
            initiativeId: parseInt(initiativeId),
            replyText: motivations,
            status: status, // Ritorniamo anche il nuovo stato applicato
            attachments: savedAttachments
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Errore createReply:", err);
        res.status(500).json({ timeStamp: new Date().toISOString(), message: "Errore interno server" });
    } finally {
        if (connection) connection.release();
    }
};

exports.signInitiative = async (req, res) => {
    let connection;

    try {
        const initiativeId = req.params.id;
        const userId = req.header('X-Mock-User-Id');

        // 1. Validazione Header Utente
        if (!userId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione richiesta: Header X-Mock-User-Id mancante"
            });
        }

        // Acquisizione connessione per Transazione (Fondamentale per consistenza dati)
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 2. Controllo Preliminare: Ruolo Utente e Stato Iniziativa:
        // - Solo i "Cittadini" possono firmare 
        // - L'iniziativa deve essere attiva 
        
        const checkUserQuery = 'SELECT IS_CITTADINO FROM UTENTE WHERE ID_UTENTE = ?';
        const checkInitQuery = 'SELECT STATO FROM INIZIATIVA WHERE ID_INIZIATIVA = ?';

        const [userRows] = await connection.execute(checkUserQuery, [userId]);
        const [initRows] = await connection.execute(checkInitQuery, [initiativeId]);

        // A. Controllo Esistenza Utente e Ruolo
        if (userRows.length === 0) {
            await connection.rollback();
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Utente non trovato." 
            });
        }
        if (!userRows[0].IS_CITTADINO) {
            await connection.rollback();
            return res.status(403).json({ 
                timeStamp: new Date().toISOString(),
                message: "Operazione non consentita: solo i cittadini residenti possono firmare le iniziative." 
            });
        }

        // B. Controllo Esistenza e Stato Iniziativa
        if (initRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                timeStamp: new Date().toISOString(),
                message: "Iniziativa non trovata." 
            });
        }
        if (initRows[0].STATO !== 'In corso') {
            await connection.rollback();
            return res.status(403).json({ 
                timeStamp: new Date().toISOString(),
                message: `Impossibile firmare: l'iniziativa è nello stato '${initRows[0].STATO}' (richiesto: 'In corso').` 
            });
        }

        // 3. Inserimento Firma
        // Use Case RF11: Il sistema registra la firma [cite: 345]
        const insertQuery = `
            INSERT INTO FIRMA_INIZIATIVA (ID_UTENTE, ID_INIZIATIVA)
            VALUES (?, ?)
        `;
        await connection.execute(insertQuery, [userId, initiativeId]);

        // 4. Aggiornamento Contatore Firme
        // RF11: Aggiornare in tempo reale il numero totale di adesioni [cite: 104]
        const updateCountQuery = `
            UPDATE INIZIATIVA 
            SET NUM_FIRME = NUM_FIRME + 1 
            WHERE ID_INIZIATIVA = ?
        `;
        await connection.execute(updateCountQuery, [initiativeId]);

        // 5. Commit della Transazione
        await connection.commit();

        // Risposta 201 Created come da specifiche API
        res.status(201).json({
            userId: parseInt(userId),
            initiativeId: parseInt(initiativeId),
            signatureDate: new Date().toISOString()
        });

    } catch (err) {
        if (connection) await connection.rollback();

        // Gestione Errore Duplicato (L'utente ha già firmato)
        // Use Case RF11 Eccezione 1 
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                timeStamp: new Date().toISOString(),
                message: "Hai già sostenuto questa iniziativa."
            });
        }

        console.error("Errore signInitiative:", err);
        res.status(500).json({ 
            timeStamp: new Date().toISOString(),
            message: "Errore interno del server durante la firma dell'iniziativa.",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });

    } finally {
        if (connection) connection.release();
    }
};

exports.followInitiative = async (req, res) => {
    //questa implementaizone invece di fare prima una query di controllo e poi una di inserimento, 
    // tenta direttamente l'inserimento e gestisce gli errori del database 
    // (chiavi duplicate o chiavi esterne mancanti) per determinare il risultato. In questo modo si ottengono 
    // migliori performance.
    try {
        const initiativeId = req.params.id;
        
        // 1. Validazione Header Utente
        const userId = req.header('X-Mock-User-Id');
        if (!userId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione richiesta: Header X-Mock-User-Id mancante"
            });
        }

        // 2. Query di Inserimento diretto
        const query = `
            INSERT INTO INIZIATIVA_SALVATA (ID_UTENTE, ID_INIZIATIVA)
            VALUES (?, ?)
        `;

        await db.execute(query, [userId, initiativeId]);

        // 3. Risposta di Successo
        res.status(200).json({
            userId: parseInt(userId),
            initiativeId: parseInt(initiativeId),
            savedAt: new Date().toISOString()
        });

    } catch (err) {
        // 4. Gestione Errori Specifici

        // Codice 1062: Duplicate entry
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                timeStamp: new Date().toISOString(),
                message: "L'iniziativa è già tra i seguiti dell'utente."
            });
        }

        // Codice 1452: Foreign Key mancante
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(404).json({
                timeStamp: new Date().toISOString(),
                message: "Iniziativa o Utente non trovato.",
                details: [{
                    field: "id",
                    issue: "Impossibile salvare: iniziativa o utente inesistente."
                }]
            });
        }

        console.error("Errore followInitiative:", err);
        res.status(500).json({ 
            timeStamp: new Date().toISOString(),
            message: "Errore interno del server",
            details: process.env.NODE_ENV === 'development' ? [{ field: "server", issue: err.message }] : undefined
        });
    }
};

exports.unfollowInitiative = async (req, res) => {
    try {
        const initiativeId = req.params.id;

        // 1. Validazione Header Utente
        const userId = req.header('X-Mock-User-Id');
        if (!userId) {
            return res.status(401).json({ 
                timeStamp: new Date().toISOString(),
                message: "Autenticazione richiesta: Header X-Mock-User-Id mancante"
            });
        }

        // 2. Query di Eliminazione
        const query = `
            DELETE FROM INIZIATIVA_SALVATA 
            WHERE ID_UTENTE = ? AND ID_INIZIATIVA = ?
        `;

        const [result] = await db.execute(query, [userId, initiativeId]);

        // 3. Verifica del Risultato
        if (result.affectedRows === 0) {
            return res.status(404).json({
                timeStamp: new Date().toISOString(),
                message: "Impossibile rimuovere: l'iniziativa non era tra i seguiti o non esiste."
            });
        }

        // 4. Risposta di Successo
        res.status(200).json({
            message: "Iniziativa rimossa dai seguiti con successo",
            initiativeId: parseInt(initiativeId)
        });

    } catch (err) {
        console.error("Errore unfollowInitiative:", err);
        res.status(500).json({ 
            timeStamp: new Date().toISOString(),
            message: "Errore interno del server durante la rimozione dai seguiti",
            details: process.env.NODE_ENV === 'development' ? [{ field: "server", issue: err.message }] : undefined
        });
    }
};

// --- Funzioni Helper Private (Non esportate) ---

/**
 * Recupera tutti i dati di un'iniziativa formattati secondo lo schema DetailedInitiative.
 * Include allegati, risposte amministrative e allegati delle risposte.
 */
async function _getDetailedInitiativeData(id) {
    // 1. Recupero dati base
    const queryIniziativa = 'SELECT * FROM INIZIATIVA WHERE ID_INIZIATIVA = ?';
    const [rows] = await db.query(queryIniziativa, [id]);

    if (rows.length === 0) return null;
    const initiative = rows[0];

    // 2. Recupero Allegati Iniziativa e Risposta
    const queryAllegatiInit = `
        SELECT ID_ALLEGATO, FILE_NAME, FILE_PATH, FILE_TYPE, UPLOADED_AT 
        FROM ALLEGATO WHERE ID_INIZIATIVA = ?
    `;
    const queryRisposta = 'SELECT * FROM RISPOSTA WHERE ID_INIZIATIVA = ?';

    // Esecuzione parallela
    const [attachmentsInit] = await db.query(queryAllegatiInit, [id]);
    const [replies] = await db.query(queryRisposta, [id]);

    // 3. Costruzione Reply (se esiste)
    let formattedReply = null;
    if (replies.length > 0) {
        const replyData = replies[0];
        const queryAllegatiRisp = `
            SELECT ID_ALLEGATO, FILE_NAME, FILE_PATH, FILE_TYPE, UPLOADED_AT 
            FROM ALLEGATO WHERE ID_RISPOSTA = ?
        `;
        const [attachmentsRisp] = await db.query(queryAllegatiRisp, [replyData.ID_RISPOSTA]);

        formattedReply = {
            id: replyData.ID_RISPOSTA,
            initiativeId: replyData.ID_INIZIATIVA,
            adminId: replyData.ID_ADMIN,
            replyText: replyData.TEXT_RISP,
            creationDate: replyData.DATA_CREAZIONE,
            attachments: attachmentsRisp.map(att => ({
                id: att.ID_ALLEGATO,
                fileName: att.FILE_NAME,
                filePath: att.FILE_PATH,
                fileType: att.FILE_TYPE,
                uploadedAt: att.UPLOADED_AT
            }))
        };
    }

    // 4. Mappatura Finale
    return {
        id: initiative.ID_INIZIATIVA,
        title: initiative.TITOLO,
        description: initiative.DESCRIZIONE,
        place: initiative.LUOGO,
        status: initiative.STATO,
        signatures: initiative.NUM_FIRME || 0,
        creationDate: initiative.DATA_CREAZIONE,
        expirationDate: initiative.DATA_SCADENZA,
        authorId: initiative.ID_AUTORE,
        categoryId: initiative.ID_CATEGORIA,
        platformId: initiative.ID_PIATTAFORMA,
        externalURL: initiative.URL_ESTERNO,
        attachments: attachmentsInit.length > 0 ? attachmentsInit.map(att => ({
            id: att.ID_ALLEGATO,
            fileName: att.FILE_NAME,
            filePath: att.FILE_PATH,
            fileType: att.FILE_TYPE,
            uploadedAt: att.UPLOADED_AT
        })) : null,
        reply: formattedReply
    };
}
