const mongoose = require('mongoose');

const utilityCounterSchema = new mongoose.Schema({
  _id: { 
    type: String, 
    required: true 
    // We will use a hardcoded string like 'utilityId' for this record
  },
  seq: { 
    type: Number, 
    default: 0 
  }
});

const UtilityCounter = mongoose.model('UtilityCounter', utilityCounterSchema);

const utilityWorkerSchema = new mongoose.Schema({
  utilityId: {
    type: String,
    unique: true,
  },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true },
  photo: { type: String, default: null },
  category: {
    type: String,
    required: true,
    enum: ['electrician', 'plumber', 'carpenter', 'pest', 'ac', 'ro', 'other'],
  },
  otherType: { type: String, default: null, trim: true },
  tasks: { type: [String], default: [] },
  
  registeredBy: {
    type: String,
    enum: ['GUARD', 'ADMIN', 'RESIDENT'],
    default: 'GUARD',
  },
 
 
  status: {
    type: String,
    enum: ['ACTIVE', 'DISABLED', 'BLACKLISTED'],
    default: 'ACTIVE',
  },
  accessDenied:{type:Boolean,default:false},

}, { timestamps: true });

// 🚀 The Bulletproof Auto-Increment Hook
utilityWorkerSchema.pre('save', async function (next) {
  // Only generate an ID if this is a brand new worker
  if (this.isNew && !this.utilityId) {
    try {
      // Find the counter and safely increment it by 1 using MongoDB's atomic $inc
      const counter = await UtilityCounter.findByIdAndUpdate(
        { _id: 'utilityId' },       // The unique identifier for this specific counter
        { $inc: { seq: 1 } },       // Increment the 'seq' field by 1
        { new: true, upsert: true } // upsert:true creates the counter if it doesn't exist yet!
      );
      
      // Pad the sequence with zeros (e.g., 42 -> "UTL-0042")
      this.utilityId = `UTL-${counter.seq.toString().padStart(4, '0')}`;
      
      next();
    } catch (error) {
      return next(error);
    }
  } else {
    next();
  }
});

module.exports 

const UtilityWorker  = mongoose.model('UtilityWorker', utilityWorkerSchema);

module.exports = {UtilityWorker}