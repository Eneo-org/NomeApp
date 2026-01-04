const db = require("../config/db");
const fs = require("fs"); // Necessario per cancellare i file in caso di errore
const { initiativeSchema } = require("../validators/initiativeSchema");
const { changeExpirationSchema } = require("../validators/initiativeSchema");
const { administrationReplySchema } = require("../validators/initiativeSchema");
const { INITIATIVE_SORT_MAP } = require("../config/constants");

/**
 * Funzione Helper per cancellare i file caricati se la procedura fallisce
 */
const cleanupFiles = (files) => {
  if (!files || files.length === 0) return;
  files.forEach((file) => {
    fs.unlink(file.path, (err) => {
      if (err) console.error(`[Cleanup] Errore cancellazione file ${file.path}:`, err);
    });
  });
};

exports.getAllInitiatives = async (req, res) => {
  try {
    // 1. Estrazione e Parsing dei Parametri
    const {
      currentPage = 1,
      objectsPerPage = 10,
      // Parametri per ordinamento
      sortBy = "date",
      order = "desc",
      // Parametri filtri dal Frontend
      search,
      place, // NUOVO
      category, // Rinominato da categoryID per coerenza col frontend
      platform, // NUOVO
      status,
      not_status, //NUOVO
      minSignatures,
      maxSignatures,
    } = req.query;

    const page = Math.max(1, parseInt(currentPage));
    const limit = Math.max(1, parseInt(objectsPerPage));
    const offset = (page - 1) * limit;

    // 2. Costruzione Dinamica della Clausola WHERE
    let whereConditions = ["1=1"];
    let queryParams = [];

    // --- FILTRI SPECIFICI (Nuovi) ---

    // Filtro: Luogo (colonna 'LUOGO')
    if (place) {
      whereConditions.push("i.LUOGO LIKE ?");
      queryParams.push(`%${place}%`);
    }

    // Filtro: Piattaforma (colonna 'ID_PIATTAFORMA')
    if (platform) {
      whereConditions.push("i.ID_PIATTAFORMA = ?");
      queryParams.push(parseInt(platform));
    }

    // Filtro: Categoria (colonna 'ID_CATEGORIA')
    if (category) {
      whereConditions.push("i.ID_CATEGORIA = ?");
      queryParams.push(parseInt(category));
    }

    // --- FILTRI GENERALI ---

    // Filtro: Status (colonna 'STATO')
    if (status) {
      whereConditions.push("i.STATO = ?");
      queryParams.push(status);
    }

    if (not_status) {
      whereConditions.push("i.STATO != ?");
      queryParams.push(not_status);
    }

    // Filtro: Range Firme (colonna 'NUM_FIRME')
    if (minSignatures !== undefined) {
      whereConditions.push("i.NUM_FIRME >= ?");
      queryParams.push(parseInt(minSignatures));
    }
    if (maxSignatures !== undefined) {
      whereConditions.push("i.NUM_FIRME <= ?");
      queryParams.push(parseInt(maxSignatures));
    }

    // Filtro: Ricerca Libera (Titolo, Descrizione)
    // Nota: Abbiamo tolto LUOGO da qui perché ora ha un filtro dedicato,
    // ma se vuoi cercare il luogo anche dalla barra principale, puoi rimetterlo.
    if (search) {
      whereConditions.push("(i.TITOLO LIKE ? OR i.DESCRIZIONE LIKE ?)");
      const likeTerm = `%${search}%`;
      queryParams.push(likeTerm, likeTerm);
    }

    // Uniamo le condizioni
    const whereClause = "WHERE " + whereConditions.join(" AND ");

    // 3. Gestione Ordinamento
    // Mappiamo 'signatures' -> 'i.NUM_FIRME' etc. tramite il file constants.js
    const sortColumn = INITIATIVE_SORT_MAP[sortBy] || "i.DATA_CREAZIONE";
    const sortDirection =
      order && order.toLowerCase() === "asc" ? "ASC" : "DESC";

    // 4. Query per il conteggio totale (per MetaData)
    const countQuery = `SELECT COUNT(*) as total FROM INIZIATIVA i ${whereClause}`;
    const [countRows] = await db.query(countQuery, queryParams);
    const totalObjects = countRows[0].total;

    // 5. Query per i dati
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

    // Aggiungiamo limit e offset in coda ai parametri dei filtri
    const dataParams = [...queryParams, limit, offset];
    const [rows] = await db.query(dataQuery, dataParams);

    // 6. Formattazione (Mapping DB -> JSON API)
    const formattedData = rows.map((row) => ({
      id: row.ID_INIZIATIVA,
      title: row.TITOLO,
      description: row.DESCRIZIONE,
      place: row.LUOGO,
      status: row.STATO,
      signatures: row.NUM_FIRME || 0,
      creationDate: row.DATA_CREAZIONE,
      expirationDate: row.DATA_SCADENZA,
      authorId: row.ID_AUTORE,
      categoryId: row.ID_CATEGORIA,
      platformId: row.ID_PIATTAFORMA,
      externalURL: row.URL_ESTERNO,
      // Qui gestiamo l'allegato: se c'è restituiamo l'oggetto, altrimenti null
      attachment: row.first_attachment
        ? { filePath: row.first_attachment }
        : null,
    }));

    // 7. Invio Risposta
    res.status(200).json({
      data: formattedData,
      meta: {
        currentPage: page,
        objectsPerPage: limit,
        totalObjects: totalObjects,
        totalPages: Math.ceil(totalObjects / limit),
      },
    });
  } catch (err) {
    console.error("Errore getAllInitiatives:", err);
    res.status(500).json({
      message: "Errore interno del server",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// --- MODIFICA: Gestione Multipart/Form-Data ---
exports.createInitiative = async (req, res) => {
  let connection;
  const files = req.files; 

  try {
    const mockUserId = req.header("X-Mock-User-Id");
    if (!mockUserId) {
      cleanupFiles(files); 
      return res.status(400).json({ message: "Header X-Mock-User-Id mancante" });
    }

    // 1. Validazione
    // Assicurati che il tuo initiativeSchema (Joi) validi 'title', 'description', 'place', 'categoryId'
    const { error, value } = initiativeSchema.validate(req.body, { abortEarly: false });
    if (error) {
      cleanupFiles(files);
      return res.status(400).json({
        message: "Errore di validazione",
        details: error.details.map((err) => ({
          field: err.context.key,
          issue: err.message,
        })),
      });
    }

    const { title, description, place, categoryId } = value;

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Calcolo date in JS per allineamento perfetto tra DB e JSON
    const now = new Date();
    const expiration = new Date(now);
    expiration.setDate(expiration.getDate() + 30); // Scadenza default +30gg

    // 2. Inserimento Iniziativa
    const queryIniziativa = `
            INSERT INTO INIZIATIVA (TITOLO, DESCRIZIONE, LUOGO, ID_CATEGORIA, ID_AUTORE, STATO, ID_PIATTAFORMA, DATA_CREAZIONE, DATA_SCADENZA, NUM_FIRME)
            VALUES (?, ?, ?, ?, ?, 'In corso', NULL, ?, ?, 0)
        `;

    const [resultInit] = await connection.execute(queryIniziativa, [
      title,
      description,
      place,
      categoryId,
      mockUserId,
      now,
      expiration
    ]);

    const newInitiativeId = resultInit.insertId;

    // 3. Inserimento Allegati e costruzione array response
    let responseAttachments = null; // Default null come da schema se vuoto

    if (files && files.length > 0) {
      responseAttachments = [];
      const queryAllegato = `
                INSERT INTO ALLEGATO (FILE_NAME, FILE_PATH, FILE_TYPE, ID_INIZIATIVA)
                VALUES (?, ?, ?, ?)
            `;

      // Usiamo un ciclo for per eseguire le query e recuperare gli ID inseriti
      // (Promise.all è più veloce, ma così siamo sicuri di avere gli ID corretti per la response)
      for (const file of files) {
        const [resAtt] = await connection.execute(queryAllegato, [
          file.originalname, 
          file.path,         
          file.mimetype,     
          newInitiativeId,
        ]);

        // Aggiungiamo l'oggetto all'array per la risposta JSON
        responseAttachments.push({
            id: resAtt.insertId,
            fileName: file.originalname,
            filePath: file.path,
            fileType: file.mimetype,
            uploadedAt: new Date().toISOString()
        });
      }
    }

    await connection.commit();

    // 4. Risposta conforme al nuovo schema JSON
    res.status(201).json({
      id: newInitiativeId,
      title: title,
      description: description, // Ora presente e obbligatorio
      place: place || null,     // Assicura null se undefined
      status: "In corso",
      signatures: 0,            // Default 0
      creationDate: now.toISOString(), // Formato ISO string
      expirationDate: expiration.toISOString(),
      authorId: parseInt(mockUserId),
      categoryId: parseInt(categoryId),
      platformId: null,         // Default NULL
      externalURL: null,        // Default NULL
      attachments: responseAttachments, // Array di oggetti o null
      reply: null               // Default NULL alla creazione
    });

  } catch (err) {
    if (connection) await connection.rollback();
    cleanupFiles(files); 

    console.error("Errore CreateInitiative:", err);
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "ID Categoria o ID Utente inesistente." });
    }
    res.status(500).json({ message: "Errore interno del server." });
  } finally {
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
        details: [
          { field: "id", issue: "L'ID deve essere un numero intero positivo" },
        ],
      });
    }

    // Richiamiamo la funzione helper che contiene tutta la logica complessa
    const data = await _getDetailedInitiativeData(id);

    // Se la funzione helper ritorna null, significa che non esiste
    if (!data) {
      return res.status(404).json({
        timeStamp: new Date().toISOString(),
        message: "Iniziativa non trovata",
      });
    }

    // Se esiste, restituiamo i dati
    res.status(200).json(data);
  } catch (err) {
    console.error("Errore getInitiativeById:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno del server durante il recupero dei dettagli.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

exports.changeExpirationDate = async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const userId = req.header("X-Mock-User-Id");

    // 1. Validazione Header
    if (!userId) {
      return res.status(401).json({
        timeStamp: new Date().toISOString(),
        message: "Autenticazione richiesta: Header X-Mock-User-Id mancante",
      });
    }

    // 2. Validazione Body (Joi)
    const { error, value } = changeExpirationSchema.validate(req.body);
    if (error) {
      return res.status(422).json({
        timeStamp: new Date().toISOString(),
        message: "Errore di validazione",
        details: error.details.map((d) => ({
          field: d.context.key,
          issue: d.message,
        })),
      });
    }
    const { expirationDate } = value;

    // 3. Controllo Permessi (Solo Admin)
    const [users] = await db.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Utente non trovato" });
    }
    if (!users[0].IS_ADMIN) {
      return res.status(403).json({
        timeStamp: new Date().toISOString(),
        message:
          "Operazione non consentita: solo gli amministratori possono estendere le scadenze.",
      });
    }

    // 4. Verifica Esistenza Iniziativa
    const [initiatives] = await db.query(
      "SELECT ID_INIZIATIVA FROM INIZIATIVA WHERE ID_INIZIATIVA = ?",
      [initiativeId]
    );
    if (initiatives.length === 0) {
      return res.status(404).json({
        timeStamp: new Date().toISOString(),
        message: "Iniziativa non trovata",
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
      message:
        "Errore interno del server durante l'aggiornamento della scadenza",
    });
  }
};

