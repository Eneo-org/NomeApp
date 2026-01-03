const db = require("../config/db");
const {
  createBudgetSchema,
  voteBudgetSchema,
} = require("../validators/participatoryBudgetSchema");

// --- 1. Recupero Lista Archivio (SOLO ADMIN) ---
exports.getAllParticipatoryBudgets = async (req, res) => {
  try {
    const userId = req.header("X-Mock-User-Id");

    // A. Validazione Autenticazione
    if (!userId) {
      return res.status(401).json({
        timeStamp: new Date().toISOString(),
        message: "Autenticazione richiesta: Header X-Mock-User-Id mancante",
      });
    }

    // B. Controllo Ruolo: SOLO ADMIN
    const [users] = await db.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        timeStamp: new Date().toISOString(),
        message: "Utente non trovato",
      });
    }
    if (!users[0].IS_ADMIN) {
      return res.status(403).json({
        timeStamp: new Date().toISOString(),
        message:
          "Accesso negato: solo gli amministratori possono visualizzare l'archivio storico.",
      });
    }

    // C. Logica Paginazione e Recupero Dati
    const { currentPage = 1, objectsPerPage = 10 } = req.query;
    const page = Math.max(1, parseInt(currentPage));
    const limit = Math.max(1, parseInt(objectsPerPage));
    const offset = (page - 1) * limit;

    // Conteggio totale
    const [countRows] = await db.query(
      "SELECT COUNT(*) as total FROM BILANCIO_PARTECIPATIVO"
    );
    const totalObjects = countRows[0].total;

    // Recupero Bilanci
    const queryBudgets = `
            SELECT * FROM BILANCIO_PARTECIPATIVO 
            ORDER BY CREATED_AT DESC
            LIMIT ? OFFSET ?
        `;
    const [budgets] = await db.query(queryBudgets, [limit, offset]);

    // Recupero Opzioni e Formattazione
    let formattedData = [];
    if (budgets.length > 0) {
      const budgetIds = budgets.map((b) => b.ID_BIL);
      const queryOptions = `SELECT * FROM OPZIONI_BILANCIO WHERE ID_BIL IN (?) ORDER BY POSITION ASC`;
      const [options] = await db.query(queryOptions, [budgetIds]);

      formattedData = budgets.map((b) => {
        const budgetOptions = options.filter((o) => o.ID_BIL === b.ID_BIL);
        return {
          id: b.ID_BIL,
          creatorId: b.ID_CREATOR,
          title: b.TITOLO,
          createdAt: b.CREATED_AT,
          expirationDate: b.DATA_SCADENZA,
          options: budgetOptions.map((o) => ({
            id: o.ID_OB,
            text: o.TEXT,
            position: o.POSITION,
          })),
        };
      });
    }

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
    console.error("Errore getAllParticipatoryBudgets:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno del server",
    });
  }
};

