import express from 'express';
import {
    getOrCreateConversation,
    getUserConversations,
    getMessages,
    sendMessage,
    markAsRead
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth_middleware.js';

const router = express.Router();

router.use(protect);

router.post('/conversations', getOrCreateConversation);
router.get('/conversations', getUserConversations);
router.get('/:conversationId', getMessages);
router.post('/send', sendMessage);
router.put('/:conversationId/read', markAsRead);

export default router;