const express = require('express');
const router = express.Router();
const filterController = require('../controllers/filterController');

// Definizione delle rotte come da tag "Filters" in AllAPIs.json

// GET /categories
router.get('/categories', filterController.getAllCategories);

// GET /platforms
router.get('/platforms', filterController.getAllPlatforms);

module.exports = router;