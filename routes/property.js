import express from 'express';
import {
    getProperties,
    getHostProperties,
    getHostStats,
    getProperty,
    createProperty,
    updateProperty,
    deleteProperty,
    checkAvailability,
    getPropertyCalendar
} from '../controllers/propertyController.js';
import { protect } from '../middleware/auth_middleware.js';

const router = express.Router();

// Public routes
router.get('/', getProperties);
router.get('/host/properties', protect, getHostProperties);
router.get('/host/stats', protect, getHostStats);
router.get('/:id', getProperty);
router.get('/:id/check-availability', checkAvailability);
router.get('/:id/calendar', getPropertyCalendar);

// Protected routes
router.post('/', protect, createProperty);
router.put('/:id', protect, updateProperty);
router.delete('/:id', protect, deleteProperty);

export default router;
