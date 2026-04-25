
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Property from '../models/property.js';

// Get or create conversation
export const getOrCreateConversation = async (req, res) => {
    try {
        const { participantId, propertyId, bookingId } = req.body;
        const userId = req.user.id;

        // Check if conversation exists
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, participantId], $size: 2 }
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [userId, participantId],
                property: propertyId,
                booking: bookingId,
                unreadCount: new Map()
            });
            await conversation.save();
        }

        // Populate participants
        await conversation.populate('participants', 'name email avatar');
        if (conversation.property) {
            await conversation.populate('property', 'title images');
        }

        res.json({
            success: true,
            conversation
        });

    } catch (error) {
        console.error('Error getting conversation:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get user's conversations
export const getUserConversations = async (req, res) => {
    try {
        const userId = req.user.id;

        const conversations = await Conversation.find({
            participants: userId
        })
            .populate('participants', 'name email avatar')
            .populate('property', 'title images')
            .sort('-lastMessageAt');

        // Get last message for each conversation
        const conversationsWithLastMessage = await Promise.all(
            conversations.map(async (conv) => {
                const lastMessage = await Message.findOne({
                    conversation: conv._id
                }).sort('-createdAt');
                
                const otherParticipant = conv.participants.find(
                    p => p._id.toString() !== userId
                );

                return {
                    ...conv.toObject(),
                    lastMessage: lastMessage?.content || 'No messages yet',
                    lastMessageAt: lastMessage?.createdAt || conv.lastMessageAt,
                    otherParticipant,
                    unreadCount: conv.unreadCount?.get(userId) || 0
                };
            })
        );

        res.json({
            success: true,
            conversations: conversationsWithLastMessage
        });

    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get messages for a conversation
export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        // Verify user is part of conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        // Mark messages as read
        await Message.updateMany(
            { conversation: conversationId, receiver: userId, read: false },
            { read: true, readAt: new Date() }
        );

        // Reset unread count for user
        const unreadCount = conversation.unreadCount || new Map();
        unreadCount.set(userId, 0);
        conversation.unreadCount = unreadCount;
        await conversation.save();

        // Get messages
        const messages = await Message.find({ conversation: conversationId })
            .populate('sender', 'name email avatar')
            .sort('createdAt');

        res.json({
            success: true,
            messages
        });

    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Send message (also used by Socket.io)
export const sendMessage = async (req, res) => {
    try {
        const { conversationId, receiverId, content } = req.body;
        const senderId = req.user.id;

        const message = new Message({
            conversation: conversationId,
            sender: senderId,
            receiver: receiverId,
            content
        });

        await message.save();

        // Update conversation
        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: content,
            lastMessageAt: new Date(),
            $inc: { [`unreadCount.${receiverId}`]: 1 }
        });

        await message.populate('sender', 'name email avatar');

        res.status(201).json({
            success: true,
            message
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Mark messages as read
export const markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        await Message.updateMany(
            { conversation: conversationId, receiver: userId, read: false },
            { read: true, readAt: new Date() }
        );

        const conversation = await Conversation.findById(conversationId);
        const unreadCount = conversation.unreadCount || new Map();
        unreadCount.set(userId, 0);
        conversation.unreadCount = unreadCount;
        await conversation.save();

        res.json({
            success: true,
            message: 'Messages marked as read'
        });

    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
