// --- Gestione Profilo e Dashboard ---

const db = require("../config/db");
const {
  CLIENT_ID,
  client,
  otpStore,
  generateDeterministicFiscalCode,
} = require("../utils/authUtils");

exports.userRegistration = async (req, res) => {
  const { googleToken, email, otp } = req.body;

  // 1. Recupero OTP dallo store
  const storedOtp = otpStore[email];

  // A. Controllo esistenza e corrispondenza codice
  // Se non c'è l'OTP in memoria o il codice digitato non combacia
  if (!storedOtp || storedOtp.code !== otp) {
    return res.status(400).json({ message: "Codice OTP errato." });
  }

  // B. Controllo SCADENZA (Nuova logica aggiunta)
  // Se l'orario attuale è maggiore della scadenza impostata
  if (Date.now() > storedOtp.expires) {
    // Cancelliamo il codice scaduto per pulizia, così non può essere riusato
    delete otpStore[email];
    // Restituiamo ESATTAMENTE il messaggio che il frontend si aspetta per mostrare l'errore in rosso
    return res
      .status(400)
      .json({ message: "Codice OTP scaduto, generane un altro" });
  }

  // --- Da qui in poi procediamo con la verifica Google e il salvataggio DB ---

  // Verifica Token Google e Ricalcolo CF (Sicurezza)
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Token Google scaduto o non valido." });
  }

  // Ricalcoliamo lo stesso CF deterministico usato nel login
  const deterministicCF = generateDeterministicFiscalCode(payload.sub);

  const firstName = payload.given_name || "Utente";
  const lastName = payload.family_name || "Google";

  try {
    const isAdmin = email.toLowerCase().includes("admin") ? 1 : 0;
    const isCitizen = isAdmin ? 0 : 1;

    // Tentativo di inserimento nel DB
    const query = `
        INSERT INTO UTENTE (NOME, COGNOME, EMAIL, CODICE_FISCALE, IS_ADMIN, IS_CITTADINO, CREATED_AT)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.query(query, [
      firstName,
      lastName,
      email,
      deterministicCF,
      isAdmin,
      isCitizen,
    ]);

    // Recuperiamo l'utente appena creato per restituirlo al frontend
    const [rows] = await db.query("SELECT * FROM UTENTE WHERE ID_UTENTE = ?", [
      result.insertId,
    ]);
    const user = rows[0];

    // Pulizia finale: rimuoviamo l'OTP usato con successo
    delete otpStore[email];

    res.status(201).json({
      status: "REGISTRATION_SUCCESS",
      user: {
        id: user.ID_UTENTE,
        firstName: user.NOME,
        lastName: user.COGNOME,
        email: user.EMAIL,
        isAdmin: Boolean(user.IS_ADMIN),
        isCitizen: Boolean(user.IS_CITTADINO),
      },
    });
  } catch (err) {
    console.error("Errore DB:", err);
    // Gestione specifica duplicati (se nel frattempo qualcuno ha preso l'email)
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email già registrata." });
    }
    res.status(500).json({ message: "Errore durante il salvataggio utente." });
  }
};

exports.getUser = async (req, res) => {
  try {
    const userId = req.user.id;

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
        message: "Utente non trovato",
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
      isAdmin: Boolean(user.IS_ADMIN), // Assicuriamoci che sia true/false
      isCitizen: Boolean(user.IS_CITTADINO),
      createdAt: user.CREATED_AT,
    };

    // 5. Invio Risposta
    res.status(200).json(formattedUser);
  } catch (err) {
    console.error("Errore getUser:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno del server durante il recupero del profilo",
      details:
        process.env.NODE_ENV === "development"
          ? [{ field: "server", issue: err.message }]
          : undefined,
    });
  }
};


// ... (imports e getUser già presenti)

exports.initiativesDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // 2. Lettura Parametri Query
    const relation = req.query.relation; // 'created', 'signed', 'followed'
    const currentPage = parseInt(req.query.currentPage) || 1;
    const limit = parseInt(req.query.objectsPerPage) || 10;
    const offset = (currentPage - 1) * limit;

    // Validazione parametro relation
    const allowedRelations = ["created", "signed", "followed"];
    if (!relation || !allowedRelations.includes(relation)) {
      return res.status(400).json({
        timeStamp: new Date().toISOString(),
        message:
          "Parametro 'relation' mancante o non valido. Valori ammessi: created, signed, followed",
      });
    }

    // 3. Costruzione Query Dinamica
    let sqlData = "";
    let sqlCount = "";
    let queryParams = [userId];

    // Base select per i campi dell'iniziativa
    // userController.js - Dentro initiativesDashboard
    const baseSelect = `
    SELECT 
        i.ID_INIZIATIVA, i.TITOLO, i.DESCRIZIONE, i.LUOGO, i.STATO, 
        i.NUM_FIRME, i.DATA_CREAZIONE, i.DATA_SCADENZA, 
        i.ID_AUTORE, i.ID_CATEGORIA, i.ID_PIATTAFORMA, i.URL_ESTERNO,
        -- Qui usiamo il nome colonna reale che ho visto nello screenshot: FILE_PATH
        (SELECT FILE_PATH FROM ALLEGATO WHERE ID_INIZIATIVA = i.ID_INIZIATIVA LIMIT 1) as FILE_PATH
    FROM INIZIATIVA i
`;

    switch (relation) {
      case "created":
        // Iniziative create dall'utente
        sqlData = `${baseSelect} WHERE i.ID_AUTORE = ? ORDER BY i.DATA_CREAZIONE DESC LIMIT ? OFFSET ?`;
        sqlCount = `SELECT COUNT(*) as total FROM INIZIATIVA WHERE ID_AUTORE = ?`;
        break;

      case "signed":
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

      case "followed":
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
    const formattedData = rows.map((row) => ({
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
      attachments: row.FILE_PATH ? { filePath: row.FILE_PATH } : null,
      reply: null,
    }));

    const totalPages = Math.ceil(totalObjects / limit);

    // 6. Invio Risposta
    res.status(200).json({
      data: formattedData,
      meta: {
        currentPage: currentPage,
        objectsPerPage: limit,
        totalObjects: totalObjects,
        totalPages: totalPages,
      },
    });
  } catch (err) {
    console.error("Errore initiativesDashboard:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno durante il recupero della dashboard iniziative",
      details:
        process.env.NODE_ENV === "development"
          ? [{ field: "database", issue: err.message }]
          : undefined,
    });
  }
};

exports.notificationsList = async (req, res) => {
  try {
    const userId = req.user.id;

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
    if (read === "false") {
      whereClause += " AND LETTA = 0";
    } else if (read === "true") {
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
    const formattedData = rows.map((row) => ({
      id: row.ID_NOTIFICA,
      text: row.TESTO,
      isRead: Boolean(row.LETTA), // Converte 0/1 in false/true
      creationDate: row.DATA_CREAZIONE,
      linkRef: row.LINK_RIF || null,
    }));

    const totalPages = Math.ceil(totalObjects / limit);

    // 6. Invio Risposta
    res.status(200).json({
      data: formattedData,
      meta: {
        currentPage: page,
        objectsPerPage: limit,
        totalObjects: totalObjects,
        totalPages: totalPages,
      },
    });
  } catch (err) {
    console.error("Errore notificationsList:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno durante il recupero delle notifiche",
      details:
        process.env.NODE_ENV === "development"
          ? [{ field: "database", issue: err.message }]
          : undefined,
    });
  }
};

exports.readNotification = async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;

    // 2. Validazione Body RIGOROSA
    // Accettiamo SOLO { "isRead": true }
    const { isRead } = req.body;

    if (isRead !== true) {
      return res.status(400).json({
        timeStamp: new Date().toISOString(),
        message:
          "Operazione non valida. È possibile solo segnare una notifica come letta (isRead: true). Non è possibile impostarla come non letta.",
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
        message: "Notifica non trovata o non appartenente all'utente",
      });
    }

    const currentNotification = rows[0];

    // 4. Aggiornamento Idempotente (Solo se non è già letta)
    // Non usiamo variabili dinamiche, forziamo 1.
    if (currentNotification.LETTA === 0) {
      await db.query("UPDATE NOTIFICA SET LETTA = 1 WHERE ID_NOTIFICA = ?", [
        notificationId,
      ]);
      // Aggiorniamo l'oggetto in memoria
      currentNotification.LETTA = 1;
    }

    // 5. Mappatura Risposta
    const responseData = {
      id: currentNotification.ID_NOTIFICA,
      text: currentNotification.TESTO,
      isRead: true, // Ora è sicuramente true
      creationDate: currentNotification.DATA_CREAZIONE,
      linkRef: currentNotification.LINK_RIF || null,
    };

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Errore readNotification:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno durante l'aggiornamento della notifica",
      details:
        process.env.NODE_ENV === "development"
          ? [{ field: "database", issue: err.message }]
          : undefined,
    });
  }
};
// --- Gestione Amministrativa e Registrazione ---

exports.showAdminUsers = async (req, res) => {
  try {
    const requesterId = req.user.id;

    // 2. Controllo Permessi Admin
    const [requesters] = await db.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [requesterId]
    );
    if (requesters.length === 0 || !requesters[0].IS_ADMIN) {
      return res
        .status(403)
        .json({ message: "Accesso negato: solo gli admin." });
    }

    // 3. Parametri Query
    const { fiscalCode, currentPage, objectsPerPage } = req.query;
    const page = parseInt(currentPage) || 1;
    const limit = parseInt(objectsPerPage) || 10;
    const offset = (page - 1) * limit;

    // 4. Costruzione Query (SOLO ADMIN)
    // Partiamo già filtrando per IS_ADMIN = 1
    let queryBase = `SELECT ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL FROM UTENTE WHERE IS_ADMIN = 1`;
    let queryCount = `SELECT COUNT(*) as total FROM UTENTE WHERE IS_ADMIN = 1`;
    const queryParams = [];

    // Filtro Opzionale Codice Fiscale
    if (fiscalCode) {
      queryBase += ` AND CODICE_FISCALE LIKE ?`;
      queryCount += ` AND CODICE_FISCALE LIKE ?`;
      queryParams.push(`%${fiscalCode}%`);
    }

    // Ordinamento e Paginazione
    queryBase += ` ORDER BY COGNOME ASC, NOME ASC LIMIT ? OFFSET ?`;
    const dataParams = [...queryParams, limit, offset];

    // 5. Esecuzione
    const [rows] = await db.query(queryBase, dataParams);
    const [countRows] = await db.query(queryCount, queryParams);

    // 6. Risposta
    res.status(200).json({
      data: rows.map((u) => ({
        id: u.ID_UTENTE,
        firstName: u.NOME,
        lastName: u.COGNOME,
        fiscalCode: u.CODICE_FISCALE,
        email: u.EMAIL,
        isAdmin: true, // Sono tutti admin in questa lista
      })),
      meta: {
        currentPage: page,
        objectsPerPage: limit,
        totalObjects: countRows[0].total,
        totalPages: Math.ceil(countRows[0].total / limit),
      },
    });
  } catch (err) {
    console.error("Errore showAdminUsers:", err);
    res.status(500).json({ message: "Errore server" });
  }
};

exports.changePrivileges = async (req, res) => {
  try {
    const targetUserId = req.params.id; // L'ID dell'utente da modificare
    const requesterId = req.user.id; // Chi sta facendo la richiesta

    // 2. Validazione Body
    const { isAdmin } = req.body;
    if (typeof isAdmin !== "boolean") {
      return res.status(400).json({
        timeStamp: new Date().toISOString(),
        message: "Formato non valido: 'isAdmin' deve essere un booleano.",
      });
    }

    // 3. Controllo Permessi Richiedente (Deve essere Admin)
    const queryCheckAdmin = "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?";
    const [requesters] = await db.query(queryCheckAdmin, [requesterId]);

    if (requesters.length === 0 || !requesters[0].IS_ADMIN) {
      return res.status(403).json({
        timeStamp: new Date().toISOString(),
        message: "Accesso negato: operazione riservata agli amministratori.",
      });
    }

    // 4. Controllo Auto-Revoca (RF 10.3)
    // Impediamo a un admin di togliersi i privilegi da solo per non rimanere chiusi fuori
    // Nota: convertiamo in stringa o intero per sicurezza nel confronto
    if (String(targetUserId) === String(requesterId) && isAdmin === false) {
      return res.status(403).json({
        timeStamp: new Date().toISOString(),
        message:
          "Operazione non consentita: non puoi revocare i tuoi stessi privilegi di amministratore.",
      });
    }

    // 5. Verifica Esistenza Utente Target
    const checkTargetQuery = "SELECT ID_UTENTE FROM UTENTE WHERE ID_UTENTE = ?";
    const [targets] = await db.query(checkTargetQuery, [targetUserId]);

    if (targets.length === 0) {
      return res.status(404).json({
        timeStamp: new Date().toISOString(),
        message: "Utente non trovato.",
      });
    }

    // 6. Aggiornamento Privilegi (RF 10.2 e RF 10.3)
    const updateQuery = "UPDATE UTENTE SET IS_ADMIN = ? WHERE ID_UTENTE = ?";
    // Converto il booleano true/false in 1/0 per il DB
    await db.query(updateQuery, [isAdmin ? 1 : 0, targetUserId]);

    // 7. Risposta
    res.status(200).json({
      message: `Privilegi aggiornati con successo. Utente ${targetUserId} è ora ${
        isAdmin ? "Admin" : "Utente standard"
      }.`,
    });
  } catch (err) {
    console.error("Errore changePrivileges:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno durante l'aggiornamento dei privilegi",
      details:
        process.env.NODE_ENV === "development"
          ? [{ field: "database", issue: err.message }]
          : undefined,
    });
  }
};

exports.searchUserByFiscalCode = async (req, res) => {
  try {
    const requesterId = req.user.id;

    // Controllo che il richiedente sia un admin
    const [requesters] = await db.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [requesterId]
    );
    if (requesters.length === 0 || !requesters[0].IS_ADMIN) {
      return res
        .status(403)
        .json({ message: "Accesso negato: solo gli admin possono cercare utenti." });
    }

    const { fiscalCode } = req.query;

    if (!fiscalCode) {
      return res.status(400).json({ message: "Parametro fiscalCode mancante" });
    }

    // Cerchiamo l'utente (qualsiasi ruolo)
    const query = `
      SELECT ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_ADMIN, IS_CITTADINO
      FROM UTENTE 
      WHERE CODICE_FISCALE = ?
    `;

    const [rows] = await db.query(query, [fiscalCode]);

    if (rows.length === 0) {
      // Importante: ritorniamo 404 così il frontend sa che deve mostrare il modale "Pre-autorizza"
      return res.status(404).json({ message: "Utente non trovato" });
    }

    const user = rows[0];

    // Mappiamo i dati
    res.status(200).json({
      id: user.ID_UTENTE,
      firstName: user.NOME,
      lastName: user.COGNOME,
      fiscalCode: user.CODICE_FISCALE,
      email: user.EMAIL,
      isAdmin: Boolean(user.IS_ADMIN),
      isCitizen: Boolean(user.IS_CITTADINO),
    });
  } catch (err) {
    console.error("Errore searchUserByFiscalCode:", err);
    res.status(500).json({ message: "Errore server durante la ricerca" });
  }
};

exports.preAuthorizeAdmin = async (req, res) => {
  try {
    const requesterId = req.user.id;

    // Controllo Permessi Admin
    const [requesters] = await db.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [requesterId]
    );
    if (requesters.length === 0 || !requesters[0].IS_ADMIN) {
      return res
        .status(403)
        .json({ message: "Accesso negato: solo gli admin possono pre-autorizzare." });
    }

    // Assicuriamo che il CF sia maiuscolo anche lato server
    const fiscalCode = req.body.fiscalCode ? req.body.fiscalCode.toUpperCase() : null;

    if (!fiscalCode) {
      return res.status(400).json({ message: "Codice fiscale mancante" });
    }

    // Controllo se l'utente esiste già
    const [existingUser] = await db.query(
      "SELECT * FROM UTENTE WHERE CODICE_FISCALE = ?",
      [fiscalCode]
    );

    if (existingUser.length > 0) {
        return res.status(409).json({ message: "Utente già esistente." });
    }
    
    // Controllo se il codice fiscale è già pre-autorizzato
    const [existingPreAuth] = await db.query(
      "SELECT * FROM PRE_AUTORIZZATO WHERE CODICE_FISCALE = ?",
      [fiscalCode]
    );

    if (existingPreAuth.length > 0) {
      return res.status(409).json({ message: "Codice fiscale già pre-autorizzato." });
    }

    // Inseriamo il codice fiscale nella tabella PRE_AUTORIZZATO
    const insertQuery = `
      INSERT INTO PRE_AUTORIZZATO (CODICE_FISCALE, INSERITO_DA)
      VALUES (?, ?)
    `;

    await db.query(insertQuery, [fiscalCode, requesterId]);

    res
      .status(201)
      .json({ message: "Codice fiscale pre-autorizzato con successo" });
  } catch (err) {
    console.error("Errore preAuthorizeAdmin:", err);
    // Usiamo un controllo più granulare per l'errore di duplicazione
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: "Codice fiscale già pre-autorizzato." });
    }
    res
      .status(500)
      .json({
        message: "Errore server durante pre-autorizzazione",
        details: err.message,
      });
  }
};
