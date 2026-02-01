const db = require("../config/db");
const fs = require("fs"); // Necessario per cancellare i file in caso di errore
const path = require("path");
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
      if (err)
        console.error(`[Cleanup] Errore cancellazione file ${file.path}:`, err);
    });
  });
};

exports.getAllInitiatives = async (req, res) => {
  try {
    // 1. Estrazione e Parsing dei Parametri
    const {
      currentPage = 1,
      objectsPerPage = 10,
      sortBy = "1",
      order = "desc",
      search,
      place,
      category,
      platform,
      status, // <--- Qui sta il problema se è un array
      not_status,
      minSignatures,
      maxSignatures,
    } = req.query;

    const page = Math.max(1, parseInt(currentPage));
    const limit = Math.max(1, parseInt(objectsPerPage));
    const offset = (page - 1) * limit;

    // 2. Costruzione Dinamica della Clausola WHERE
    let whereConditions = ["1=1"];
    let queryParams = [];

    // --- FILTRI SPECIFICI ---

    // Filtro: Luogo
    if (place) {
      whereConditions.push("i.LUOGO LIKE ?");
      queryParams.push(`%${place}%`);
    }

    // Filtro: Piattaforma
    if (platform) {
      whereConditions.push("i.ID_PIATTAFORMA = ?");
      queryParams.push(parseInt(platform));
    }

    // Filtro: Categoria
    if (category) {
      whereConditions.push("i.ID_CATEGORIA = ?");
      queryParams.push(parseInt(category));
    }

    // --- FILTRI GENERALI (FIX QUI SOTTO) ---

    // Filtro: Status (Gestisce sia stringa singola che array)
    if (status) {
      if (Array.isArray(status) && status.length > 0) {
        const placeholders = status.map(() => '?').join(',');
        whereConditions.push(`i.STATO IN (${placeholders})`);
        queryParams.push(...status);
      } else if (typeof status === 'string' && status) {
        whereConditions.push('i.STATO = ?');
        queryParams.push(status);
      }
    } else {
      whereConditions.push("i.STATO = 'In corso'");
    }

    // Filtro: Not Status (Escludi stato)
    if (not_status) {
      whereConditions.push("i.STATO != ?");
      queryParams.push(not_status);
    }

    // Filtro: Range Firme
    if (minSignatures !== undefined) {
      whereConditions.push("i.NUM_FIRME >= ?");
      queryParams.push(parseInt(minSignatures));
    }
    if (maxSignatures !== undefined) {
      whereConditions.push("i.NUM_FIRME <= ?");
      queryParams.push(parseInt(maxSignatures));
    }

    // Filtro: Ricerca Libera
    if (search) {
      whereConditions.push("(i.TITOLO LIKE ? OR i.DESCRIZIONE LIKE ?)");
      const likeTerm = `%${search}%`;
      queryParams.push(likeTerm, likeTerm);
    }

    // Filtro: Periodo Date (Data Creazione)
    // Se dal frontend arriva dateFrom (es. 2025-09-01)
    if (req.query.dateFrom) {
      whereConditions.push("i.DATA_CREAZIONE >= ?");
      queryParams.push(req.query.dateFrom);
    }
    // Se dal frontend arriva dateTo (es. 2025-10-10)
    if (req.query.dateTo) {
      // Aggiungiamo fine giornata per includere tutto il giorno indicato
      whereConditions.push("i.DATA_CREAZIONE <= ?");
      queryParams.push(req.query.dateTo + " 23:59:59");
    }

    // Uniamo le condizioni
    const whereClause = "WHERE " + whereConditions.join(" AND ");

    // 3. Gestione Ordinamento
    const sortColumn = INITIATIVE_SORT_MAP[sortBy] || "i.DATA_CREAZIONE";
    const sortDirection =
      order && order.toLowerCase() === "asc" ? "ASC" : "DESC";

    // 4. Query per il conteggio totale
    const countQuery = `SELECT COUNT(*) as total FROM INIZIATIVA i ${whereClause}`;
    const [countRows] = await db.query(countQuery, queryParams);
    const totalObjects = countRows[0].total;

    // 5. Query per i dati
    const dataQuery = `
            SELECT 
                i.*,
                (SELECT FILE_PATH 
                 FROM ALLEGATO a 
                 WHERE a.ID_INIZIATIVA = i.ID_INIZIATIVA AND a.FILE_TYPE LIKE 'image/%'
                 ORDER BY a.ID_ALLEGATO ASC
                 LIMIT 1) as first_attachment
            FROM INIZIATIVA i
            ${whereClause}
            ORDER BY ${sortColumn} ${sortDirection}
            LIMIT ? OFFSET ?
        `;

    // Aggiungiamo limit e offset in coda ai parametri dei filtri
    const dataParams = [...queryParams, limit, offset];
    const [rows] = await db.query(dataQuery, dataParams);

    // 6. Formattazione
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

exports.createInitiative = async (req, res) => {
  let connection;
  const files = req.files;

  try {
    const userId = req.user.id;

    // --- 🛑 CHECK COOLDOWN 🛑 ---
    const [cooldownCheck] = await db.execute(
      "SELECT ID_INIZIATIVA FROM INIZIATIVA WHERE ID_AUTORE = ? AND DATA_CREAZIONE > NOW() - INTERVAL 14 DAY",
      [userId]
    );

    if (cooldownCheck.length > 0) {
      if (files) cleanupFiles(files);
      return res.status(422).json({
        message:
          "Hai già creato un'iniziativa di recente. Devi attendere 14 giorni tra una proposta e l'altra.",
      });
    }
    // --- ✅ FINE CHECK COOLDOWN ---

    // 1. Validazione
    const { error, value } = initiativeSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      if (files) cleanupFiles(files);
      return res.status(400).json({
        message: "Errore di validazione",
        details: error.details.map((err) => ({
          field: err.context.key,
          issue: err.message,
        })),
      });
    }

    // Estraiamo anche platformId (o usiamo 1 come default se manca)
    const { title, description, place, categoryId, platformId } = value;
    const finalPlatformId = platformId || 1; // Default Trento Partecipa

    connection = await db.getConnection();
    await connection.beginTransaction();

    const now = new Date();
    const expiration = new Date(now);
    expiration.setDate(expiration.getDate() + 30);

    // 2. Inserimento Iniziativa
    // FIX: Ho sostituito 'NULL' con '?' nella posizione di ID_PIATTAFORMA
    const queryIniziativa = `
            INSERT INTO INIZIATIVA (TITOLO, DESCRIZIONE, LUOGO, ID_CATEGORIA, ID_AUTORE, STATO, ID_PIATTAFORMA, DATA_CREAZIONE, DATA_SCADENZA, NUM_FIRME)
            VALUES (?, ?, ?, ?, ?, 'In corso', ?, ?, ?, 0)
        `;

    const [resultInit] = await connection.execute(queryIniziativa, [
      title,
      description,
      place || null,
      categoryId,
      userId,
      finalPlatformId, // <--- Ora passiamo l'ID corretto (1)
      now,
      expiration,
    ]);

    const newInitiativeId = resultInit.insertId;

    // 3. Inserimento Allegati
    let responseAttachments = null;

    if (files && files.length > 0) {
      responseAttachments = [];
      const queryAllegato = `
                INSERT INTO ALLEGATO (FILE_NAME, FILE_PATH, FILE_TYPE, ID_INIZIATIVA)
                VALUES (?, ?, ?, ?)
            `;

      for (const file of files) {
        // Costruiamo il path relativo da salvare nel DB (es. uploads/initiatives/nomefile.jpg)
        const relativePath = path.join("uploads", "initiatives", file.filename);

        const [resAtt] = await connection.execute(queryAllegato, [
          file.originalname,
          relativePath,
          file.mimetype,
          newInitiativeId,
        ]);

        responseAttachments.push({
          id: resAtt.insertId,
          fileName: file.originalname,
          filePath: relativePath,
          fileType: file.mimetype,
          uploadedAt: new Date().toISOString(),
        });
      }
    }

    await connection.commit();

    // 4. Risposta
    res.status(201).json({
      id: newInitiativeId,
      title: title,
      description: description,
      place: place || null,
      status: "In corso",
      signatures: 0,
      creationDate: now.toISOString(),
      expirationDate: expiration.toISOString(),
      authorId: parseInt(userId),
      categoryId: parseInt(categoryId),
      platformId: parseInt(finalPlatformId), // <--- Ritorniamo l'ID corretto
      externalURL: null,
      attachments: responseAttachments,
      reply: null,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    if (files) cleanupFiles(files);

    console.error("Errore CreateInitiative:", err);
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res
        .status(400)
        .json({ message: "ID Categoria o ID Utente inesistente." });
    }
    res.status(500).json({ message: "Errore interno del server." });
  } finally {
    if (connection) connection.release();
  }
};

// --- NUOVO METODO PER IL CHECK LEGGERO (GET) ---
exports.checkCooldown = async (req, res) => {
  try {
    const userId = req.user.id;

    // Cerca l'ultima iniziativa
    const [rows] = await db.execute(
      "SELECT DATA_CREAZIONE FROM INIZIATIVA WHERE ID_AUTORE = ? ORDER BY DATA_CREAZIONE DESC LIMIT 1",
      [userId]
    );

    // Se non ha mai creato iniziative, via libera
    if (rows.length === 0) {
      return res.status(200).json({ allowed: true });
    }

    const lastDate = new Date(rows[0].DATA_CREAZIONE);
    const now = new Date();

    // Calcola fine cooldown (14 giorni)
    const cooldownEnd = new Date(lastDate);
    cooldownEnd.setDate(lastDate.getDate() + 14);

    if (now < cooldownEnd) {
      // Cooldown attivo
      return res.status(200).json({
        allowed: false,
        remainingMs: cooldownEnd - now,
      });
    }

    return res.status(200).json({ allowed: true });
  } catch (err) {
    console.error("Errore checkCooldown:", err);
    res.status(500).json({ message: "Errore server" });
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

// --- ADMIN: Dashboard Iniziative in Scadenza ---
exports.getExpiringInitiatives = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check Admin... (codice uguale a prima)
    const [admins] = await db.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [userId]
    );
    if (admins.length === 0 || !admins[0].IS_ADMIN)
      return res.status(403).json({ message: "Accesso negato" });

    const { currentPage, objectsPerPage } = req.query;
    const page = parseInt(currentPage) || 1;
    const limit = parseInt(objectsPerPage) || 10;
    const offset = (page - 1) * limit;

    // --- QUERY CORRETTA ---
    const whereClause = `
        WHERE i.STATO = 'In corso' AND i.DATA_SCADENZA > NOW()
    `;

    const queryData = `
      SELECT 
        ID_INIZIATIVA, TITOLO, DESCRIZIONE, LUOGO, 
        STATO, NUM_FIRME, DATA_SCADENZA, 
        ID_CATEGORIA, ID_AUTORE, ID_PIATTAFORMA,
        (SELECT a.FILE_PATH FROM ALLEGATO a WHERE a.ID_INIZIATIVA = i.ID_INIZIATIVA AND a.FILE_TYPE LIKE 'image/%' ORDER BY a.ID_ALLEGATO ASC LIMIT 1) as FILE_PATH
      FROM INIZIATIVA i
      ${whereClause}
      ORDER BY DATA_SCADENZA ASC 
      LIMIT ? OFFSET ?
    `;

    const queryCount = `SELECT COUNT(*) as total FROM INIZIATIVA i ${whereClause}`;

    const [rows] = await db.query(queryData, [limit, offset]);
    const [count] = await db.query(queryCount);

    res.json({
      data: rows.map((row) => ({
        id: row.ID_INIZIATIVA,
        title: row.TITOLO,
        description: row.DESCRIZIONE,
        place: row.LUOGO,
        signatures: row.NUM_FIRME,
        expirationDate: row.DATA_SCADENZA,
        status: row.STATO,
        authorId: row.ID_AUTORE,
        categoryId: row.ID_CATEGORIA,
        platformId: row.ID_PIATTAFORMA,
        image: row.FILE_PATH,
      })),
      meta: {
        currentPage: page,
        objectsPerPage: limit,
        totalObjects: count[0].total,
        totalPages: Math.ceil(count[0].total / limit),
      },
    });
  } catch (err) {
    console.error("Errore getExpiring:", err);
    res.status(500).json({ message: "Errore server" });
  }
};

exports.changeExpirationDate = async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const userId = req.user.id;

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
  try {
    const initiativeId = req.params.id;
    const userId = req.user.id;
    const { title, description, place, categoryId } = req.body;

    // 1. Verifica esistenza e proprietà
    const [rows] = await db.query(
      "SELECT ID_AUTORE, STATO FROM INIZIATIVA WHERE ID_INIZIATIVA = ?",
      [initiativeId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Iniziativa non trovata" });
    }

    const initiative = rows[0];

    // 2. Controllo permessi (solo autore può modificare)
    if (initiative.ID_AUTORE !== parseInt(userId)) {
      return res.status(403).json({ message: "Non sei l'autore di questa iniziativa" });
    }

    // 3. Controllo stato (solo 'In corso' modificabile)
    if (initiative.STATO !== 'In corso') {
      return res.status(400).json({ message: "Impossibile modificare un'iniziativa non in corso" });
    }

    // 4. Update
    const updateQuery = `
      UPDATE INIZIATIVA 
      SET TITOLO = COALESCE(?, TITOLO), 
          DESCRIZIONE = COALESCE(?, DESCRIZIONE), 
          LUOGO = COALESCE(?, LUOGO), 
          ID_CATEGORIA = COALESCE(?, ID_CATEGORIA)
      WHERE ID_INIZIATIVA = ?
    `;

    await db.query(updateQuery, [title, description, place, categoryId, initiativeId]);

    res.status(200).json({ message: "Iniziativa aggiornata con successo" });

  } catch (err) {
    console.error("Errore updateInitiative:", err);
    res.status(500).json({ message: "Errore interno del server" });
  }
};

// Assicurati di importare lo schema di validazione all'inizio del file se non c'è già
// const { administrationReplySchema } = require('../validators/initiativeSchema');

// --- MODIFICA: CreateReply con Multer per la gestione dei file---
exports.createReply = async (req, res) => {
  let connection;
  const files = req.files; // File caricati (Immagini o PDF)

  try {
    const initiativeId = req.params.id;
    const adminId = req.user.id;

    const { error, value } = administrationReplySchema.validate(req.body, {
      abortEarly: false,
    });
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
    const { status, motivations } = value;

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check permessi Admin
    const [users] = await connection.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [adminId]
    );
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
    const [replyResult] = await connection.execute(queryInsertReply, [
      initiativeId,
      adminId,
      motivations,
    ]);
    const newReplyId = replyResult.insertId;

    // Update Stato Iniziativa
    await connection.execute(
      "UPDATE INIZIATIVA SET STATO = ? WHERE ID_INIZIATIVA = ?",
      [status, initiativeId]
    );

    // Insert Allegati (se presenti)
    let savedAttachments = [];
    if (files && files.length > 0) {
      const queryAllegato = `INSERT INTO ALLEGATO (FILE_NAME, FILE_PATH, FILE_TYPE, ID_RISPOSTA) VALUES (?, ?, ?, ?)`;
      const insertPromises = files.map((file) => {
        const relativePath = path.join("uploads", "replies", file.filename);
        // Salviamo il path relativo nell'oggetto file per usarlo nella risposta
        file.dbPath = relativePath;
        return connection.execute(queryAllegato, [
          file.originalname,
          relativePath,
          file.mimetype,
          newReplyId,
        ]);
      });
      await Promise.all(insertPromises);
      savedAttachments = files.map((f) => ({
        fileName: f.originalname,
        filePath: f.dbPath,
      }));
    }

    // Invio Notifiche (Logica Preservata)
    const queryRecipients = `
            SELECT ID_AUTORE AS ID_UTENTE FROM INIZIATIVA WHERE ID_INIZIATIVA = ? AND ID_AUTORE IS NOT NULL
            UNION
            SELECT ID_UTENTE FROM FIRMA_INIZIATIVA WHERE ID_INIZIATIVA = ?
            UNION
            SELECT ID_UTENTE FROM INIZIATIVA_SALVATA WHERE ID_INIZIATIVA = ?
        `;
    const [recipients] = await connection.query(queryRecipients, [
      initiativeId,
      initiativeId,
      initiativeId,
    ]);

    if (recipients.length > 0) {
      const notificationText = `L'iniziativa "${initiativeTitle}" ha ricevuto una risposta ufficiale ed è passata allo stato: ${status}`;
      const linkRef = `/initiatives/${initiativeId}`;
      const queryInsertNotifica = `INSERT INTO NOTIFICA (ID_UTENTE, TESTO, LINK_RIF) VALUES (?, ?, ?)`;

      const notificationPromises = recipients.map((user) =>
        connection.execute(queryInsertNotifica, [
          user.ID_UTENTE,
          notificationText,
          linkRef,
        ])
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
    const userId = req.user.id;

    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. BLOCCO SICUREZZA (Controllo residenza)
    const [userCheck] = await connection.execute(
      "SELECT IS_CITTADINO FROM UTENTE WHERE ID_UTENTE = ?",
      [userId]
    );

    if (userCheck.length === 0 || !userCheck[0].IS_CITTADINO) {
      await connection.rollback();
      return res.status(403).json({
        message:
          "Azione non consentita: Solo i cittadini residenti possono firmare.",
      });
    }

    // 2. Inserimento Firma
    await connection.execute(
      `INSERT INTO FIRMA_INIZIATIVA (ID_UTENTE, ID_INIZIATIVA) VALUES (?, ?)`,
      [userId, initiativeId]
    );

    // 3. Aggiornamento Contatore Firme
    await connection.execute(
      `UPDATE INIZIATIVA SET NUM_FIRME = NUM_FIRME + 1 WHERE ID_INIZIATIVA = ?`,
      [initiativeId]
    );

    // 4. Recupero dati aggiornati (Titolo e Nuovo numero firme)
    const [rows] = await connection.execute(
      "SELECT TITOLO, NUM_FIRME FROM INIZIATIVA WHERE ID_INIZIATIVA = ?",
      [initiativeId]
    );
    const newCount = rows[0].NUM_FIRME;
    const title = rows[0].TITOLO;

    await connection.commit(); // Salva tutto definitivamente

    // --- DA QUI IN POI LE AZIONI NON BLOCCANTI ---

    // 5. 🔔 NOTIFICHE MILESTONE (Logica aggiunta)
    // Controlliamo se abbiamo raggiunto un traguardo importante (50, 100, 500...)
    if (newCount === 50 || newCount === 100 || newCount % 500 === 0) {
      const msg = `🚀 L'iniziativa "${title}" ha appena raggiunto ${newCount} firme!`;
      const link = `/initiative/${initiativeId}`;

      // Funzione helper "Fire & Forget" (senza await per non rallentare la risposta)
      notifyFollowers(initiativeId, msg, link);
      console.log(
        `[NOTIFICA] Milestone ${newCount} raggiunta per iniziativa ${initiativeId}`
      );
    }

    res.status(201).json({
      message: "Firma registrata con successo",
      signatures: newCount,
    });
  } catch (err) {
    if (connection) await connection.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "Hai già firmato questa iniziativa." });
    }
    console.error("Errore signInitiative:", err);
    res.status(500).json({ message: "Errore server." });
  } finally {
    if (connection) connection.release();
  }
};

