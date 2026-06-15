const mongoose = require('mongoose')


const gateDeviceSchema = mongoose.Schema({
    deviceId:{type:String,required:true,unique:true},
    deviceType:{type:String,enum:['MAIN','BACKUP','TEMPORARY'],required:true},
    societyName:{type:String,default:'BLF'},
    gateName:{type:String,required:true},
    pinCode:{type:String,required:true}, 
    isActive:{type:Boolean,default:true},
    fcmToken:{type:String,default:null},
    lastSeen:{type:Date},
    createdAt:{type:Date,default: Date.now},
    expiresAt:{type:Date,default:null,index:{expires:0}}
})

const deviceActivationSchema = mongoose.Schema({
    activationId:{type:String,required:true,unique:true},
    societyName:{type:String,default:'BLF'},
    gateName:{type:String,required:true},
    deviceType:{type:String,required:true},
    duration:{type:String,default:null},
    pinCode:{type:String,required:true},
    status:{type:String,enum:['PENDING','USED','EXPIRED'],default:'PENDING'},
    expireAt:{type:String,required:true}



})

deviceActivationSchema.index(
    {expireAt:1},
    {expireAfterSeconds:0}
)


const visitorRequestSchema = new mongoose.Schema({
    requestId: { 
        type: String, 
        required: true, 
        unique: true, 
    },
    familyId: { type: String, required: true },
    name: { type: String, required: true },
    purpose: { type: String },
    photo: { type: String }, 
    phone:{type:String,default:null},
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected','expired'], 
        default: 'pending' 
    },
    deviceId:{type:String,required:true},
    approvedBy: { 
        type: String,
        ref: 'Resident', 
        default: null 
    },
    requestTime: { type: Date , default: Date.now },
    createdAt: {
    type: Date, // Change from String to Date
    default: Date.now
  }
    
});

const deliveryMovementSchema = new mongoose.Schema({
  // Link to the Resident Notification for traceability
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notifications' },
  familyId: { type: String, required: true, index: true },
  
  // Personnel Info (Redundant for speed, so Guard doesn't have to join tables)
  riderName: { type: String, required: true },
  company: { type: String, required: true }, // Blinkit, Zomato, etc.
  phone: { type: String },
  
  // Vehicle Details (Captured via your ANPR logic)
  vehicleNumber: { type: String,default:null }, 
  vehicleType: { type: String, enum: ['2W', '4W', 'EV'], default: '2W' },

  // Movement Lifecycle
  status: { 
    type: String, 
    enum: ['IN_PROGRESS', 'COMPLETED', 'HANDOVER_AT_GATE'], 
    default: 'IN_PROGRESS' 
  },
  
  entryGate: { type: String, default: 'Main Gate' },
  entryTime: { type: Date, default: Date.now },
  
  exitTime: { type: Date },
  exitGate: { type: String,default:'Main Gate' },

  // Verification
  entryPhoto: { type: String }, // Captured at Gate in handover cases
  isHandover: { type: Boolean, default: false }  
}, { timestamps: true })



deliveryMovementSchema.index({ status: 1, entryTime: -1 })

const utilityMovementSchema = new mongoose.Schema({
  
  utilityId:{type:String,index:true,default:null},
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notifications' },
  familyId: { type: String, required: true, index: true }, 
  
  type: { type: String,enum:['carpenter','plumber','electrician','pest','ac','ro','other']}, // e.g., 'Carpenter', 'Plumber', 'Electrician', 'AC Repair'
  othertype : {type:String},

  name: { type: String, required: true },
  phone: { type: String },
  photo:{type:String,default:null},
  
  vehicleNumber: { type: String, default: null }, 
  vehicleType: { type: String, enum: ['None', 'Bicycle', '2W', '4W', 'EV'], default: '2W' },

  // Movement Lifecycle
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



// Optimize queries for the Guard's Dashboard
utilityMovementSchema.index({ status: 1, entryTime: -1 });



const visitorMovementSchema = new mongoose.Schema({
  // --- IDENTIFICATION ---
  // Store your 16-len random string here
  passId: { 
    type: String, 
    default: null, 
    index: true // Crucial for fast QR scanning
  },
  passStartDate: { 
    type: Date, 
    default: null
  }, 
  passEndDate: { 
    type: Date, 
    default:null 
  },
  
  // Store your 16-len reqId string here
  requestId: { 
    type: String, 
    default: null, 
    index: true 
  },

  familyId: { type: String, required: true, index: true },

  // --- PERSONNEL DETAILS ---
  name: { type: String, required: true },
  phone: { type: String },
  purpose:{type:String,default:'visitor'},
  photo:{type:String,default:null},
  type: { 
    type: String, 
    enum: ['visitor', 'cab',  'other'], 
    default: 'visitor' 
  },

  // --- MOVEMENT LIFECYCLE ---
  status: { 
    type: String, 
    enum: ['IN_PROGRESS', 'COMPLETED', 'EXPIRED','REJECTED'], 
    default: 'IN_PROGRESS' 
  },
  
  entryTime: { type: Date, default: Date.now },
  exitTime: { type: Date, default: null },

}, { timestamps: true });

// Optimize for your "Active Staff/Visitors" dashboard cards
visitorMovementSchema.index({ status: 1, entryTime: -1 });

const biometricSchema = mongoose.Schema({
  vectorizeId:{type:String,required:true,unique:true},
  name:{type:String,required:true},
  type:{type:String,enum:['resident','staff','utility'],required:true},
  role:{type:String,required:true}, // maid plumber cook etc
  photo:{type:String,default:null},
})


const BiometricData = mongoose.model("BiometricData",biometricSchema)
const VisitorRequest = mongoose.model('VisitorRequest', visitorRequestSchema);
const GateDevices = mongoose.model("GateDevices",gateDeviceSchema)
const ActivateDevice = mongoose.model("ActivateGateDevices",deviceActivationSchema)
const DelievryMovement = mongoose.model("DelievryMovement",deliveryMovementSchema)
const UtilityMovement = mongoose.model("UtilityMovement",utilityMovementSchema)
const VisitorMovement = mongoose.model("VisitorMovement",visitorMovementSchema)

module.exports = {GateDevices,ActivateDevice,VisitorRequest,DelievryMovement,UtilityMovement,VisitorMovement,BiometricData}