// --- 2. Creazione Bilancio (SOLO ADMIN & NO ACTIVE DUPLICATES) ---
exports.createParticipatoryBudget = async (req, res) => {
  let connection;
  try {
    const userId = req.header("X-Mock-User-Id");
    if (!userId)
      return res.status(401).json({
        timeStamp: new Date().toISOString(),
        message: "Header X-Mock-User-Id mancante",
      });

    // Validazione Input
    const { error, value } = createBudgetSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        timeStamp: new Date().toISOString(),
        message: "Errore di validazione",
        details: error.details.map((err) => ({
          field: err.context.key,
          issue: err.message,
        })),
      });
    }
    const { title, expirationDate, options } = value;

    // Avvio Transazione
    connection = await db.getConnection();
    await connection.beginTransaction();

    // A. Controllo Ruolo Admin
    const [users] = await connection.query(
      "SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?",
      [userId]
    );
    if (users.length === 0 || !users[0].IS_ADMIN) {
      await connection.rollback();
      return res.status(403).json({
        timeStamp: new Date().toISOString(),
        message: "Solo gli admin possono creare bilanci partecipativi",
      });
    }

    // B. Controllo Unicità (Nessun altro bilancio attivo permesso)
    const checkActiveQuery = `
            SELECT ID_BIL, DATA_SCADENZA 
            FROM BILANCIO_PARTECIPATIVO 
            WHERE DATA_SCADENZA >= CURDATE()
            LIMIT 1
        `;
    const [activeBudgets] = await connection.query(checkActiveQuery);

    if (activeBudgets.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        timeStamp: new Date().toISOString(),
        message:
          "Impossibile creare un nuovo bilancio: ne esiste già uno attivo.",
        activeBudgetExpiration: activeBudgets[0].DATA_SCADENZA,
      });
    }

    // C. Inserimento Bilancio
    const insertBilancio = `
            INSERT INTO BILANCIO_PARTECIPATIVO (ID_CREATOR, TITOLO, DATA_SCADENZA)
            VALUES (?, ?, ?)
        `;
    const [resBil] = await connection.execute(insertBilancio, [
      userId,
      title,
      expirationDate,
    ]);
    const newId = resBil.insertId;

    // D. Inserimento Opzioni
    const insertOption = `INSERT INTO OPZIONI_BILANCIO (ID_BIL, TEXT, POSITION) VALUES (?, ?, ?)`;
    const optionPromises = options.map((opt) => {
      return connection.execute(insertOption, [newId, opt.text, opt.position]);
    });
    await Promise.all(optionPromises);

    await connection.commit();

    res.status(201).json({
      id: newId,
      creatorId: parseInt(userId),
      title,
      createdAt: new Date().toISOString(),
      expirationDate,
      options: options,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Errore createParticipatoryBudget:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno del server",
    });
  } finally {
    if (connection) connection.release();
  }
};

// --- 3. Recupero Bilancio Attivo (ALIAS /active) ---
exports.getActiveParticipatoryBudget = async (req, res) => {
  try {
    // Cerca il bilancio con scadenza futura o odierna
    const queryBudget = `
            SELECT * FROM BILANCIO_PARTECIPATIVO 
            WHERE DATA_SCADENZA >= CURDATE() 
            ORDER BY CREATED_AT DESC 
            LIMIT 1
        `;
    const [rows] = await db.query(queryBudget);

    if (rows.length === 0) {
      return res.status(404).json({
        timeStamp: new Date().toISOString(),
        message: "Nessun bilancio partecipativo attivo al momento",
      });
    }
    const budget = rows[0];

    const queryOptions = `
            SELECT * FROM OPZIONI_BILANCIO 
            WHERE ID_BIL = ? 
            ORDER BY POSITION ASC
        `;
    const [options] = await db.query(queryOptions, [budget.ID_BIL]);

    // Controllo se l'utente ha già votato
    let votedPosition = null;
    const userId = req.header("X-Mock-User-Id");

    if (userId) {
      const queryVote = `
                SELECT ob.POSITION
                FROM VOTI_BILANCIO vb
                JOIN OPZIONI_BILANCIO ob ON vb.OPTION_ID = ob.ID_OB
                WHERE vb.ID_BIL = ? AND vb.ID_UTENTE = ?
            `;
      const [votes] = await db.query(queryVote, [budget.ID_BIL, userId]);

      if (votes.length > 0) {
        votedPosition = votes[0].POSITION; // Es: 1, 2 o 3
      }
    }

    res.status(200).json({
      id: budget.ID_BIL,
      creatorId: budget.ID_CREATOR,
      title: budget.TITOLO,
      createdAt: budget.CREATED_AT,
      expirationDate: budget.DATA_SCADENZA,
      // questa parte restituisce la POSITION nel campo votedOptionId
      votedOptionId: votedPosition,
      options: options.map((o) => ({
        id: o.ID_OB,
        text: o.TEXT,
        position: o.POSITION,
      })),
    });
  } catch (err) {
    console.error("Errore getActiveParticipatoryBudget:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno del server",
    });
  }
};

