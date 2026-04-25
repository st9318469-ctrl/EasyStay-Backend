/**
 * Seed script — populates DB with sample data for development.
 * Run with: node utils/seed.js
 * To clear:  node utils/seed.js --clear
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../models/User');
const Property = require('../models/property');
const Booking  = require('../models/Booking');
const Review   = require('../models/Review');

const connectDB = require('../config/db');

const PROPERTIES = [
  {
    title: 'Sunny Beachfront Villa',
    description: 'Wake up to the sound of waves in this stunning beachfront villa.',
    type: 'villa',
    location: { address: '1 Ocean Drive', city: 'Miami', state: 'FL', country: 'USA', zipCode: '33139', coordinates: { lat: 25.7617, lng: -80.1918 } },
    images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800'],
    pricePerNight: 350,
    cleaningFee: 50,
    serviceFee: 30,
    amenities: ['wifi', 'pool', 'parking', 'air_conditioning', 'kitchen', 'balcony'],
    bedrooms: 4, bathrooms: 3, beds: 5, maxGuests: 8,
    houseRules: 'No smoking. No pets. Quiet hours after 10pm.',
    cancellationPolicy: 'moderate',
  },
  {
    title: 'Cozy Mountain Cabin',
    description: 'Escape to the mountains in this charming log cabin with fireplace.',
    type: 'cabin',
    location: { address: '42 Pine Ridge Rd', city: 'Aspen', state: 'CO', country: 'USA', zipCode: '81611', coordinates: { lat: 39.1911, lng: -106.8175 } },
    images: ['https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800'],
    pricePerNight: 180,
    cleaningFee: 30,
    serviceFee: 20,
    amenities: ['wifi', 'fireplace', 'parking', 'kitchen', 'heating'],
    bedrooms: 2, bathrooms: 1, beds: 3, maxGuests: 4,
    houseRules: 'Pet-friendly. No parties.',
    cancellationPolicy: 'flexible',
  },
  {
    title: 'Modern City Apartment',
    description: 'Sleek and stylish apartment in the heart of downtown.',
    type: 'apartment',
    location: { address: '500 5th Ave', city: 'New York', state: 'NY', country: 'USA', zipCode: '10110', coordinates: { lat: 40.7549, lng: -73.9840 } },
    images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'],
    pricePerNight: 220,
    cleaningFee: 40,
    serviceFee: 25,
    amenities: ['wifi', 'gym', 'elevator', 'air_conditioning', 'workspace', 'tv'],
    bedrooms: 1, bathrooms: 1, beds: 1, maxGuests: 2,
    houseRules: 'No smoking. No parties.',
    cancellationPolicy: 'strict',
  },
];

async function seed() {
  await connectDB();

  if (process.argv.includes('--clear')) {
    await Promise.all([
      User.deleteMany(),
      Property.deleteMany(),
      Booking.deleteMany(),
      Review.deleteMany(),
    ]);
    console.log('🗑  Database cleared');
    process.exit(0);
  }

  // Create admin
  const admin = await User.create({
    name: 'Admin User', email: 'admin@chillspace.com',
    password: 'admin123', role: 'admin', isVerified: true,
  });

  // Create host
  const host = await User.create({
    name: 'Sarah Host', email: 'host@chillspace.com',
    password: 'host1234', role: 'host', isVerified: true,
    bio: 'Passionate about hospitality and creating memorable stays.',
  });

  // Create guest
  const guest = await User.create({
    name: 'John Guest', email: 'guest@chillspace.com',
    password: 'guest123', role: 'guest', isVerified: true,
  });

  // Create properties
  const props = await Property.insertMany(
    PROPERTIES.map(p => ({ ...p, host: host._id }))
  );

  // Create a completed booking + review
  const checkIn  = new Date('2024-12-01');
  const checkOut = new Date('2024-12-05');
  const booking  = await Booking.create({
    property:      props[0]._id,
    guest:         guest._id,
    host:          host._id,
    checkIn, checkOut,
    guests:        2,
    pricePerNight: props[0].pricePerNight,
    nights:        4,
    cleaningFee:   props[0].cleaningFee,
    serviceFee:    props[0].serviceFee,
    totalAmount:   props[0].pricePerNight * 4 + props[0].cleaningFee + props[0].serviceFee,
    status:        'completed',
    paymentStatus: 'paid',
    rulesAccepted: true,
  });

  await Review.create({
    property:     props[0]._id,
    booking:      booking._id,
    reviewer:     guest._id,
    reviewerRole: 'guest',
    ratings: {
      cleanliness: 5, communication: 5, checkIn: 5, accuracy: 4, location: 5, value: 4,
    },
    comment: 'Absolutely stunning villa. Would definitely come back!',
    overallRating: 5,
  });

  console.log('✅ Seed complete!');
  console.log('   Admin  → admin@chillspace.com  / admin123');
  console.log('   Host   → host@chillspace.com   / host1234');
  console.log('   Guest  → guest@chillspace.com  / guest123');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });