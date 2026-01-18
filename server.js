const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Store viewer counts
const viewerCounts = new Map();
const connections = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    const clientId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log(`🟢 New connection: ${clientId}`);
    
    ws.clientId = clientId;
    ws.currentChannel = null;
    
    connections.set(clientId, {
        ws: ws,
        connectedAt: Date.now(),
        currentChannel: null
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        clientId: clientId,
        message: 'Connected to RUBIS TV Live Viewer Server'
    }));
    
    // Handle messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'subscribe') {
                const channelId = data.channelId || 'default';
                
                // Remove from old channel
                if (ws.currentChannel) {
                    const oldCount = viewerCounts.get(ws.currentChannel) || 0;
                    viewerCounts.set(ws.currentChannel, Math.max(0, oldCount - 1));
                    broadcastViewerCount(ws.currentChannel);
                }
                
                // Add to new channel
                ws.currentChannel = channelId;
                connections.get(clientId).currentChannel = channelId;
                
                const currentCount = viewerCounts.get(channelId) || 0;
                viewerCounts.set(channelId, currentCount + 1);
                
                console.log(`👥 ${clientId} subscribed to ${channelId} (${viewerCounts.get(channelId)} viewers)`);
                
                // Send confirmation
                ws.send(JSON.stringify({
                    type: 'subscribed',
                    channelId: channelId,
                    viewers: viewerCounts.get(channelId)
                }));
                
                // Broadcast to all
                broadcastViewerCount(channelId);
            }
            else if (data.type === 'ping') {
                ws.send(JSON.stringify({
                    type: 'pong',
                    timestamp: Date.now()
                }));
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });
    
    // Handle disconnection
    ws.on('close', () => {
        console.log(`🔴 Connection closed: ${clientId}`);
        
        // Remove from current channel
        if (ws.currentChannel) {
            const currentCount = viewerCounts.get(ws.currentChannel) || 1;
            viewerCounts.set(ws.currentChannel, Math.max(0, currentCount - 1));
            broadcastViewerCount(ws.currentChannel);
        }
        
        connections.delete(clientId);
    });
    
    // Send current stats
    ws.send(JSON.stringify({
        type: 'stats',
        totalConnections: connections.size,
        totalViewers: Array.from(viewerCounts.values()).reduce((a, b) => a + b, 0),
        timestamp: Date.now()
    }));
});

// Broadcast viewer count to all clients
function broadcastViewerCount(channelId) {
    const count = viewerCounts.get(channelId) || 0;
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.currentChannel === channelId) {
            client.send(JSON.stringify({
                type: 'channel_viewers',
                channelId: channelId,
                count: count,
                timestamp: Date.now()
            }));
        }
    });
}

// API endpoints
app.get('/api/stats', (req, res) => {
    res.json({
        status: 'online',
        server: 'RUBIS TV Viewer Tracker',
        version: '1.0.0',
        totalConnections: connections.size,
        totalViewers: Array.from(viewerCounts.values()).reduce((a, b) => a + b, 0),
        channels: Array.from(viewerCounts.entries()).map(([channel, viewers]) => ({
            channel: channel,
            viewers: viewers
        })),
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: Date.now() });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 RUBIS TV Viewer Server running on port ${PORT}`);
    console.log(`📡 WebSocket: ws://localhost:${PORT}`);
    console.log(`📊 Stats API: http://localhost:${PORT}/api/stats`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
});