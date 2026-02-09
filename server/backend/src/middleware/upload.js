const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// 1. Configura Cloudinary con le variabili d'ambiente
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Configura lo Storage per le Iniziative
const initiativeStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "trento-partecipa/initiatives", // Cartella su Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "webp"], // Niente PDF qui
  },
});

// 3. Configura lo Storage per le Risposte (accetta anche PDF)
// Nota: Cloudinary gestisce i PDF come "image" o "raw" a seconda dei casi,
// ma per semplicità qui usiamo resource_type: 'auto'
const replyStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "trento-partecipa/replies",
      resource_type: "auto", // Importante per accettare sia PDF che immagini
      allowed_formats: ["jpg", "png", "jpeg", "webp", "pdf"],
    };
  },
});

// 4. Esportazione Middleware (con gli stessi limiti di prima)
exports.uploadInitiative = multer({
  storage: initiativeStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

exports.uploadReply = multer({
  storage: replyStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
