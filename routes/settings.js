import express from 'express';
import {
    getSettings,
    updateProfileSettings,
    updateNotificationSettings,
    updatePrivacySettings,
    updatePreferences,
    deleteAccount,
    getAccountActivity
} from '../controllers/settingsController.js';
import { protect } from '../middleware/auth_middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getSettings);
router.get('/activity', getAccountActivity);
router.put('/profile', updateProfileSettings);
router.put('/notifications', updateNotificationSettings);
router.put('/privacy', updatePrivacySettings);
router.put('/preferences', updatePreferences);
router.delete('/account', deleteAccount);

export default router;
