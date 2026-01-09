const cron = require("node-cron");
const db = require("./config/db");
// Importiamo il servizio di importazione (assicurati che il percorso sia giusto)
const importExternalInitiatives = require("./services/importService");

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

      // Query: Imposta STATO = 'Scaduta' per le iniziative 'In corso' che hanno superato la scadenza
      const [result] = await connection.query(`
        UPDATE INIZIATIVA 
        SET STATO = 'Scaduta' 
        WHERE STATO = 'In corso' 
        AND DATA_SCADENZA < NOW()
      `);

      if (result.affectedRows > 0) {
        console.log(
          `✅ [CRON] Manutenzione completata: ${result.affectedRows} iniziative passate a 'Scaduta'.`
        );
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
    console.log("🌍 [CRON - Daily] Avvio sincronizzazione piattaforme esterne...");
    
    try {
      // Chiamiamo il servizio che gestisce tutta la logica (connessione, check categorie, upsert)
      await importExternalInitiatives();
    } catch (error) {
      console.error("❌ [CRON] Errore critico durante l'importazione esterna:", error);
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