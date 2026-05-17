const mongoose = require('mongoose');

// 1. Define Counter Schema & Model FIRST so it's available in memory
const counterSchema = new mongoose.Schema({
  modelName: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});
const OfficerCounter = mongoose.model('OfficerCounter', counterSchema);

// 2. Define Officer Schema
const officerSchema = new mongoose.Schema({
  officerId: { 
    type: String, 
    unique: true, 
    index: true 
  }, // e.g., MGT-0001
  
  name: { type: String, required: true },

  phone: { type: String, required: true, unique: true, index: true },
  password:{type:String,required:true},
  
  email: { type: String, unique: true, sparse: true }, 
  photo: { type: String, default: null },
  role: { type: String, required: true, trim: true },
  
  department: {
    type: String,
    enum: [
      'Operations',       
      'Leasing',          
      'Facilities',       
      'Finance',          
      'Legal',            
      'Tenant Relations', 
      'Security',
      'Other'
    ],
    default: 'Other'
  },
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// 3. Reliable Auto-Increment Logic
officerSchema.pre('save', async function (next) {
  // Only generate ID on first creation
  if (!this.isNew) return next();

  try {
    // $inc with findOneAndUpdate is strictly atomic. 
    // Even if 100 officers are registered in the exact same millisecond, 
    // MongoDB locks the counter document to guarantee no duplicate IDs.
    const counter = await OfficerCounter.findOneAndUpdate(
      { modelName: 'officer' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const prefix = "MGT";
    const sequenceNumber = counter.seq.toString().padStart(4, '0');

    // FIXED: Mapped to the correct schema property
    this.officerId = `${prefix}-${sequenceNumber}`;

    next();
  } catch (error) {
    next(error);
  }
});

// Optimize for searching officers when they try to login
officerSchema.index({ phone: 1 });

const Officer = mongoose.model('Officer', officerSchema);

module.exports = { Officer, OfficerCounter };