exports.followInitiative = async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const userId = req.user.id;

    // USA "INSERT IGNORE" invece di INSERT normale
    // Questo evita l'errore ER_DUP_ENTRY se esiste già
    const query = `
      INSERT IGNORE INTO INIZIATIVA_SALVATA (ID_UTENTE, ID_INIZIATIVA)
      VALUES (?, ?)
    `;

    const [result] = await db.execute(query, [userId, initiativeId]);

    // Se affectedRows è 0, significava che c'era già, ma va bene lo stesso!
    // Restituiamo 200 OK in entrambi i casi.

    res.status(200).json({
      success: true,
      message: "Iniziativa aggiunta ai preferiti",
      userId: parseInt(userId),
      initiativeId: parseInt(initiativeId),
    });
  } catch (err) {
    console.error("Errore followInitiative:", err);
    res.status(500).json({ message: "Errore interno server" });
  }
};

exports.unfollowInitiative = async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const userId = req.user.id;

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
    attachments: attachmentsInit.map(att => ({
        id: att.ID_ALLEGATO,
        fileName: att.FILE_NAME,
        filePath: att.FILE_PATH,
        fileType: att.FILE_TYPE,
        uploadedAt: att.UPLOADED_AT,
    })),
    reply: formattedReply,
    attachment: attachmentsInit.length > 0 ? { filePath: attachmentsInit[0].FILE_PATH } : null,
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

