const cron = require("node-cron");
const db = require("./config/db"); // Assicurati che il percorso al tuo db sia corretto

const startScheduler = () => {
  console.log("⏰ Sistema di monitoraggio scadenze attivato.");

  // --- CONFIGURAZIONE ---
  // "0 * * * *" significa: Esegui al minuto 0 di ogni ora (es. 10:00, 11:00, 12:00...)
  // Se vuoi testarlo subito metti "* * * * *" (ogni minuto)
  cron.schedule("0 * * * *", async () => {
    console.log("⏳ Esecuzione controllo automatico scadenze...");
    const connection = await db.getConnection();

    try {
      // 1. Trova e aggiorna le iniziative "In corso" che hanno superato la data di scadenza
      // Nota: CURDATE() o NOW() dipende dal tuo DB, usiamo NOW() per essere precisi
      const [result] = await connection.query(`
        UPDATE INIZIATIVA 
        SET STATO = 'Scaduta' 
        WHERE STATO = 'In corso' 
        AND DATA_SCADENZA < NOW()
      `);

      if (result.affectedRows > 0) {
        console.log(
          `✅ Aggiornate automaticamente ${result.affectedRows} iniziative scadute.`
        );
      } else {
        console.log("👌 Nessuna iniziativa scaduta trovata.");
      }
    } catch (error) {
      console.error("❌ Errore durante il cron job:", error);
    } finally {
      connection.release();
    }
  });
};

module.exports = startScheduler;
