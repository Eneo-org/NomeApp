const db = require('../config/db');
const initiativeSchema = require('../validators/initiativeSchema');
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
                message: "Header X-Mock-User-Id mancante",
                timestamp: new Date().toISOString()
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
                message: "Riferimento non valido: ID Categoria o ID Utente inesistente.",
                timestamp: new Date().toISOString()
            });
        }

        // Errore generico del server
        res.status(500).json({
            message: "Errore interno del server durante la creazione.",
            timestamp: new Date().toISOString()
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

        // 1. Recupero Dati Iniziativa
        const queryIniziativa = `
            SELECT * FROM INIZIATIVA 
            WHERE ID_INIZIATIVA = ?
        `;
        const [rows] = await db.query(queryIniziativa, [id]);

        // Se non esiste, ritorno 404
        if (rows.length === 0) {
            return res.status(404).json({ 
                message: "Iniziativa non trovata",
                timestamp: new Date().toISOString()
            });
        }

        const initiative = rows[0];

        // 2. Recupero Allegati Iniziativa e Risposta (Esecuzione Parallela per performance)
        const queryAllegatiInit = `
            SELECT ID_ALLEGATO, FILE_NAME, FILE_PATH, FILE_TYPE, UPLOADED_AT 
            FROM ALLEGATO 
            WHERE ID_INIZIATIVA = ?
        `;

        const queryRisposta = `
            SELECT * FROM RISPOSTA 
            WHERE ID_INIZIATIVA = ?
        `;

        const [attachmentsInit] = await db.query(queryAllegatiInit, [id]);
        const [replies] = await db.query(queryRisposta, [id]);

        // 3. Costruzione Oggetto "Reply" (se esiste)
        let formattedReply = null;
        
        if (replies.length > 0) {
            const replyData = replies[0];
            
            // Se c'è una risposta, recuperiamo i suoi allegati specifici
            const queryAllegatiRisp = `
                SELECT ID_ALLEGATO, FILE_NAME, FILE_PATH, FILE_TYPE, UPLOADED_AT 
                FROM ALLEGATO 
                WHERE ID_RISPOSTA = ?
            `;
            const [attachmentsRisp] = await db.query(queryAllegatiRisp, [replyData.ID_RISPOSTA]);

            formattedReply = {
                id: replyData.ID_RISPOSTA,
                initiativeId: replyData.ID_INIZIATIVA,
                adminId: replyData.ID_ADMIN,
                replyText: replyData.TEXT_RISP, // Mapping colonna DB -> JSON
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

        // 4. Mappatura Finale (Schema DetailedInitiative)
        const responseData = {
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
            // Array degli allegati dell'iniziativa
            attachments: attachmentsInit.length > 0 ? attachmentsInit.map(att => ({
                id: att.ID_ALLEGATO,
                fileName: att.FILE_NAME,
                filePath: att.FILE_PATH,
                fileType: att.FILE_TYPE,
                uploadedAt: att.UPLOADED_AT
            })) : null, // OpenAPI dice nullable
            // Oggetto risposta amministrativa
            reply: formattedReply 
        };

        // 5. Invio Risposta
        res.status(200).json(responseData);

    } catch (err) {
        console.error("Errore getInitiativeById:", err);
        res.status(500).json({
            message: "Errore interno del server durante il recupero dei dettagli.",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.changeExpirationDate = async (req, res) => {
    res.json({ message: "TODO" });
};

exports.updateInitiative = async (req, res) => {
    res.json({ message: "TODO" });
};

exports.createReply = async (req, res) => {
    res.json({ message: "TODO" });
};

exports.signInitiative = async (req, res) => {
    res.json({ message: "TODO" });
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
                message: "Autenticazione richiesta: Header X-Mock-User-Id mancante",
                timestamp: new Date().toISOString()
            });
        }

        // 2. Query di Inserimento diretto
        // Usiamo INSERT per aggiungere la relazione nella tabella ponte
        const query = `
            INSERT INTO INIZIATIVA_SALVATA (ID_UTENTE, ID_INIZIATIVA)
            VALUES (?, ?)
        `;

        await db.execute(query, [userId, initiativeId]);

        // 3. Risposta di Successo (200 OK)
        // Costruiamo l'oggetto SavedInitiative come da specifica OpenAPI
        res.status(200).json({
            userId: parseInt(userId),
            initiativeId: parseInt(initiativeId),
            savedAt: new Date().toISOString() // Approssimazione valida del timestamp DB
        });

    } catch (err) {
        // 4. Gestione Errori Specifici MySQL

        // Codice 1062: Duplicate entry (L'utente segue già l'iniziativa)
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: "L'iniziativa è già tra i seguiti dell'utente.",
                timestamp: new Date().toISOString()
            });
        }

        // Codice 1452: Foreign Key Constraint Fails (Utente o Iniziativa non esistono)
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(404).json({
                message: "Iniziativa o Utente non trovato.",
                details: "Impossibile salvare un'iniziativa inesistente o riferita a un utente inesistente.",
                timestamp: new Date().toISOString()
            });
        }

        // Errore generico
        console.error("Errore followInitiative:", err);
        res.status(500).json({ 
            message: "Errore interno del server",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.unfollowInitiative = async (req, res) => {
    res.json({ message: "TODO" });
};