// Helper per inviare una notifica a un singolo utente (es. Autore)
const notifySingleUser = async (userId, message, link) => {
  try {
    const query = `INSERT INTO NOTIFICA (ID_UTENTE, TESTO, LINK_RIF, LETTA) VALUES (?, ?, ?, 0)`;
    await db.query(query, [userId, message, link]);
    console.log(`[NOTIFICA SINGOLA] Inviata a User ${userId}`);
  } catch (err) {
    console.error("Errore notifica singola:", err);
  }
};

/**
 * CAMBIO STATO INIZIATIVA (Solo Admin)
 * Aggiorna lo stato e notifica i follower.
 */
exports.updateInitiativeStatus = async (req, res) => {
  try {
    const initiativeId = req.params.id;
    const userId = req.user.id;

    const { status } = req.body;

    if (!status)
      return res.status(400).json({ message: "Dati mancanti" });

    // 1. Controllo Admin
    const [admins] = await db.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [userId]
    );

    // Controllo robusto: verifica che l'utente esista E sia admin
    if (admins.length === 0 || !admins[0].IS_ADMIN) {
      return res.status(403).json({ message: "Accesso negato: Solo Admin." });
    }

    // 2. Recupero Info Iniziativa e Autore
    const [rows] = await db.query(
      "SELECT TITOLO, ID_AUTORE FROM INIZIATIVA WHERE ID_INIZIATIVA = ?",
      [initiativeId]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "Iniziativa non trovata" });

    const { TITOLO: title, ID_AUTORE: authorId } = rows[0];

    // 3. Aggiornamento DB
    await db.query("UPDATE INIZIATIVA SET STATO = ? WHERE ID_INIZIATIVA = ?", [
      status,
      initiativeId,
    ]);

    // 4. GESTIONE NOTIFICHE INTELLIGENTE 🔔
    const link = `/initiative/${initiativeId}`;

    // A. Notifica all'AUTORE
    if (authorId) {
      let authorMsg = `Lo stato della tua iniziativa "${title}" è cambiato in: ${status}.`;

      // Personalizzazione tono
      if (status === "Respinta") {
        authorMsg = `⚠️ Attenzione: La tua iniziativa "${title}" non è stata approvata.`;
      } else if (status === "Approvata") {
        authorMsg = `✅ Complimenti! La tua iniziativa "${title}" è stata approvata ed è ora pubblica.`;
      }

      // Await qui è utile per essere sicuri che l'autore riceva la notifica prima di chiudere
      await notifySingleUser(authorId, authorMsg, link);
    }

    // B. Notifica ai FOLLOWER (Solo se notizie positive/neutre)
    if (status !== "Respinta") {
      let followerMsg = `Aggiornamento: L'iniziativa "${title}" è ora ${status}.`;
      if (status === "Approvata")
        followerMsg = `🚀 L'iniziativa "${title}" che segui è stata approvata!`;

      // Non usiamo 'await' qui per non rallentare la risposta se i follower sono tanti (Fire & Forget)
      notifyFollowers(initiativeId, followerMsg, link);
    }

    res
      .status(200)
      .json({ message: "Stato aggiornato con successo", newStatus: status });
  } catch (err) {
    console.error("Errore updateStatus:", err);
    res.status(500).json({ message: "Errore server durante l'aggiornamento" });
  }
};
