const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { initiativeSchema } = require("../validators/initiativeSchema");
const { changeExpirationSchema } = require("../validators/initiativeSchema");
const { administrationReplySchema } = require("../validators/initiativeSchema");
const { INITIATIVE_SORT_MAP } = require("../config/constants");

/**
 * Funzione Helper per cancellare i file caricati se la procedura fallisce
 * NOTA: Con Cloudinary i file non sono locali. Questa funzione ora controlla
 * se il path è un URL (Cloudinary) o un percorso locale.
 */
const cleanupFiles = (files) => {
  if (!files || files.length === 0) return;
  files.forEach((file) => {
    // Se il file ha un path che inizia con http (Cloudinary), non usiamo fs.unlink
    if (file.path && file.path.startsWith("http")) {
      // Per cancellare da Cloudinary servirebbe le API Cloudinary uploader.destroy
      // Per ora saltiamo, tanto non occupa spazio sul server.
      return;
    }

    // Se siamo qui, è un file locale (vecchio metodo o fallback)
    fs.unlink(file.path, (err) => {
      if (err)
        console.error(
          `[Cleanup] Errore cancellazione file locale ${file.path}:`,
          err,
        );
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
      status,
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

    // --- FILTRI GENERALI ---

    // Filtro: Status (Gestisce sia stringa singola che array)
    if (status) {
      if (Array.isArray(status) && status.length > 0) {
        const placeholders = status.map(() => "?").join(",");
        whereConditions.push(`i.STATO IN (${placeholders})`);
        queryParams.push(...status);
      } else if (typeof status === "string" && status) {
        whereConditions.push("i.STATO = ?");
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
    if (req.query.dateFrom) {
      whereConditions.push("i.DATA_CREAZIONE >= ?");
      queryParams.push(req.query.dateFrom);
    }
    if (req.query.dateTo) {
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
      [userId],
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

    const { title, description, place, categoryId, platformId } = value;
    const finalPlatformId = platformId || 1; // Default Trento Partecipa

    connection = await db.getConnection();
    await connection.beginTransaction();

    const now = new Date();
    const expiration = new Date(now);
    expiration.setDate(expiration.getDate() + 30);

    // 2. Inserimento Iniziativa
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
      finalPlatformId,
      now,
      expiration,
    ]);

    const newInitiativeId = resultInit.insertId;

    // 3. Inserimento Allegati (CORRETTO PER CLOUDINARY)
    let responseAttachments = null;

    if (files && files.length > 0) {
      responseAttachments = [];
      const queryAllegato = `
                INSERT INTO ALLEGATO (FILE_NAME, FILE_PATH, FILE_TYPE, ID_INIZIATIVA)
                VALUES (?, ?, ?, ?)
            `;

      for (const file of files) {
        // --- MODIFICA CLOUDINARY ---
        // Con Cloudinary, file.path è l'URL completo (https://res.cloudinary.com/...)
        // Non usiamo più path.join per costruire un percorso locale.
        const filePath = file.path;

        const [resAtt] = await connection.execute(queryAllegato, [
          file.originalname,
          filePath, // Salviamo l'URL completo
          file.mimetype,
          newInitiativeId,
        ]);

        responseAttachments.push({
          id: resAtt.insertId,
          fileName: file.originalname,
          filePath: filePath,
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
      platformId: parseInt(finalPlatformId),
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

exports.checkCooldown = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
      "SELECT DATA_CREAZIONE FROM INIZIATIVA WHERE ID_AUTORE = ? ORDER BY DATA_CREAZIONE DESC LIMIT 1",
      [userId],
    );

    if (rows.length === 0) {
      return res.status(200).json({ allowed: true });
    }

    const lastDate = new Date(rows[0].DATA_CREAZIONE);
    const now = new Date();

    const cooldownEnd = new Date(lastDate);
    cooldownEnd.setDate(lastDate.getDate() + 14);

    if (now < cooldownEnd) {
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

    const data = await _getDetailedInitiativeData(id);

    if (!data) {
      return res.status(404).json({
        timeStamp: new Date().toISOString(),
        message: "Iniziativa non trovata",
      });
    }

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

exports.getExpiringInitiatives = async (req, res) => {
  try {
    const userId = req.user.id;

    const [admins] = await db.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [userId],
    );
    if (admins.length === 0 || !admins[0].IS_ADMIN)
      return res.status(403).json({ message: "Accesso negato" });

    const { currentPage, objectsPerPage } = req.query;
    const page = parseInt(currentPage) || 1;
    const limit = parseInt(objectsPerPage) || 10;
    const offset = (page - 1) * limit;

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

    const [users] = await db.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [userId],
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

    const [initiatives] = await db.query(
      "SELECT ID_INIZIATIVA FROM INIZIATIVA WHERE ID_INIZIATIVA = ?",
      [initiativeId],
    );
    if (initiatives.length === 0) {
      return res.status(404).json({
        timeStamp: new Date().toISOString(),
        message: "Iniziativa non trovata",
      });
    }

    const updateQuery = `
            UPDATE INIZIATIVA 
            SET DATA_SCADENZA = ?, 
                STATO = CASE WHEN STATO = 'Scaduta' THEN 'In corso' ELSE STATO END 
            WHERE ID_INIZIATIVA = ?
        `;

    await db.query(updateQuery, [expirationDate, initiativeId]);

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
      [adminId],
    );
    if (users.length === 0 || !users[0].IS_ADMIN) {
      await connection.rollback();
      cleanupFiles(files);
      return res.status(403).json({ message: "Operazione non consentita." });
    }

    // Check Iniziativa
    const [initiatives] = await connection.query(
      "SELECT ID_INIZIATIVA, TITOLO FROM INIZIATIVA WHERE ID_INIZIATIVA = ?",
      [initiativeId],
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
      [initiativeId],
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
      [status, initiativeId],
    );

    // Insert Allegati (CORRETTO PER CLOUDINARY)
    let savedAttachments = [];
    if (files && files.length > 0) {
      const queryAllegato = `INSERT INTO ALLEGATO (FILE_NAME, FILE_PATH, FILE_TYPE, ID_RISPOSTA) VALUES (?, ?, ?, ?)`;

      const insertPromises = files.map((file) => {
        // --- MODIFICA CLOUDINARY ---
        // Usiamo file.path (URL Cloudinary) invece di costruire il percorso locale
        const filePath = file.path;
        file.dbPath = filePath; // Lo salviamo nell'oggetto per usarlo nella risposta JSON

        return connection.execute(queryAllegato, [
          file.originalname,
          filePath,
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

    // Invio Notifiche
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
        ]),
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
      [userId],
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
      [userId, initiativeId],
    );

    // 3. Aggiornamento Contatore Firme
    await connection.execute(
      `UPDATE INIZIATIVA SET NUM_FIRME = NUM_FIRME + 1 WHERE ID_INIZIATIVA = ?`,
      [initiativeId],
    );

    // 4. Recupero dati aggiornati
    const [rows] = await connection.execute(
      "SELECT TITOLO, NUM_FIRME FROM INIZIATIVA WHERE ID_INIZIATIVA = ?",
      [initiativeId],
    );
    const newCount = rows[0].NUM_FIRME;
    const title = rows[0].TITOLO;

    await connection.commit();

    // 5. 🔔 NOTIFICHE MILESTONE
    if (newCount === 50 || newCount === 100 || newCount % 500 === 0) {
      const msg = `🚀 L'iniziativa "${title}" ha appena raggiunto ${newCount} firme!`;
      const link = `/initiative/${initiativeId}`;

      notifyFollowers(initiativeId, msg, link);
      console.log(
        `[NOTIFICA] Milestone ${newCount} raggiunta per iniziativa ${initiativeId}`,
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

    const query = `
      INSERT IGNORE INTO INIZIATIVA_SALVATA (ID_UTENTE, ID_INIZIATIVA)
      VALUES (?, ?)
    `;

    const [result] = await db.execute(query, [userId, initiativeId]);

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

    const query = `
            DELETE FROM INIZIATIVA_SALVATA 
            WHERE ID_UTENTE = ? AND ID_INIZIATIVA = ?
        `;

    const [result] = await db.execute(query, [userId, initiativeId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        timeStamp: new Date().toISOString(),
        message:
          "Impossibile rimuovere: l'iniziativa non era tra i seguiti o non esiste.",
      });
    }

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

// --- Funzioni Helper Private ---

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
    attachments: attachmentsInit.map((att) => ({
      id: att.ID_ALLEGATO,
      fileName: att.FILE_NAME,
      filePath: att.FILE_PATH,
      fileType: att.FILE_TYPE,
      uploadedAt: att.UPLOADED_AT,
    })),
    reply: formattedReply,
    attachment:
      attachmentsInit.length > 0
        ? { filePath: attachmentsInit[0].FILE_PATH }
        : null,
  };
}

const notifyFollowers = async (initiativeId, message, link) => {
  try {
    const queryFollowers = `SELECT ID_UTENTE FROM INIZIATIVA_SALVATA WHERE ID_INIZIATIVA = ?`;
    const [followers] = await db.query(queryFollowers, [initiativeId]);

    if (followers.length === 0) return;

    const queryInsert = `INSERT INTO NOTIFICA (ID_UTENTE, TESTO, LINK_RIF, LETTA) VALUES ?`;
    const values = followers.map((f) => [f.ID_UTENTE, message, link, 0]);

    await db.query(queryInsert, [values]);
    console.log(
      `[NOTIFICHE] Inviate ${followers.length} notifiche per l'iniziativa ${initiativeId}`,
    );
  } catch (err) {
    console.error("Errore invio notifiche:", err);
  }
};

const notifySingleUser = async (userId, message, link) => {
  try {
    const query = `INSERT INTO NOTIFICA (ID_UTENTE, TESTO, LINK_RIF, LETTA) VALUES (?, ?, ?, 0)`;
    await db.query(query, [userId, message, link]);
    console.log(`[NOTIFICA SINGOLA] Inviata a User ${userId}`);
  } catch (err) {
    console.error("Errore notifica singola:", err);
  }
};
