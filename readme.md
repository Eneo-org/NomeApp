# 🛠️ Guida Installazione e Avvio Backend

Segui questi passaggi **in ordine** per avviare il backend correttamente.

---

## 1. Preparazione Database (Obbligatorio)

Il server deve connettersi a un database MySQL locale. Se non fai questo passaggio, il server si chiuderà subito con un errore.

1. Apri il tuo client MySQL (Workbench, DBeaver, PHPMyAdmin).
2. Crea un **nuovo schema** (database) vuoto (chiamndolo per esempio `NomeAPP`).
3. Importa ed esegui il file ``/server/DatabaseRelazionale/creazioneBD.sql`` presente nella cartella del progetto.

> ⚠️ **Nota:** Questo script crea tutte le tabelle (`UTENTE`, `BILANCIO_PARTECIPATIVO`, ecc.) ma **non crea il database stesso**. Assicurati di aver selezionato il tuo schema prima di eseguire lo script.

---

## 2. Configurazione Credenziali

Dobbiamo dire al codice come accedere al *tuo* database locale.

1. Apri il file `/src/config/db.js`.
2. Cerca la sezione dove viene definita la connessione al database.
3. Modifica i campi con i **tuoi** dati locali:

```javascript
// Esempio di cosa cercare in config/db.js
{
    host: 'localhost',
    user: 'root',      // <-- Il tuo utente MySQL (spesso è root)
    password: '...',   // <-- INSERISCI QUI LA TUA PASSWORD DI MYSQL LOCALE
    database: '...'    // <-- IL NOME DELLO SCHEMA CREATO AL PUNTO 1
}
```

> ⚠️ **ATTENZIONE PER IL GRUPPO:** Dato che `config/db.js` è un file condiviso su Git, **fate attenzione a non committare la vostra password locale** se non strettamente necessario. Rischiate di sovrascrivere la configurazione degli altri.

---

## 3. Installazione Dipendenze

Anche se la cartella `node_modules` è presente, è fondamentale assicurarsi che le librerie siano installate correttamente per il tuo sistema operativo.

Apri il terminale nella cartella del progetto ed esegui:

```bash
npm install
```

---

## 4. Avvio del Server

Una volta configurato il DB e installati i pacchetti, nella cartella del progetto eseguite

```bash
node server/backend/src/app.js
```

Se è tutto corretto dovrebbe apparirvi la scritta 

```bash
Server attivo sulla porta 3000...
```

