import Booking from '../models/Booking.js';
import Property from '../models/property.js';
import User from '../models/user_model.js';
import {
    sendBookingConfirmationEmail,
    sendHostNotificationEmail,
    sendBookingCancellationEmail
} from '../services/emailService.js';

// Create new booking
export const createBooking = async (req, res) => {
    try {
        const { propertyId, checkIn, checkOut, guests, specialRequests } = req.body;
        const userId = req.user.id;

        console.log('Creating booking for user:', userId);
        console.log('Property:', propertyId);
        console.log('Dates:', checkIn, checkOut);

        // Validate property exists
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        // Calculate nights and total price
        const startDate = new Date(checkIn);
        const endDate = new Date(checkOut);
        const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const totalPrice = property.price * nights;

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || nights <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid check-in or check-out dates'
            });
        }

        if (property.maxGuests && guests > property.maxGuests) {
            return res.status(400).json({
                success: false,
                message: `This property allows a maximum of ${property.maxGuests} guests`
            });
        }

        if (!property.isDateAvailable(startDate, endDate)) {
            return res.status(400).json({
                success: false,
                message: 'Selected dates are not available'
            });
        }

        // Create booking
        const booking = new Booking({
            property: propertyId,
            user: userId,
            checkIn: startDate,
            checkOut: endDate,
            guests,
            totalPrice,
            specialRequests,
            status: 'confirmed',
            paymentStatus: 'pending',
            bookingDate: new Date()
        });

        await booking.save();
        await property.blockDates(startDate, endDate, booking._id);

        await booking.populate('property', 'title images location price bedrooms bathrooms host');
        await booking.populate('user', 'name email');

        await sendBookingConfirmationEmail(booking, booking.property, booking.user);

        if (booking.property.host) {
            const host = await User.findById(booking.property.host).select('name email');

            if (host?.email) {
                await sendHostNotificationEmail(booking, booking.property, booking.user, host);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Booking created successfully! A confirmation email has been sent.',
            bookingId: booking._id,
            totalPrice
        });

    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get user's bookings
export const getUserBookings = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const bookings = await Booking.find({ user: userId })
            .populate('property', 'title images location price rating')
            .sort('-createdAt');
        
        // Categorize bookings
        const now = new Date();
        const upcoming = bookings.filter(b => 
            b.status === 'confirmed' && new Date(b.checkIn) > now
        );
        const current = bookings.filter(b => 
            b.status === 'confirmed' && new Date(b.checkIn) <= now && new Date(b.checkOut) >= now
        );
        const past = bookings.filter(b => 
            b.status === 'confirmed' && new Date(b.checkOut) < now
        );
        const cancelled = bookings.filter(b => b.status === 'cancelled');
        
        res.json({
            success: true,
            bookings,
            categories: {
                upcoming,
                current,
                past,
                cancelled,
                counts: {
                    upcoming: upcoming.length,
                    current: current.length,
                    past: past.length,
                    cancelled: cancelled.length,
                    total: bookings.length
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get single booking details
export const getBookingDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        const booking = await Booking.findById(id)
            .populate('property', 'title images location price amenities host')
            .populate('user', 'name email phone');
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Check authorization
        if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        res.json({
            success: true,
            booking
        });
        
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Cancel booking
export const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        
        const booking = await Booking.findById(id)
            .populate('property', 'title images location')
            .populate('user', 'name email');
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Check authorization
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        
        // Check if cancellation is allowed (at least 2 days before check-in)
        const checkInDate = new Date(booking.checkIn);
        const today = new Date();
        const daysUntilCheckIn = Math.ceil((checkInDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilCheckIn < 2) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel booking less than 2 days before check-in'
            });
        }
        
        booking.status = 'cancelled';
        await booking.save();

        const property = await Property.findById(booking.property._id || booking.property);
        if (property) {
            await property.unblockDates(booking.checkIn, booking.checkOut, booking._id);
        }

        await sendBookingCancellationEmail(booking, booking.property, booking.user);
        
        res.json({
            success: true,
            message: 'Booking cancelled successfully. A confirmation email has been sent.',
            booking
        });
        
    } catch (error) {
        console.error('Cancellation error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Confirm payment + finalize booking (pending -> confirmed)
export const confirmBookingPayment = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check authorization
        if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot pay for a cancelled booking'
            });
        }

        // Mark as paid + confirmed
        booking.paymentStatus = 'paid';
        booking.status = 'confirmed';
        await booking.save();

        // Block dates for the property
        const property = await Property.findById(booking.property);
        if (property) {
            await property.blockDates(booking.checkIn, booking.checkOut, booking._id);
        }

        return res.json({
            success: true,
            message: 'Payment confirmed. Booking is now confirmed.',
            bookingId: booking._id
        });

    } catch (error) {
        console.error('Confirm payment error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update payment info and/or confirm booking (supports cash/upi flows)
export const updateBookingPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMethod, paymentStatus, status, paymentReference } = req.body || {};

        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check authorization
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Booking is cancelled'
            });
        }

        if (paymentMethod) booking.paymentMethod = paymentMethod;
        if (paymentReference) booking.paymentReference = String(paymentReference).trim();

        // If client sends paymentStatus, trust it (for now). Otherwise infer from method.
        if (paymentStatus) {
            booking.paymentStatus = paymentStatus;
        } else if (paymentMethod === 'upi' || paymentMethod === 'card') {
            booking.paymentStatus = 'paid';
        } else if (paymentMethod === 'cash') {
            booking.paymentStatus = booking.paymentStatus || 'pending';
        }

        // For UPI, require a reference when marking paid.
        if (booking.paymentMethod === 'upi' && booking.paymentStatus === 'paid' && !booking.paymentReference) {
            return res.status(400).json({
                success: false,
                message: 'UPI transaction reference (UTR) is required'
            });
        }

        if (booking.paymentStatus === 'paid' && !booking.paidAt) {
            booking.paidAt = new Date();
        }

        if (status) booking.status = status;

        // If booking is confirmed, block property dates (idempotent-ish due to filter logic).
        if (booking.status === 'confirmed') {
            const property = await Property.findById(booking.property);
            if (property) {
                await property.blockDates(booking.checkIn, booking.checkOut, booking._id);
            }
        }

        await booking.save();

        return res.json({
            success: true,
            message: 'Booking payment updated',
            booking
        });
    } catch (error) {
        console.error('Update booking payment error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
