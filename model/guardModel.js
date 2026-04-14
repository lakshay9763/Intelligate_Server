const mongoose = require("mongoose");

const guardSchema = new mongoose.Schema({
  name: { type: String, required: true},
  guardId:{type:String,required:true,unique:true},
  phoneNumber: { type: String, required: true, unique: true },
  joinDate: { type: String,required:true},
  password: { type: String, required: true },
  gate: { type: String, default: "Main Gate" },
  
  shift: {
    type: { type: String, enum: ["Morning", "Evening", "Night"], default: "Morning" },
    startTime: { type: String, required: true }, // e.g., "08:00"
    endTime: { type: String, required: true },   // e.g., "20:00"
  },

  
  currentStatus: { 
    type: String, 
    enum: ["On Duty", "Off Duty", "On Leave", "Suspended"], 
    default: "Off Duty" 
  },
  photo: { type: String }
});


const counterSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // e.g., "guardId"
  seq: { type: Number, default: 0 }
});




const attendanceSchema = new mongoose.Schema({

  guard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Guard",    
    required: true
  },

  guardId: {
    type: String,
    required: true
  },

  date: {
    type: String,
    required: true
  },

  checkInTime: {type:String,default:null},
  checkOutTime:  {type:String,default:null},

  status: {
    type: String,
    enum: ["Present", "Late", "Absent"],
    default: "Present"
  },

  lateMinutes: {
    type: Number,
    default: 0
  }

}, { timestamps: true });


attendanceSchema.index(
  { guard: 1, date: 1 },   // combination of guard + date should be unique .....!!
  { unique: true }
);

const staffAttendanceSchema = new mongoose.Schema({
  workerId:{type:String,required:true,index:true},
  residentId:{type:String,required:true,index:true},
  date:{type:String,required:true},
  locationStatus:{type:String,enum:['inside','outside'],default:'outside'},
  entryTime: { 
    type: String, // Format: "17:56"
    default: null 
  },
  exitTime: { 
    type: String, 
    default: null 
  },
  guardId:{type:String,required:true}

},{timestamps:true})

staffAttendanceSchema.index({workerId:1,residentId:1,date:1},{unique:true})

const PersonelStaffAttendance  = mongoose.model("PersonelStaffAttendance",staffAttendanceSchema)

const GuardAttendance = mongoose.model("GuardAttendance", attendanceSchema);



const Counter = mongoose.model("Counter", counterSchema);

const Guard  = mongoose.model("Guard", guardSchema);

module.exports = {Counter,Guard,GuardAttendance,PersonelStaffAttendance}