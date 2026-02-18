const fs = require("fs");
const path = require("path");
const db = require("../config/db");

// Mappatura stati esterni -> Tuoi ENUM interni
const STATUS_MAP = {
  open: "In corso",
  active: "In corso",
  closed: "Scaduta",
  won: "Approvata",
  rejected: "Respinta",
};

const importExternalInitiatives = async () => {
  console.log("📥 [IMPORT] Avvio procedura importazione dati esterni...");
  const filePath = path.join(__dirname, "../../data/external_source.json");
  let connection;

  try {
    // 1. Leggi il file Mock
    if (!fs.existsSync(filePath)) {
      console.error("⚠️ File dati non trovato:", filePath);
      return;
    }
    const rawData = fs.readFileSync(filePath, "utf-8");
    const initiatives = JSON.parse(rawData);

    connection = await db.getConnection();

    // 2. Carica in memoria Piattaforme e Categorie esistenti
    const [platforms] = await connection.query(
      "SELECT ID_PIATTAFORMA, NOME_PIATTAFORMA FROM PIATTAFORMA",
    );

    // Nota: `categories` è un array che aggiorneremo dinamicamente durante il ciclo
    const [categories] = await connection.query(
      "SELECT ID_CATEGORIA, NOME FROM CATEGORIA",
    );

    let newCount = 0;
    let updateCount = 0;
    let newCategoriesCount = 0;

    for (const item of initiatives) {
      // A. Gestione Piattaforma
      const platform = platforms.find(
        (p) =>
          p.NOME_PIATTAFORMA.toLowerCase() === item.platform_name.toLowerCase(),
      );
      const platformId = platform ? platform.ID_PIATTAFORMA : null;

      // --- B. GESTIONE DINAMICA CATEGORIE (MODIFICA RICHIESTA) ---
      const externalCatName = item.category_name && item.category_name.trim(); // Pulisce spazi
      let categoryId;

      if (!externalCatName) {
        // Se il JSON non ha categoria, usa ID 1 (Ambiente) o gestisci come preferisci
        categoryId = 1;
      } else {
        // Cerchiamo la categoria nell'array (Case Insensitive)
        let category = categories.find(
          (c) => c.NOME.toLowerCase() === externalCatName.toLowerCase(),
        );

        if (category) {
          // 1. Categoria Trovata
          categoryId = category.ID_CATEGORIA;
        } else {
          // 2. Categoria NON Trovata -> CREAZIONE
          console.log(
            `✨ Nuova categoria rilevata: "${externalCatName}". Creazione in corso...`,
          );

          const [resCat] = await connection.query(
            "INSERT INTO CATEGORIA (NOME) VALUES (?)",
            [externalCatName],
          );

          categoryId = resCat.insertId;
          newCategoriesCount++;

          // AGGIORNAMENTO CACHE LOCALE
          // Fondamentale per non ri-crearla al prossimo giro del loop
          categories.push({
            ID_CATEGORIA: categoryId,
            NOME: externalCatName,
          });
        }
      }
      // -----------------------------------------------------------

      // C. Mappa lo stato
      let internalStatus = STATUS_MAP[item.status] || "Archiviata";

      // C.1 Se la data di scadenza è passata e lo stato esterno risulta ancora
      //     "In corso", forziamo lo stato a "Scaduta" per evitare inconsistenze
      if (internalStatus === "In corso" && item.closing_date) {
        const closingDate = new Date(item.closing_date);
        if (closingDate < new Date()) {
          internalStatus = "Scaduta";
          console.log(
            `⏰ [IMPORT] Iniziativa "${item.title}" ha data di scadenza passata (${item.closing_date}), stato forzato a 'Scaduta'.`,
          );
        }
      }

      // D. Check Esistenza Iniziativa
      const [existing] = await connection.query(
        "SELECT ID_INIZIATIVA FROM INIZIATIVA WHERE URL_ESTERNO = ?",
        [item.url],
      );

      if (existing.length > 0) {
        // UPDATE
        await connection.query(
          `UPDATE INIZIATIVA 
                     SET NUM_FIRME = ?, STATO = ?, ID_CATEGORIA = ?
                     WHERE ID_INIZIATIVA = ?`,
          [
            item.signatures,
            internalStatus,
            categoryId,
            existing[0].ID_INIZIATIVA,
          ],
        );
        updateCount++;
      } else {
        // INSERT
        await connection.query(
          `INSERT INTO INIZIATIVA 
                    (TITOLO, DESCRIZIONE, LUOGO, STATO, NUM_FIRME, DATA_CREAZIONE, DATA_SCADENZA, ID_CATEGORIA, ID_PIATTAFORMA, URL_ESTERNO)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.title,
            item.description,
            item.location,
            internalStatus,
            item.signatures,
            new Date(item.created_at),
            new Date(item.closing_date),
            categoryId, // Usiamo l'ID appena trovato o creato
            platformId,
            item.url,
          ],
        );
        newCount++;
      }
    }

    console.log(`✅ [IMPORT] Terminato.`);
    console.log(`   - Nuove Iniziative: ${newCount}`);
    console.log(`   - Aggiornate: ${updateCount}`);
    console.log(`   - Nuove Categorie create: ${newCategoriesCount}`);
  } catch (error) {
    console.error("❌ [IMPORT] Errore critico:", error);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = importExternalInitiatives;
