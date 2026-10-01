/**
 * Seeds the database with an admin user + a few sample workspaces so you
 * can log in and test the app immediately after setup.
 * Run with: npm run seed
 */
const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Seat = require('../models/Seat');

const run = async () => {
  await connectDB();

  // --- Admin user ---
  const adminEmail = 'admin@workx.pk';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      firstName: 'Amjad',
      lastName: 'Ali',
      email: adminEmail,
      password: 'Admin@12345',
      role: 'admin',
      isEmailVerified: true,
      phone: '03000000000',
    });
    console.log('Created admin user:', adminEmail, '(password: Admin@12345)');
  }

  // --- Sample workspaces ---
  const sample = [
    {
      name: 'The Skyline Floor', type: 'Hot Desk', city: 'Lahore',
      address: '336 Block G3, Johar Town, Canal Road, Lahore',
      description: 'Floor-to-ceiling glass, 80 hot desks, and a private terrace lounge above the city.',
      pricePerDay: 500, capacity: 24, amenities: ['WiFi', 'Coffee', 'AC', 'Parking'],
      isFeatured: true, createdBy: admin._id,
    },
    {
      name: 'Glass Boardroom', type: 'Meeting Room', city: 'Karachi',
      address: 'Clifton Block 5, Karachi',
      description: 'Seats 10, glass-walled boardroom with 4K screen and video conferencing.',
      pricePerDay: 1000, capacity: 10, amenities: ['WiFi', 'Screen', 'AC', 'Coffee'],
      isFeatured: true, createdBy: admin._id,
    },
    {
      name: 'Private Cabin Suite', type: 'Private Cabin', city: 'Islamabad',
      address: 'F-7 Markaz, Islamabad',
      description: 'Lockable private cabin for one, ideal for focused solo work.',
      pricePerDay: 1800, capacity: 4, amenities: ['WiFi', 'AC', 'Locker'],
      createdBy: admin._id,
    },
  ];

  for (const ws of sample) {
    const exists = await Workspace.findOne({ name: ws.name });
    if (exists) continue;
    const workspace = await Workspace.create(ws);

    const seatDocs = [];
    const cols = 8;
    for (let i = 0; i < workspace.capacity; i++) {
      seatDocs.push({ workspace: workspace._id, seatNumber: `S${i + 1}`, row: Math.floor(i / cols), col: i % cols });
    }
    await Seat.insertMany(seatDocs);
    console.log('Created workspace:', workspace.name);
  }

  console.log('Seeding complete.');
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
