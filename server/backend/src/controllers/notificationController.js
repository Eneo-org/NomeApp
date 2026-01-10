const db = require("../config/db");

// 1. Ottieni tutte le notifiche di un utente
exports.getUserNotifications = async (req, res) => {
  const userId = req.user.id; // Preso dal middleware di autenticazione

  try {
    const query = `
      SELECT * FROM NOTIFICA 
      WHERE ID_UTENTE = ? 
      ORDER BY DATA_CREAZIONE DESC 
      LIMIT 50
    `;
    const [notifications] = await db.query(query, [userId]);

    // Mappiamo i dati per il frontend (camelCase)
    const formattedNotifications = notifications.map((n) => ({
      id: n.ID_NOTIFICA,
      userId: n.ID_UTENTE,
      text: n.TESTO,
      link: n.LINK_RIF,
      isRead: Boolean(n.LETTA),
      creationDate: n.DATA_CREAZIONE,
    }));

    res.status(200).json(formattedNotifications);
  } catch (error) {
    console.error("Errore recupero notifiche:", error);
    res.status(500).json({ message: "Errore server" });
  }
};

// 2. Segna una notifica come letta
exports.markAsRead = async (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user.id;

  try {
    // Aggiorniamo solo se la notifica appartiene all'utente (sicurezza)
    const query = `UPDATE NOTIFICA SET LETTA = 1 WHERE ID_NOTIFICA = ? AND ID_UTENTE = ?`;
    await db.query(query, [notificationId, userId]);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Errore aggiornamento notifica:", error);
    res.status(500).json({ message: "Errore server" });
  }
};

// 3. Segna TUTTE le notifiche come lette (Opzionale ma comodo)
exports.markAllAsRead = async (req, res) => {
  const userId = req.user.id;
  try {
    const query = `UPDATE NOTIFICA SET LETTA = 1 WHERE ID_UTENTE = ?`;
    await db.query(query, [userId]);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Errore server" });
  }
};
