// server.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Store active sessions
const sessions = new Map();

// Clean up stale sessions every 30 seconds
setInterval(() => {
    const now = Date.now();
    let removed = 0;
    for (const [id, data] of sessions.entries()) {
        if (now - data.lastPing > 30000) { // 30 seconds timeout
            sessions.delete(id);
            removed++;
        }
    }
    if (removed > 0) {
        console.log(`🧹 Cleaned ${removed} stale sessions. Active: ${sessions.size}`);
    }
}, 30000);

// Health check endpoint
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'online',
        viewers: sessions.size,
        timestamp: Date.now()
    });
});

// Heartbeat endpoint - viewer reports they're still here
app.post('/api/viewer/heartbeat', (req, res) => {
    const { sessionId, userAgent, timestamp } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ 
            success: false, 
            error: 'sessionId required' 
        });
    }
    
    // Update or create session
    const now = Date.now();
    const existing = sessions.get(sessionId);
    
    sessions.set(sessionId, {
        lastPing: now,
        joinedAt: existing ? existing.joinedAt : now,
        userAgent: userAgent || 'unknown',
        pingCount: existing ? existing.pingCount + 1 : 1
    });
    
    // Send back the current viewer count
    res.json({ 
        success: true, 
        viewers: sessions.size,
        sessionId,
        timestamp: now
    });
});

// Leave endpoint - viewer explicitly leaves
app.post('/api/viewer/leave', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId) {
        sessions.delete(sessionId);
        console.log(`👋 Viewer ${sessionId} left. Active: ${sessions.size}`);
    }
    res.json({ 
        success: true, 
        viewers: sessions.size 
    });
});

// Get current viewer count
app.get('/api/viewers', (req, res) => {
    res.json({ 
        viewers: sessions.size,
        timestamp: Date.now()
    });
});

// Get detailed viewer info (admin only - optional)
app.get('/api/viewers/details', (req, res) => {
    const details = Array.from(sessions.entries()).map(([id, data]) => ({
        sessionId: id,
        joinedAt: new Date(data.joinedAt).toISOString(),
        lastPing: new Date(data.lastPing).toISOString(),
        userAgent: data.userAgent,
        pingCount: data.pingCount
    }));
    res.json({
        total: sessions.size,
        viewers: details
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   GET  /api/status`);
    console.log(`   GET  /api/viewers`);
    console.log(`   GET  /api/viewers/details`);
    console.log(`   POST /api/viewer/heartbeat`);
    console.log(`   POST /api/viewer/leave`);
});
