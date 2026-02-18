const cron = require("node-cron");
const db = require("./config/db");
// Importiamo il servizio di importazione (assicurati che il percorso sia giusto)
const importExternalInitiatives = require("./services/importService");
const { sendNotificationEmailsBatch } = require("./services/emailService");

const notifyFollowers = async (
  connection,
  initiativeId,
  message,
  link,
  options = {},
) => {
  const queryFollowers = `
    SELECT s.ID_UTENTE, u.EMAIL
    FROM INIZIATIVA_SALVATA s
    JOIN UTENTE u ON u.ID_UTENTE = s.ID_UTENTE
    WHERE s.ID_INIZIATIVA = ?
  `;
  const [followers] = await connection.query(queryFollowers, [initiativeId]);

  if (followers.length === 0) return;

  const queryInsert =
    "INSERT INTO NOTIFICA (ID_UTENTE, TESTO, LINK_RIF, LETTA) VALUES ?";
  const values = followers.map((f) => [f.ID_UTENTE, message, link, 0]);

  await connection.query(queryInsert, [values]);

  const emails = followers.map((f) => f.EMAIL).filter(Boolean);
  await sendNotificationEmailsBatch(emails, {
    subject: options.subject || "Iniziativa scaduta",
    title: options.title || "⏰ Iniziativa Scaduta",
    message: options.emailMessage || message,
    link,
    ctaText: options.ctaText || "Vedi dettagli",
    initiativeTitle: options.initiativeTitle,
    status: options.status,
    signatures: options.signatures,
    extraInfo: options.extraInfo,
  });
};

const startScheduler = () => {
  console.log("⏰ Sistema di monitoraggio attivato (Cron Jobs).");

  // =================================================================
  // JOB 1: MANUTENZIONE INTERNA (Esecuzione ogni ora al minuto 0)
  // Scopo: Chiudere le iniziative la cui data di scadenza è passata
  // =================================================================
  cron.schedule("0 * * * *", async () => {
    console.log("⏳ [CRON - Hourly] Avvio controllo scadenze...");
    let connection;

    try {
      connection = await db.getConnection();

      // Selezioniamo le iniziative che stanno per essere marcate come scadute
      const [expiredInitiatives] = await connection.query(`
        SELECT ID_INIZIATIVA, TITOLO, NUM_FIRME
        FROM INIZIATIVA
        WHERE STATO = 'In corso'
        AND DATA_SCADENZA < NOW()
      `);

      // Query: Imposta STATO = 'Scaduta' per le iniziative 'In corso' che hanno superato la scadenza
      const [result] = await connection.query(`
        UPDATE INIZIATIVA 
        SET STATO = 'Scaduta' 
        WHERE STATO = 'In corso' 
        AND DATA_SCADENZA < NOW()
      `);

      if (result.affectedRows > 0) {
        console.log(
          `✅ [CRON] Manutenzione completata: ${result.affectedRows} iniziative passate a 'Scaduta'.`,
        );

        for (const initiative of expiredInitiatives) {
          const message = `L'iniziativa "${initiative.TITOLO}" e' scaduta.`;
          const link = `/initiative/${initiative.ID_INIZIATIVA}`;
          await notifyFollowers(
            connection,
            initiative.ID_INIZIATIVA,
            message,
            link,
            {
              subject: `⏰ Iniziativa scaduta: ${initiative.TITOLO}`,
              title: "⏰ Iniziativa Scaduta",
              emailMessage: `Il periodo di raccolta firme per questa iniziativa si è concluso.`,
              ctaText: "Vedi risultati",
              initiativeTitle: initiative.TITOLO,
              status: "Scaduta",
              signatures: initiative.NUM_FIRME || 0,
              extraInfo: `Firme raccolte nel periodo: ${initiative.NUM_FIRME || 0}`,
            },
          );
        }
      }
      // else { console.log("👌 Nessuna iniziativa scaduta trovata."); }
    } catch (error) {
      console.error("❌ [CRON] Errore nel controllo scadenze:", error);
    } finally {
      if (connection) connection.release();
    }
  });

  // =================================================================
  // JOB 2: IMPORTAZIONE ESTERNA (Esecuzione ogni giorno alle 03:00)
  // Scopo: Leggere il mock file e importare/aggiornare le iniziative
  // =================================================================
  cron.schedule("0 3 * * *", async () => {
    console.log(
      "🌍 [CRON - Daily] Avvio sincronizzazione piattaforme esterne...",
    );

    try {
      // Chiamiamo il servizio che gestisce tutta la logica (connessione, check categorie, upsert)
      await importExternalInitiatives();
    } catch (error) {
      console.error(
        "❌ [CRON] Errore critico durante l'importazione esterna:",
        error,
      );
    }
  });

  // --- (OPZIONALE) DEBUG ---
  // commenta le righe sotto se vuoi non forzare l'importazione 5 secondi dopo l'avvio del server
  setTimeout(() => {
    console.log("🧪 [TEST] Lancio immediato importazione per debug...");
    importExternalInitiatives();
  }, 5000);
};

module.exports = startScheduler;
