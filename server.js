const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Middleware
app.use(cors({origin: true}));
app.use(express.json());
app.use(express.static('public'));

// Database file path
const DB_FILE = path.join(__dirname, 'restaurant_data.json');

// Konfigurasi Restaurant
const RESTAURANT_CONFIG = {
    maxCapacity: 100, // Kapasitas maksimal restaurant
    name: 'Restaurant Dashboard',
    alertThreshold: 80 // Alert ketika 80% penuh
};

// Initialize database
function initDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            config: RESTAURANT_CONFIG,
            currentVisitors: 0,
            history: [],
            dailyStats: {}
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
}

// Read database
function readDatabase() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return null;
    }
}

// Write database
function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

// Update daily statistics
function updateDailyStats(db, timestamp, visitors) {
    const date = new Date(timestamp).toISOString().split('T')[0];
    
    if (!db.dailyStats[date]) {
        db.dailyStats[date] = {
            date: date,
            totalVisits: 0,
            peakVisitors: 0,
            hourlyData: {}
        };
    }
    
    const hour = new Date(timestamp).getHours();
    if (!db.dailyStats[date].hourlyData[hour]) {
        db.dailyStats[date].hourlyData[hour] = {
            hour: hour,
            visits: 0,
            avgVisitors: 0
        };
    }
    
    db.dailyStats[date].totalVisits++;
    db.dailyStats[date].peakVisitors = Math.max(db.dailyStats[date].peakVisitors, visitors);
    db.dailyStats[date].hourlyData[hour].visits++;
    db.dailyStats[date].hourlyData[hour].avgVisitors = 
        Math.round((db.dailyStats[date].hourlyData[hour].avgVisitors * (db.dailyStats[date].hourlyData[hour].visits - 1) + visitors) 
        / db.dailyStats[date].hourlyData[hour].visits);
}

// Initialize database on startup
initDatabase();

// API Endpoints

// Get current status
app.get('/api/status', (req, res) => {
    const db = readDatabase();
    if (!db) {
        return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
        currentVisitors: db.currentVisitors,
        maxCapacity: db.config.maxCapacity,
        occupancyRate: Math.round((db.currentVisitors / db.config.maxCapacity) * 100),
        availableSeats: db.config.maxCapacity - db.currentVisitors,
        isNearCapacity: db.currentVisitors >= (db.config.maxCapacity * db.config.alertThreshold / 100),
        restaurantName: db.config.name,
        lastUpdate: new Date().toISOString()
    });
});

// Update visitor count (from sensor)
app.post('/api/visitors/update', (req, res) => {
    const { action, count } = req.body; // action: 'enter' or 'exit', count: number of people
    
    const db = readDatabase();
    if (!db) {
        return res.status(500).json({ error: 'Database error' });
    }
    
    let change = 0;
    if (action === 'enter') {
        change = count || 1;
    } else if (action === 'exit') {
        change = -(count || 1);
    }
    
    db.currentVisitors = Math.max(0, Math.min(db.currentVisitors + change, db.config.maxCapacity));
    
    const timestamp = new Date().toISOString();
    
    // Add to history
    db.history.push({
        timestamp: timestamp,
        action: action,
        count: Math.abs(change),
        currentVisitors: db.currentVisitors
    });
    
    // Keep only last 1000 records
    if (db.history.length > 1000) {
        db.history = db.history.slice(-1000);
    }
    
    // Update daily stats
    updateDailyStats(db, timestamp, db.currentVisitors);
    
    writeDatabase(db);
    
    res.json({
        success: true,
        currentVisitors: db.currentVisitors,
        timestamp: timestamp
    });
});