exports.updateInitiative = async (req, res) => {
  res.json({ message: "TODO" });
};

// Assicurati di importare lo schema di validazione all'inizio del file se non c'è già
// const { administrationReplySchema } = require('../validators/initiativeSchema');

// --- MODIFICA: CreateReply con Multer per la gestione dei file---
exports.createReply = async (req, res) => {
  let connection;
  const files = req.files; // File caricati (Immagini o PDF)

  try {
    const initiativeId = req.params.id;
    const adminId = req.header("X-Mock-User-Id");

    if (!adminId) {
      cleanupFiles(files);
      return res.status(401).json({ message: "Autenticazione richiesta" });
    }

    const { error, value } = administrationReplySchema.validate(req.body, { abortEarly: false });
    if (error) {
      cleanupFiles(files);
      return res.status(400).json({
        message: "Errore di validazione",
        details: error.details.map((err) => ({ field: err.context.key, issue: err.message })),
      });
    }
    const { status, motivations } = value;

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check permessi Admin
    const [users] = await connection.query("SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?", [adminId]);
    if (users.length === 0 || !users[0].IS_ADMIN) {
      await connection.rollback();
      cleanupFiles(files);
      return res.status(403).json({ message: "Operazione non consentita." });
    }

    // Check Iniziativa
    const [initiatives] = await connection.query(
      "SELECT ID_INIZIATIVA, TITOLO FROM INIZIATIVA WHERE ID_INIZIATIVA = ?", 
      [initiativeId]
    );
    if (initiatives.length === 0) {
      await connection.rollback();
      cleanupFiles(files);
      return res.status(404).json({ message: "Iniziativa non trovata" });
    }
    const initiativeTitle = initiatives[0].TITOLO;

    // Check Risposta Esistente
    const [existingReply] = await connection.query(
      "SELECT ID_RISPOSTA FROM RISPOSTA WHERE ID_INIZIATIVA = ?", 
      [initiativeId]
    );
    if (existingReply.length > 0) {
      await connection.rollback();
      cleanupFiles(files);
      return res.status(409).json({ message: "Risposta già presente." });
    }

    // Insert Risposta
    const queryInsertReply = `INSERT INTO RISPOSTA (ID_INIZIATIVA, ID_ADMIN, TEXT_RISP) VALUES (?, ?, ?)`;
    const [replyResult] = await connection.execute(queryInsertReply, [initiativeId, adminId, motivations]);
    const newReplyId = replyResult.insertId;

    // Update Stato Iniziativa
    await connection.execute("UPDATE INIZIATIVA SET STATO = ? WHERE ID_INIZIATIVA = ?", [status, initiativeId]);

    // Insert Allegati (se presenti)
    let savedAttachments = [];
    if (files && files.length > 0) {
      const queryAllegato = `INSERT INTO ALLEGATO (FILE_NAME, FILE_PATH, FILE_TYPE, ID_RISPOSTA) VALUES (?, ?, ?, ?)`;
      const insertPromises = files.map((file) =>
        connection.execute(queryAllegato, [
          file.originalname,
          file.path,
          file.mimetype,
          newReplyId,
        ])
      );
      await Promise.all(insertPromises);
      savedAttachments = files.map(f => ({ fileName: f.originalname, filePath: f.path }));
    }

    // Invio Notifiche (Logica Preservata)
    const queryRecipients = `
            SELECT ID_AUTORE AS ID_UTENTE FROM INIZIATIVA WHERE ID_INIZIATIVA = ? AND ID_AUTORE IS NOT NULL
            UNION
            SELECT ID_UTENTE FROM FIRMA_INIZIATIVA WHERE ID_INIZIATIVA = ?
            UNION
            SELECT ID_UTENTE FROM INIZIATIVA_SALVATA WHERE ID_INIZIATIVA = ?
        `;
    const [recipients] = await connection.query(queryRecipients, [initiativeId, initiativeId, initiativeId]);

    if (recipients.length > 0) {
      const notificationText = `L'iniziativa "${initiativeTitle}" ha ricevuto una risposta ufficiale ed è passata allo stato: ${status}`;
      const linkRef = `/initiatives/${initiativeId}`;
      const queryInsertNotifica = `INSERT INTO NOTIFICA (ID_UTENTE, TESTO, LINK_RIF) VALUES (?, ?, ?)`;
      
      const notificationPromises = recipients.map((user) => 
        connection.execute(queryInsertNotifica, [user.ID_UTENTE, notificationText, linkRef])
      );
      await Promise.all(notificationPromises);
    }

    await connection.commit();

    res.status(201).json({
      id: newReplyId,
      initiativeId: parseInt(initiativeId),
      replyText: motivations,
      status: status,
      attachments: savedAttachments,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    cleanupFiles(files);
    console.error("Errore createReply:", err);
    res.status(500).json({ message: "Errore interno server" });
  } finally {
    if (connection) connection.release();
  }
};

exports.signInitiative = async (req, res) => {
  let connection;

  try {
    const initiativeId = req.params.id;
    const userId = req.header("X-Mock-User-Id");

    // 1. Validazione Header Utente
    if (!userId) {
      return res.status(401).json({
        timeStamp: new Date().toISOString(),
        message: "Autenticazione richiesta: Header X-Mock-User-Id mancante",
      });
    }

    // Acquisizione connessione per Transazione (Fondamentale per consistenza dati)
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 2. Controllo Preliminare: Ruolo Utente e Stato Iniziativa:
    // - Solo i "Cittadini" possono firmare
    // - L'iniziativa deve essere attiva

    const checkUserQuery =
      "SELECT IS_CITTADINO FROM UTENTE WHERE ID_UTENTE = ?";
    const checkInitQuery =
      "SELECT STATO FROM INIZIATIVA WHERE ID_INIZIATIVA = ?";

    const [userRows] = await connection.execute(checkUserQuery, [userId]);
    const [initRows] = await connection.execute(checkInitQuery, [initiativeId]);

    // A. Controllo Esistenza Utente e Ruolo
    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(401).json({
        timeStamp: new Date().toISOString(),
        message: "Utente non trovato.",
      });
    }
    if (!userRows[0].IS_CITTADINO) {
      await connection.rollback();
      return res.status(403).json({
        timeStamp: new Date().toISOString(),
        message:
          "Operazione non consentita: solo i cittadini residenti possono firmare le iniziative.",
      });
    }

    // B. Controllo Esistenza e Stato Iniziativa
    if (initRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        timeStamp: new Date().toISOString(),
        message: "Iniziativa non trovata.",
      });
    }
    if (initRows[0].STATO !== "In corso") {
      await connection.rollback();
      return res.status(403).json({
        timeStamp: new Date().toISOString(),
        message: `Impossibile firmare: l'iniziativa è nello stato '${initRows[0].STATO}' (richiesto: 'In corso').`,
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
      signatureDate: new Date().toISOString(),
    });
  } catch (err) {
    if (connection) await connection.rollback();

    // Gestione Errore Duplicato (L'utente ha già firmato)
    // Use Case RF11 Eccezione 1
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        timeStamp: new Date().toISOString(),
        message: "Hai già sostenuto questa iniziativa.",
      });
    }

    console.error("Errore signInitiative:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno del server durante la firma dell'iniziativa.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.followInitiative = async (req, res) => {
  try {
    const initiativeId = req.params.id;

    // 1. Validazione Header Utente
    const userId = req.header("X-Mock-User-Id");
    if (!userId) {
      return res.status(401).json({
        timeStamp: new Date().toISOString(),
        message: "Autenticazione richiesta: Header X-Mock-User-Id mancante",
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
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    // 4. Gestione Errori Specifici

    // Codice 1062: Duplicate entry
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        timeStamp: new Date().toISOString(),
        message: "L'iniziativa è già tra i seguiti dell'utente.",
      });
    }

    // Codice 1452: Foreign Key mancante
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json({
        timeStamp: new Date().toISOString(),
        message: "Iniziativa o Utente non trovato.",
        details: [
          {
            field: "id",
            issue: "Impossibile salvare: iniziativa o utente inesistente.",
          },
        ],
      });
    }

    console.error("Errore followInitiative:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno del server",
      details:
        process.env.NODE_ENV === "development"
          ? [{ field: "server", issue: err.message }]
          : undefined,
    });
  }
};

