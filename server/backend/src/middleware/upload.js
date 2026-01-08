const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * CONFIGURAZIONE STORAGE
 * Definisce dove salvare i file e come rinominarli.
 * I file vengono salvati nella root del backend dentro 'uploads/...'
 */
const storage = (destinationFolder) => multer.diskStorage({
  destination: (req, file, cb) => {
    // Costruiamo il percorso ASSOLUTO per evitare problemi se il server viene avviato da cartelle diverse
    const uploadPath = path.join(__dirname, "../../uploads", destinationFolder);

    // Controllo di sicurezza: verifichiamo che la cartella esista
    if (!fs.existsSync(uploadPath)) {
      // Se non esiste, proviamo a crearla (utile in dev) o ritorniamo errore
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generiamo un nome file unico: timestamp + numero random + estensione originale
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    // Esempio risultato: attachment-1704389200000-456789.jpg
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

/**
 * FILTRI FILE
 * Funzioni per validare il tipo di file accettato
 */

// 1. Filtro Rigoroso: Solo Immagini (Per Iniziative)
const imageFilter = (req, file, cb) => {
  // Lista MIME type consentiti
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Creiamo un errore personalizzato che il controller potrà gestire
    const error = new Error("Formato non valido. Sono ammesse solo immagini (JPG, PNG, WEBP).");
    error.code = "INVALID_FILE_TYPE";
    cb(error, false);
  }
};

// 2. Filtro Ibrido: Immagini + PDF (Per Risposte Amministrazione)
const imageAndPdfFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg", 
    "image/png", 
    "image/jpg", 
    "image/webp", 
    "application/pdf"
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error("Formato non valido. Sono ammessi solo immagini e file PDF.");
    error.code = "INVALID_FILE_TYPE";
    cb(error, false);
  }
};

/**
 * ESPORTAZIONE MIDDLEWARE
 * Configuriamo i limiti di dimensione (es. 5MB per immagini, 10MB per documenti misti)
 */

exports.uploadInitiative = multer({
  storage: storage("initiatives"),
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite 5MB
    files: 5 // Massimo 5 file per upload
  }
});

exports.uploadReply = multer({
  storage: storage("replies"),
  fileFilter: imageAndPdfFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite 10MB (i PDF possono essere pesanti)
    files: 5
  }
});