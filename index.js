import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import propertyRoutes from './routes/property.js';
import bookingRoutes from './routes/booking.js';
import wishlistRoutes from './routes/wishlist.js';
import reviewRoutes from './routes/review.js';
import profileRoutes from './routes/profile.js';
import paymentRoutes from './routes/payment.js';
import messageRoutes from './routes/messages.js';
import settingsRoutes from './routes/settings.js';

import Message from './models/Message.js';
import Conversation from './models/Conversation.js';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175'
].filter(Boolean);

const corsOrigin = allowedOrigins.length ? allowedOrigins : true;

// Middleware
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

// MongoDB Connection
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch((err) => console.log('❌ MongoDB Error:', err.message));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/settings', settingsRoutes);

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'EasyStay API is running' });
});

// Socket.io server
const io = new Server(server, {
    cors: {
        origin: corsOrigin,
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join', (userId) => {
        if (!userId) return;
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined room user_${userId}`);
    });

    socket.on('send_message', async (data) => {
        try {
            const { conversationId, senderId, receiverId, content } = data || {};

            if (!conversationId || !senderId || !receiverId || !content) {
                socket.emit('message_error', { error: 'Missing required message fields' });
                return;
            }

            const message = await Message.create({
                conversation: conversationId,
                sender: senderId,
                receiver: receiverId,
                content
            });

            await Conversation.findByIdAndUpdate(conversationId, {
                lastMessage: content,
                lastMessageAt: new Date(),
                updatedAt: new Date(),
                $inc: { [`unreadCount.${receiverId}`]: 1 }
            });

            await message.populate('sender', 'name email avatar');

            io.to(`user_${receiverId}`).emit('new_message', message);
            socket.emit('message_sent', message);
        } catch (error) {
            console.error('Socket message error:', error);
            socket.emit('message_error', { error: error.message });
        }
    });

    socket.on('typing', (data) => {
        const { receiverId, senderId, isTyping } = data || {};
        if (!receiverId || !senderId) return;
        io.to(`user_${receiverId}`).emit('user_typing', { userId: senderId, isTyping: !!isTyping });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('🔌 Socket.io server ready');
});
