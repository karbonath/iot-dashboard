const express = require('express');
const app = express();
const port = 3000;

// Middleware untuk parsing JSON
app.use(express.json());
app.use(express.static('public'));

// Menyimpan data terakhir
let lastData = {
    timestamp: new Date(),
    proxState: 'LOW',
    servoPosition: 0,
    ledState: 'OFF'
};

// REST API endpoint untuk menerima data dari ESP32
app.post('/api/data', (req, res) => {
    const { proxState, servoPosition, ledState } = req.body;
    lastData = {
        timestamp: new Date().toISOString(), // Format ISO untuk timestamp yang konsisten
        proxState,
        servoPosition,
        ledState
    };
    console.log('Data received at:', new Date().toLocaleString(), lastData);
    res.json({ status: 'success', timestamp: lastData.timestamp });
});

// Endpoint untuk mendapatkan data terakhir
app.get('/api/data', (req, res) => {
    res.json(lastData);
});

// Endpoint testing sederhana
app.get('/test', (req, res) => {
    res.json({ message: 'Hello World' });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
    console.log('Access from other devices using your IP address');
});