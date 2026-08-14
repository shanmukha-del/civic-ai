const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
app.use('/api', apiRoutes);

// Specific Portal Navigation Routes
app.get('/portal/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/portal/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'officer.html'));
});

app.get('/portal/officer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'officer.html'));
});

// Fallback to Citizen Portal
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🏛️ CivicAI - Smart Multilingual Public Grievance System`);
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
  console.log(`📱 Citizen Portal:   http://localhost:${PORT}/`);
  console.log(`👔 Admin Portal:     http://localhost:${PORT}/portal/admin`);
  console.log(`👮 Officer Portal:   http://localhost:${PORT}/portal/login`);
  console.log(`====================================================`);
});