exports.voteParticipatoryBudget = async (req, res) => {
  let connection;
  try {
    const budgetId = req.params.id;
    const userId = req.header("X-Mock-User-Id");

    if (!userId)
      return res.status(401).json({
        timeStamp: new Date().toISOString(),
        message: "Header X-Mock-User-Id mancante",
      });

    // 1. Validazione input (Position)
    const { error, value } = voteBudgetSchema.validate(req.body);
    if (error)
      return res.status(400).json({
        timeStamp: new Date().toISOString(),
        message: error.details[0].message,
      });

    // Qui abbiamo già la posizione (es. 1, 2, 3) richiesta dall'utente
    const { position } = value;

    connection = await db.getConnection();
    await connection.beginTransaction();

    // A. Controllo Ruolo Cittadino
    // - Tabella UTENTE
    const [users] = await connection.query(
      "SELECT IS_CITTADINO FROM UTENTE WHERE ID_UTENTE = ?",
      [userId]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(401).json({
        timeStamp: new Date().toISOString(),
        message: "Utente non trovato",
      });
    }
    if (!users[0].IS_CITTADINO) {
      await connection.rollback();
      return res.status(403).json({
        timeStamp: new Date().toISOString(),
        message: "Accesso negato: solo i cittadini registrati possono votare.",
      });
    }

    // B. Controllo Esistenza Bilancio
    // - Tabella BILANCIO_PARTECIPATIVO
    const [budgets] = await connection.query(
      "SELECT * FROM BILANCIO_PARTECIPATIVO WHERE ID_BIL = ?",
      [budgetId]
    );

    if (budgets.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        timeStamp: new Date().toISOString(),
        message: "Bilancio non trovato",
      });
    }
    const budgetData = budgets[0];

    // C. Controllo Scadenza
    const expirationDate = new Date(budgetData.DATA_SCADENZA);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today > expirationDate) {
      await connection.rollback();
      return res.status(403).json({
        timeStamp: new Date().toISOString(),
        message: "Votazione chiusa: il bilancio è scaduto",
      });
    }

    // D. Recupero ID Opzione reale (Serve per l'inserimento nel DB)
    // - Tabella OPZIONI_BILANCIO
    const queryFindOption = `
            SELECT ID_OB 
            FROM OPZIONI_BILANCIO 
            WHERE ID_BIL = ? AND POSITION = ?
        `;
    const [optionsResult] = await connection.query(queryFindOption, [
      budgetId,
      position,
    ]);

    if (optionsResult.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        timeStamp: new Date().toISOString(),
        message: `L'opzione numero ${position} non esiste per questo bilancio.`,
      });
    }

    const realOptionId = optionsResult[0].ID_OB;

    // E. Inserimento Voto
    // - Tabella VOTI_BILANCIO
    const insertVote = `
            INSERT INTO VOTI_BILANCIO (ID_UTENTE, ID_BIL, OPTION_ID)
            VALUES (?, ?, ?)
        `;
    await connection.execute(insertVote, [userId, budgetId, realOptionId]);

    // F. Recupero Tutte le Opzioni per la risposta
    const queryAllOptions = `
            SELECT * FROM OPZIONI_BILANCIO 
            WHERE ID_BIL = ? 
            ORDER BY POSITION ASC
        `;
    const [allOptions] = await connection.query(queryAllOptions, [budgetId]);

    // Conferma Transazione
    await connection.commit();

    // --- G. COSTRUZIONE RISPOSTA MODIFICATA ---
    const responsePayload = {
      // RESTITUISCE LA POSIZIONE (1, 2, 3...) INVECE DELL'ID DEL DB
      votedOptionId: position,

      id: budgetData.ID_BIL,
      creatorId: budgetData.ID_CREATOR,
      title: budgetData.TITOLO,
      createdAt: budgetData.CREATED_AT,
      expirationDate: budgetData.DATA_SCADENZA,
      options: allOptions.map((o) => ({
        id: o.ID_OB,
        text: o.TEXT,
        position: o.POSITION,
      })),
    };

    res.status(200).json(responsePayload);
  } catch (err) {
    if (connection) await connection.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        timeStamp: new Date().toISOString(),
        message: "Hai già votato per questo bilancio partecipativo",
      });
    }

    console.error("Errore voteParticipatoryBudget:", err);
    res.status(500).json({
      timeStamp: new Date().toISOString(),
      message: "Errore interno del server",
    });
  } finally {
    if (connection) connection.release();
  }
};
