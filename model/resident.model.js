const { default: mongoose } = require("mongoose");
const { customAlphabet } = require('nanoid');


const nanoid = customAlphabet("1234567890",8)

const residentSchema = new mongoose.Schema({

  name: {type:String,required:true,},
  phone:{type:String,required:true},
  role:{type:String,enum:['owner','family','tenant'],required:true},
  photo:{type:String,default:null},
  email:{type:String,default:null},
  relation: { type: String, default:"owner"},

  familyId:{type:String,required:true},


  
  phase:{type:String,required:true},
  block:{type:String,required:true},
  plot:{type:String,required:true},
  floor:{type:String,required:true},


  memberId:{type:String,unique:true},

  fcmToken:{type:String,default:null},

  canApproveVisitors:{type:Boolean,default:true},
  canCreatePass:{type:Boolean,default:true},

  isActive:{type:Boolean,default:true},


  password:{type:String,require:true},
  




},{timestamps:true})


residentSchema.pre("save", async function (next) {
  if (!this.memberId) {
  
    const count = await mongoose.model("Residents").countDocuments({
      familyId: this.familyId,
      relation: this.relation,
    });

    

    this.memberId = `${this.familyId}-${this.relation.toUpperCase()}-${count + 1}`


  }
  next()
});


const residentSessionSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  memberId: { type: String, required: true },
  familyId: { type: String, required: true },
  role: { type: String, required: true },
  deviceId: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});


const visitorPassSchema = new mongoose.Schema({
  passId: { type: String, unique: true,index:true },   // backend generated
  name:{type:String,required:true},
  phone:{type:String,default:null},
  familyId: { type: String, required: true },
  memberId: { type: String, required: true }, // who created
  createdBy: { type: String, required: true }, // same as memberId
  visitDate:{type:Date,required:true},
  endDate: { type: Date, required: true },     // expiry
  purpose: { type: String, default: 'Visitor' },
  status: { type: String, enum: ['active','expired','cancelled'], default: 'active' },

  isCancelled :{type:Boolean,default:false},

  cancelledBy :{type:String}

}, { timestamps: true });

visitorPassSchema.pre("save", function(next) {
  if (!this.passId) {
   const time = Date.now().toString(36).slice(-4); 
    const random = nanoid(8); 
    this.passId = `VP-${time}-${random}`.toUpperCase(); 
  }
  next();
});












const residentNotif = new mongoose.Schema({
  familyId: { type: String, required: true, index: true },
  
  category: { 
    type: String, 
    enum: ['visitor', 'staff', 'utility', 'delivery', 'general', 'emergency'], 
    required: true 
  },
  notifType: { 
    type: String, 
    default: 'alert' 
  },

  title: { type: String, required: true },
  description: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'denied', 'logged', 'expired'], 
    default: 'logged' 
  },

  // Timing
  entryTime: { type: String }, 
  
  entryDate: { type: Date, default: Date.now },

  // Actors
  approvedBy: { type: String }, // Member ID of the resident who gave the 'OK'
 
  personDetails: {
    name: { type: String },
    company: { type: String }, // e.g., 'Zomato', 'Amazon'
    photo: { type: String },   // URL to Cloudinary image
    phone: { type: String },
   
  },
  expireAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 
    index: { expires: 0 } 
  }

}, 
{ 
  timestamps: true 
})

residentNotif.pre('save', function(next) {
  if (!this.title && this.personDetails.name) {
    this.title = `${this.category.charAt(0).toUpperCase() + this.category.slice(1)} Entered: ${this.personDetails.name}`;
  }
  next()
});










const residentQRSchema = new mongoose.Schema({
  
  memberId: { 
    type: String, 
    required: true 
  },
 
  familyId: { 
    type: String, 
    required: true 
  },
  
  qrCodeValue: { 
    type: String, 
    required: true, 
    unique: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'validated', 'expired'], 
    default: 'pending' 
  },
  
  createdAt: { 
    type: Date, 
    default: Date.now, 
    index: { expires: '5m' } 
  }
}, { timestamps: true })

const ResidentQR = mongoose.model('ResidentQR', residentQRSchema);


const Resident = mongoose.model("Residents", residentSchema);
const ResidentSession = mongoose.model("ResidentSession",residentSessionSchema)
const VisitorPass = mongoose.model("VisitorPass",visitorPassSchema)
const Notifications = mongoose.model("Notifications",residentNotif)
module.exports = {
  Resident,
  ResidentSession,
  VisitorPass,
  ResidentQR,
  Notifications,
};