// Get history for charts
app.get('/api/history', (req, res) => {
    const db = readDatabase();
    if (!db) {
        return res.status(500).json({ error: 'Database error' });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    const history = db.history.slice(-limit);
    
    res.json({
        history: history,
        total: db.history.length
    });
});

// Check if restaurant has available capacity
app.get('/api/capacity/check', (req, res) => {
    const db = readDatabase();
    if (!db) {
        return res.status(500).json(false);
    }
    
    const hasAvailableCapacity = db.currentVisitors < db.config.maxCapacity;
    res.json(hasAvailableCapacity);
});

// Get daily statistics
app.get('/api/stats/daily', (req, res) => {
    const db = readDatabase();
    if (!db) {
        return res.status(500).json({ error: 'Database error' });
    }
    
    const days = parseInt(req.query.days) || 7;
    const allDates = Object.keys(db.dailyStats).sort().slice(-days);
    
    const stats = allDates.map(date => ({
        date: date,
        ...db.dailyStats[date]
    }));
    
    res.json({ stats: stats });
});

// Get hourly statistics for today
app.get('/api/stats/hourly', (req, res) => {
    const db = readDatabase();
    if (!db) {
        return res.status(500).json({ error: 'Database error' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const todayStats = db.dailyStats[today];
    
    if (!todayStats) {
        return res.json({ hourlyData: [] });
    }
    
    const hourlyArray = [];
    for (let i = 0; i < 24; i++) {
        if (todayStats.hourlyData[i]) {
            hourlyArray.push(todayStats.hourlyData[i]);
        } else {
            hourlyArray.push({
                hour: i,
                visits: 0,
                avgVisitors: 0
            });
        }
    }
    
    res.json({ hourlyData: hourlyArray });
});

// Manual set visitors (for testing/adjustment)
app.post('/api/visitors/set', (req, res) => {
    const { count } = req.body;
    
    if (count === undefined || count < 0 || count > RESTAURANT_CONFIG.maxCapacity) {
        return res.status(400).json({ error: 'Invalid count' });
    }
    
    const db = readDatabase();
    if (!db) {
        return res.status(500).json({ error: 'Database error' });
    }
    
    db.currentVisitors = count;
    
    const timestamp = new Date().toISOString();
    db.history.push({
        timestamp: timestamp,
        action: 'manual_set',
        count: count,
        currentVisitors: count
    });
    
    updateDailyStats(db, timestamp, count);
    writeDatabase(db);
    
    res.json({
        success: true,
        currentVisitors: db.currentVisitors
    });
});

// Update restaurant configuration
app.post('/api/config', (req, res) => {
    const { maxCapacity, name, alertThreshold } = req.body;
    
    const db = readDatabase();
    if (!db) {
        return res.status(500).json({ error: 'Database error' });
    }
    
    if (maxCapacity) db.config.maxCapacity = maxCapacity;
    if (name) db.config.name = name;
    if (alertThreshold) db.config.alertThreshold = alertThreshold;
    
    writeDatabase(db);
    
    res.json({
        success: true,
        config: db.config
    });
});

// Reset visitors (untuk awal hari)
app.post('/api/visitors/reset', (req, res) => {
    const db = readDatabase();
    if (!db) {
        return res.status(500).json({ error: 'Database error' });
    }
    
    db.currentVisitors = 0;
    
    const timestamp = new Date().toISOString();
    db.history.push({
        timestamp: timestamp,
        action: 'reset',
        count: 0,
        currentVisitors: 0
    });
    
    writeDatabase(db);
    
    res.json({
        success: true,
        message: 'Visitor count reset to 0'
    });
});

// Testing endpoint (simulates visitors)
app.post('/api/test/simulate', (req, res) => {
    const db = readDatabase();
    if (!db) {
        return res.status(500).json({ error: 'Database error' });
    }
    
    // Simulate random visitor activity
    const actions = ['enter', 'enter', 'enter', 'exit']; // More entries than exits
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    const randomCount = Math.floor(Math.random() * 3) + 1; // 1-3 people
    
    let change = 0;
    if (randomAction === 'enter') {
        change = randomCount;
    } else {
        change = -randomCount;
    }
    
    db.currentVisitors = Math.max(0, Math.min(db.currentVisitors + change, db.config.maxCapacity));
    
    const timestamp = new Date().toISOString();
    db.history.push({
        timestamp: timestamp,
        action: randomAction,
        count: Math.abs(change),
        currentVisitors: db.currentVisitors
    });
    
    updateDailyStats(db, timestamp, db.currentVisitors);
    writeDatabase(db);
    
    res.json({
        success: true,
        action: randomAction,
        count: randomCount,
        currentVisitors: db.currentVisitors
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`\n🍽️  Restaurant Dashboard Server`);
    console.log(`==============================`);
    console.log(`✅ Server running at http://localhost:${port}`);
    console.log(`✅ Access from network: http://0.0.0.0:${port}`);
    console.log(`📊 Dashboard: http://localhost:${port}`);
    console.log(`💾 Database: ${DB_FILE}`);
    console.log(`🔧 Max Capacity: ${RESTAURANT_CONFIG.maxCapacity}`);
    console.log(`==============================\n`);
});