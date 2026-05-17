const mongoose = require("mongoose")


const counterSchema = new mongoose.Schema({
  modelName: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});


const staffSchema = new mongoose.Schema({
  staffId: {
    type: String,
    unique: true,
    index: true
  },
  name: { type: String, required: true },
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  category: {
    type: String,
    enum: ['maid', 'driver', 'cook', 'nanny', 'gardener', 'sweeper', 'security', 'maintenance', 'other'],
    lowercase: true,
    required: true
  },
  otherType:{type:String,default:null},
  scopeOfWork: {
    type: [String],
    default: []
  },

  photo: { type: String, default: null },
  activeHousesCount: { type: Number, default: 0 },
  isLookingForWork: { type: Boolean, default: true },
  registeredBy: {
    type: String,
    enum: ['GUARD', 'RESIDENT','ESTATE_OFFICE'],
    required: true
  }
}, { timestamps: true })


staffSchema.pre('save', async function (next) {

  if (!this.isNew) return next();

  try {
    const counter = await StaffCounter.findOneAndUpdate(
      { modelName: 'staff' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    )

    // STF- followed by 4 digits (e.g., STF-0001)
    const prefix = "STF";
    const sequenceNumber = counter.seq.toString().padStart(4, '0');

    this.staffId = `${prefix}-${sequenceNumber}`;

    next();
  } catch (error) {
    next(error)
  }
});


const staffAffiliationSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  familyId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'fired'],
    default: 'active'
  },
  hiredDate: { type: Date, default: Date.now },
  fireDate: { type: Date },
  firedBy: { type: String }
}, { timestamps: true })


const staffMovementSchema = new mongoose.Schema({

  staffId: {
    type: String,
    required: true,
    index: true
  },


  // 3. Standard Fields (Matches your Delivery & Utility structure)
  category: { type: String, default: 'staff' },
  type: {
    type: String, enum: ['maid', 'driver', 'cook', 'nanny', 'gardener', 'sweeper', 'security', 'maintenance', 'other'],
    lowercase: true,
  }, // 'maid', 'driver', etc. (copied from master)
  otherType:{type:String,default:null},
  name: { type: String, required: true }, // Copied from master for fast queries
  phone: { type: String },

  // 4. Visual Verification
  photo: { type: String }, // Shown on Guard's screen for manual visual verification

  // 5. Movement Lifecycle
  status: {
    type: String,
    enum: ['IN_PROGRESS', 'COMPLETED'],
    default: 'IN_PROGRESS'
  },

  entryGate: { type: String, default: 'Main Gate' },
  entryTime: { type: Date, default: Date.now },

  exitTime: { type: Date },
  exitGate: { type: String, default: 'Main Gate' },

}, { timestamps: true })


staffMovementSchema.index({ status: 1, entryTime: -1 });

const StaffMovement = mongoose.model('StaffMovement', staffMovementSchema);








const Staff = mongoose.model("Staff", staffSchema)
const StaffCounter = mongoose.model('StaffCounter', counterSchema);
const StaffAffiliation = mongoose.model("StaffAffiliations", staffAffiliationSchema)


module.exports = { Staff, StaffCounter, StaffAffiliation, StaffMovement }