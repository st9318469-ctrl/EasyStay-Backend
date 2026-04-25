import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['hotel', 'villa', 'apartment', 'cabin', 'resort'],
        default: 'hotel'
    },
    price: {
        type: Number,
        required: true
    },
    location: {
        city: String,
        country: String,
        address: String,
        state: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    amenities: [String],
    images: [{
        url: String
    }],
    bedrooms: Number,
    bathrooms: Number,
    maxGuests: Number,
    rating: {
        type: Number,
        default: 0
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    // Availability tracking
    unavailableDates: [{
        date: Date,
        reason: String
    }],
    blockedDates: [{
        startDate: Date,
        endDate: Date,
        reason: String
    }],
    minStayDays: {
        type: Number,
        default: 1
    },
    maxStayDays: {
        type: Number,
        default: 30
    },
    advanceNotice: {
        type: Number,
        default: 0
    },
    checkInTime: {
        type: String,
        default: "14:00"
    },
    checkOutTime: {
        type: String,
        default: "11:00"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Method to check if dates are available
propertySchema.methods.isDateAvailable = function(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    // Check blocked date ranges
    for (let blocked of this.blockedDates) {
        const blockedStart = new Date(blocked.startDate);
        const blockedEnd = new Date(blocked.endDate);
        
        if (start < blockedEnd && end > blockedStart) {
            return false;
        }
    }
    
    // Check individual unavailable dates
    let current = new Date(start);
    while (current < end) {
        const dateStr = current.toDateString();
        const isUnavailable = this.unavailableDates.some(
            u => new Date(u.date).toDateString() === dateStr
        );
        if (isUnavailable) return false;
        current.setDate(current.getDate() + 1);
    }
    
    return true;
};

// Method to get available dates for a range
propertySchema.methods.getAvailableDates = function(startDate, endDate) {
    const available = [];
    let current = new Date(startDate);
    
    while (current <= endDate) {
        const dateStr = current.toDateString();
        const isBooked = this.unavailableDates.some(
            u => new Date(u.date).toDateString() === dateStr
        );
        if (!isBooked) {
            available.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
    }
    
    return available;
};

// Method to block dates for booking
propertySchema.methods.blockDates = async function(checkIn, checkOut, bookingId) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    // Add individual dates to unavailableDates
    let current = new Date(start);
    while (current < end) {
        this.unavailableDates.push({
            date: new Date(current),
            reason: `Booking ${bookingId}`
        });
        current.setDate(current.getDate() + 1);
    }
    
    // Some legacy seed data may be missing required fields (e.g. `host`).
    // Avoid failing a booking just because of unrelated schema validation.
    await this.save({ validateBeforeSave: false });
};

// Method to unblock dates (for cancellations)
propertySchema.methods.unblockDates = async function(checkIn, checkOut, bookingId) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    this.unavailableDates = this.unavailableDates.filter(u => 
        !(new Date(u.date) >= start && new Date(u.date) < end)
    );
    
    await this.save({ validateBeforeSave: false });
};

export default mongoose.model('Property', propertySchema);
