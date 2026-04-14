const express = require('express')

const adminRoute = express.Router()

const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: "dd5pdy82n",
  api_key: "397341551664711",
  api_secret: "G8Erp1raivFJyMChleae3nOXwpI"
});

const multer = require("multer")
const { Resident } = require('../model/residentModel')
const {Counter, Guard} = require("../model/guardModel")


const upload = multer({dest:"uploads/"})


// const residentSchema = new mongoose.Schema({
//   name: {type:String,required:true,},
//   residentId:{type:String,required:true,index:true},
//   flatNumber: {type:String,required:true},
//   password:{type:String,require:true},
//   photo:{type:String,default:null},
//   phoneNumber: {type:String,required:true,},
//   fcmToken: { type: String, default: null }, 
//   isLoggedIn: { type: Boolean, default: false },
//   email:{type:String,default:null},
//   members:{type:Number,degault:2},
//   status :{type:String, 
//     enum:['inactive','active',],
//     default : 'inactive'
//   }
// })

adminRoute.post('/resident',async (req,res,next)=>{
    console.log(req.body,req.file)
    
    const {email,flat,members,name,phone,password} = req.body

    const residentId = `Res-${flat}`

    const newResident = Resident({residentId,name,email,phoneNumber:phone,flatNumber:flat,password,members})

    try {
        const rest =await newResident.save()

        console.log(rest)

        res.status(200).json(rest)
    } catch (error) {
        return res.status(409).json({
            message: error.message
        });
    }
    
    console.log(residentId)

    
})

adminRoute.get('/resident',async (req,res,next)=>{
    console.log("request")
   try {
     const residentList =await Resident.find()
     res.status(200).json(residentList)
   } catch (error) {
      return res.status(400).json({
            message: error.message
        });
   }
})



// name: { type: String, required: true},
//   guardId:{type:String,required:true,unique:true},
//   phone: { type: String, required: true, unique: true },
//   joinDate: { type: String,required:true},
//   password: { type: String, required: true },
//   gate: { type: String, default: "Main Gate" },
  
//   shift: {
//     type: { type: String, enum: ["Morning", "Evening", "Night"], default: "Morning" },
//     startTime: { type: String, required: true }, // e.g., "08:00"
//     endTime: { type: String, required: true },   // e.g., "20:00"
//   },

  
//   currentStatus: { 
//     type: String, 
//     enum: ["On Duty", "Off Duty", "On Leave", "Suspended"], 
//     default: "Off Duty" 
//   },
//   photo: { type: String }



adminRoute.post('/guard',upload.single('photo'),async (req,res,next)=>{
    console.log(req.body,req.file,"hit!!!!!!!!!!!!!!")

    const counter = await Counter.findOneAndUpdate(
      { id: "guardId" }, 
      { $inc: { seq: 1 } }, 
      { new: true, upsert: true }
    );

    const sequenceNumber = counter.seq.toString().padStart(2, '0');
    const guardId = `Guard-${sequenceNumber}`;

    let url = null

    console.log(guardId)

    if(req.file){
        

    const result = await cloudinary.uploader.upload(req.file.path)

    url = result.secure_url

    }
    const {name,phoneNumber,gate,shift,entry,joinDate,endTime,startTime,password} = req.body

    const shiftObj = {
        type:shift,
        startTime,
        endTime
    }

    const newGuard = new Guard({guardId,name,phoneNumber,password,gate,joinDate,photo:url,shift:shiftObj})

    try {
        const rest = await newGuard.save()
        res.status(200).json(rest)
        
    } catch (error) {
        console.log(error)
    }
})


adminRoute.get('/guard',async (req,res,next)=>{
    console.log("request")
   try {
     const residentList =await Guard.find()
     res.status(200).json(residentList)
   } catch (error) {
      return res.status(400).json({
            message: error.message
        });
   }
})

exports.adminRoute = adminRoute