exports.unfollowInitiative = async (req, res) => {
  try {
    const initiativeId = req.params.id;

    // 1. Validazione Header Utente
    const userId = req.header("X-Mock-User-Id");
    if (!userId) {
      return res.status(401).json({
        timeStamp: new Date().toISOString(),
        message: "Autenticazione richiesta: Header X-Mock-User-Id mancante",
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
        message:
          "Impossibile rimuovere: l'iniziativa non era tra i seguiti o non esiste.",
      });
    }

    // 4. Risposta di Successo
    res.status(200).json({
      message: "Iniziativa rimossa dai seguiti con successo",
      initiativeId: parseInt(initiativeId),
    });
  } catch (err) {
    console.error("Errore unfollowInitiative:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno del server durante la rimozione dai seguiti",
      details:
        process.env.NODE_ENV === "development"
          ? [{ field: "server", issue: err.message }]
          : undefined,
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
  const queryIniziativa = "SELECT * FROM INIZIATIVA WHERE ID_INIZIATIVA = ?";
  const [rows] = await db.query(queryIniziativa, [id]);

  if (rows.length === 0) return null;
  const initiative = rows[0];

  // 2. Recupero Allegati Iniziativa e Risposta
  const queryAllegatiInit = `
        SELECT ID_ALLEGATO, FILE_NAME, FILE_PATH, FILE_TYPE, UPLOADED_AT 
        FROM ALLEGATO WHERE ID_INIZIATIVA = ?
    `;
  const queryRisposta = "SELECT * FROM RISPOSTA WHERE ID_INIZIATIVA = ?";

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
    const [attachmentsRisp] = await db.query(queryAllegatiRisp, [
      replyData.ID_RISPOSTA,
    ]);

    formattedReply = {
      id: replyData.ID_RISPOSTA,
      initiativeId: replyData.ID_INIZIATIVA,
      adminId: replyData.ID_ADMIN,
      replyText: replyData.TEXT_RISP,
      creationDate: replyData.DATA_CREAZIONE,
      attachments: attachmentsRisp.map((att) => ({
        id: att.ID_ALLEGATO,
        fileName: att.FILE_NAME,
        filePath: att.FILE_PATH,
        fileType: att.FILE_TYPE,
        uploadedAt: att.UPLOADED_AT,
      })),
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
    attachments:
      attachmentsInit.length > 0
        ? attachmentsInit.map((att) => ({
            id: att.ID_ALLEGATO,
            fileName: att.FILE_NAME,
            filePath: att.FILE_PATH,
            fileType: att.FILE_TYPE,
            uploadedAt: att.UPLOADED_AT,
          }))
        : null,
    reply: formattedReply,
  };
}
// Funzione Helper Privata per inviare notifiche ai follower
const notifyFollowers = async (initiativeId, message, link) => {
  try {
    // 1. Trova tutti gli utenti che seguono questa iniziativa
    const queryFollowers = `SELECT ID_UTENTE FROM INIZIATIVA_SALVATA WHERE ID_INIZIATIVA = ?`;
    const [followers] = await db.query(queryFollowers, [initiativeId]);

    if (followers.length === 0) return; // Nessuno la segue

    // 2. Prepara i dati per l'inserimento multiplo (Bulk Insert)
    const queryInsert = `INSERT INTO NOTIFICA (ID_UTENTE, TESTO, LINK_RIF, LETTA) VALUES ?`;

    // Mappiamo l'array per il formato richiesto da mysql2 per le bulk insert: [[val1, val2], [val1, val2]]
    const values = followers.map((f) => [
      f.ID_UTENTE,
      message,
      link,
      0, // 0 = Non letta
    ]);

    // 3. Esegui l'inserimento
    await db.query(queryInsert, [values]);
    console.log(
      `[NOTIFICHE] Inviate ${followers.length} notifiche per l'iniziativa ${initiativeId}`
    );
  } catch (err) {
    console.error("Errore invio notifiche:", err);
    // Non lanciamo errore per non bloccare la risposta HTTP principale
  }
};

/**
 * CAMBIO STATO INIZIATIVA (Solo Admin)
 * Aggiorna lo stato e notifica i follower.
 */
exports.updateInitiativeStatus = async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const userId = req.header("X-Mock-User-Id");
    const { status } = req.body; // Es: 'Approvata', 'Respinta', 'In corso'

    // 1. Validazione Input
    if (!userId) return res.status(401).json({ message: "Auth mancante" });
    if (!status) return res.status(400).json({ message: "Stato mancante" });

    // 2. Controllo Permessi Admin
    const [admins] = await db.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [userId]
    );
    if (admins.length === 0 || !admins[0].IS_ADMIN) {
      return res.status(403).json({
        message:
          "Accesso negato: Solo gli amministratori possono cambiare lo stato.",
      });
    }

    // 3. Recupero Titolo Iniziativa (per il messaggio di notifica)
    const [rows] = await db.query(
      "SELECT TITOLO FROM INIZIATIVA WHERE ID_INIZIATIVA = ?",
      [initiativeId]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "Iniziativa non trovata" });

    const initiativeTitle = rows[0].TITOLO;

    // 4. Aggiornamento Stato nel DB
    await db.query("UPDATE INIZIATIVA SET STATO = ? WHERE ID_INIZIATIVA = ?", [
      status,
      initiativeId,
    ]);

    // 5. INVIO NOTIFICHE AI FOLLOWER 🔔
    // Costruiamo un messaggio personalizzato
    let notifMsg = `Aggiornamento iniziativa: "${initiativeTitle}" è ora: ${status.toUpperCase()}.`;

    if (status === "Approvata")
      notifMsg = `🎉 Buone notizie! L'iniziativa "${initiativeTitle}" è stata APPROVATA!`;
    if (status === "Respinta")
      notifMsg = `L'iniziativa "${initiativeTitle}" è stata chiusa o respinta.`;

    // Chiamiamo la funzione helper (senza await per non rallentare la risposta all'utente admin)
    notifyFollowers(initiativeId, notifMsg, `/initiative/${initiativeId}`);

    // 6. Risposta
    // Possiamo usare la tua funzione helper _getDetailedInitiativeData se vuoi restituire l'oggetto completo
    // Oppure una risposta semplice:
    res.status(200).json({
      message: "Stato aggiornato con successo",
      id: initiativeId,
      newStatus: status,
    });
  } catch (err) {
    console.error("Errore updateStatus:", err);
    res
      .status(500)
      .json({ message: "Errore server durante l'aggiornamento stato" });
  }
};
