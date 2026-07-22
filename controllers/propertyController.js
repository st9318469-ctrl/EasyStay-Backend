import Property from '../models/property.js';
import Booking from '../models/Booking.js';
import mongoose from 'mongoose';

const canMutate = (property, user) => {
  if (!property || !user) return false;
  const userId = user._id || user.id;
  const isOwner = userId && String(property.host) === String(userId);
  const isAdmin = user.role === 'admin';
  return Boolean(isOwner || isAdmin);
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const eachDay = (start, end) => {
  const days = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  for (; cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }
  return days;
};

const calculateAvailability = async (property, start = null, end = null) => {
  const today = new Date();
  const defaultEnd = new Date();
  defaultEnd.setDate(today.getDate() + 30);

  const rangeStart = start || today;
  const rangeEnd = end || defaultEnd;

  const bookedDates = (property.bookedDates || []).map((d) => new Date(d).toDateString());
  const availableDates = [];

  for (const day of eachDay(rangeStart, rangeEnd)) {
    if (!bookedDates.includes(day.toDateString())) {
      availableDates.push(day);
    }
  }

  return availableDates;
};

export const createProperty = async (req, res) => {
  try {
    if (!req.user?._id && !req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const property = new Property({
      ...req.body,
      host: req.user?._id || req.user?.id,
      isAvailable: req.body?.isAvailable ?? true,
    });

    const created = await property.save();
    return res.status(201).json({ success: true, property: created });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProperties = async (req, res) => {
  try {
    const filters = {};
    if (req.query.city) filters['location.city'] = req.query.city;
    if (req.query.country) filters['location.country'] = req.query.country;
    if (req.query.available === 'true') filters.isAvailable = true;
    if (req.query.available === 'false') filters.isAvailable = false;

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const properties = await Property.find(filters).sort({ createdAt: -1 }).limit(limit);

    return res.json({ success: true, properties });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProperty = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid property id' });
    }

    let query = Property.findById(id);

    if (Property.schema.path('host')) {
      query = query.populate({ path: 'host', select: 'name email phone avatar', strictPopulate: false });
    }

    if (Property.schema.path('reviews.user')) {
      query = query.populate({ path: 'reviews.user', select: 'name avatar', strictPopulate: false });
    }

    const property = await query;

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    return res.json({ success: true, property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (!canMutate(property, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    Object.assign(property, req.body);
    const updated = await property.save();
    return res.json({ success: true, property: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    if (!canMutate(property, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await property.deleteOne();
    return res.json({ success: true, message: 'Property deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const checkAvailability = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const start = parseDate(req.query.start || req.query.checkIn);
    const end = parseDate(req.query.end || req.query.checkOut);

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'start/end (or checkIn/checkOut) query params are required (YYYY-MM-DD)',
      });
    }
    if (start > end) {
      return res.status(400).json({ success: false, message: 'start must be <= end' });
    }

    // Treat end as checkout (end-exclusive) to match booking logic.
    const days = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endExclusive = new Date(end);
    endExclusive.setHours(0, 0, 0, 0);

    while (cursor < endExclusive) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const unavailableDates = [];
    for (const day of days) {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      if (!property.isDateAvailable(day, nextDay)) {
        unavailableDates.push(day);
      }
    }

    const isAvailable = unavailableDates.length === 0;

    const nights = Math.max(0, days.length);
    const subtotal = (property.price || 0) * nights;
    const serviceFee = Math.round(subtotal * 0.1);
    const cleaningFee = nights > 0 ? 500 : 0;
    const total = subtotal + serviceFee + cleaningFee;

    return res.json({
      success: true,
      isAvailable,
      available: isAvailable, // backwards-compatible alias
      unavailableDates,
      priceBreakdown: { nights, subtotal, serviceFee, cleaningFee, total },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPropertyCalendar = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const start = parseDate(req.query.start);
    const end = parseDate(req.query.end);

    const availability = await calculateAvailability(property, start, end);

    return res.json({
      success: true,
      bookedDates: property.bookedDates || [],
      availableDates: availability,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Backwards-compatible name
export const getPropertyDetails = getProperty;

export const getHostProperties = async (req, res) => {
  try {
    const hostId = req.user?._id || req.user?.id;
    const properties = await Property.find({ host: hostId }).sort('-createdAt');

    return res.json({ success: true, properties });
  } catch (error) {
    console.error('Error fetching host properties:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getHostStats = async (req, res) => {
  try {
    const hostId = req.user?._id || req.user?.id;

    const properties = await Property.find({ host: hostId });
    const propertyIds = properties.map((property) => property._id);

    const bookings = await Booking.find({
      property: { $in: propertyIds },
      status: 'confirmed',
    });

    const totalBookings = bookings.length;
    const totalEarnings = bookings.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);
    const totalProperties = properties.length;

    const totalRating = properties.reduce((sum, property) => sum + (property.rating || 0), 0);
    const avgRating = totalProperties > 0 ? Number((totalRating / totalProperties).toFixed(1)) : 0;

    return res.json({
      success: true,
      stats: {
        totalProperties,
        totalBookings,
        totalEarnings,
        avgRating,
      },
    });
  } catch (error) {
    console.error('Error fetching host stats:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
