const express = require('express');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/auth');
const {authorize} = require('../middleware/roleCheck');
const { Resident, Worker2Resident,Notifications } = require('../model/residentModel');
const { Guard, GuardAttendance, PersonelStaffAttendance } = require('../model/guardModel');
const { PersonalStaff } = require('../model/passModel');

const admin = require('../firebase.js')

const authRoute = express.Router()


const SECRET_KEY = "Lucifer the Morning Star!"


authRoute.post('/login',async (req,res)=>{

    console.log(req.body,'hello!!!')

    const {phone ,role,password , fcmToken} = req.body

    if(!phone && !password){
        res.status(400).json({message:"Mobile & Password Required!!"})
    }

    const user = role==='resident' ? await Resident.findOne({phoneNumber:phone}) : role==='guard' ? await Guard.findOne({phoneNumber:phone}) : null

    if(!user){
        res.status(404).json({message:"User not found!!"})
    }

    if(password !== user.password){
        res.status(401).json({message:"Invalid password!!"})
    }

    const id = role==='guard' ? user.guardId : role ==='resident' ? user.residentId : null

    if(role==='resident'){
        user.fcmToken = fcmToken
        const rest = await user.save()
        
        console.log(rest)
    }
 
    
      
        const token = jwt.sign({ id, role },SECRET_KEY,{ expiresIn: '7d' });

        console.log("token")

        return res.status(200).json({
            success: true,
            token: token,
            role: role,
            userData: {
                name: user.name,
                unit: user.unit || user.gate, 
                id: user.id
            }
        });
    

})



authRoute.get('/resident',protect,authorize, async (req,res,next)=>{
    console.log(req.query,req.user,'Lucy!!!')

    const {id,role} = req.user

    const resident = await Resident.findOne({residentId:id})

    console.log(resident)

    res.status(200).json(resident)

    
})


authRoute.get('/resident/staff-attendance',protect,authorize,async (req,res,next)=>{
    console.log(req.query,req.user,"1234 ")
    
    const {id} = req.user

    const atten = await PersonelStaffAttendance.find({residentId:id})
    if(!atten){
        return res.status(404).json({message:'Attendance Not Found !!'})
    }
    console.log(atten)
    res.status(200).json({atten,message:'Attendance Found !!'})
})


authRoute.get('/resident/notifications',protect,async (req,res,next)=>{
    console.log(req.query,req.user)
   
    
    const {id} = req.user 
    
    const rest = await Notifications.find({ residentId: id });

    if (rest.length === 0) {
    return res.status(404).json({ message: "Messages not found!" });
    }

    console.log(rest);

    return res.status(200).json(rest);
    })

authRoute.get('/guard',protect,authorize,async (req,res,next)=>{
    console.log("Server Hit!!!")
    console.log(req.user)

    const {id} = req.user

    try {
        const guard = await Guard.findOne({guardId:id})
        console.log(guard)
        res.status(200).json(guard)
    } catch (error) {
        res.status(400).json(error.message)
    }
})




authRoute.post('/guard/attendance',protect,authorize ,async (req,res,next)=>{
    console.log(req.user,req.body)
    const {id} = req.user

    try {

        const {checkInTime,date,lateTime} = req.body

        const guard = await Guard.findOne({guardId:id})

    

        if(!guard){
            res.status(404).json({message:'Guard not found!!'})
        }

        let status 

        if(lateTime <= 15){
            status="Present"
        }else{
            status="Late"
        }

        console.log(guard._id)

        const guardAttencance = new GuardAttendance({guard:guard._id,guardId:id,date,checkInTime,lateMinutes:lateTime,status})

        const rest = await guardAttencance.save()

        guard.currentStatus = "On Duty"

        await guard.save()

        res.status(200).json(rest)

        console.log(rest)
        
    } catch (error) {
        if(error.code === 11000){
            return res.status(409).json("Todays shift is done !!")
        }
        console.log(error.message)
    }
})

authRoute.put('/guard/attendance',protect,authorize,async (req,res,next)=>{
    console.log(req.body)
    const {id} = req.user
    const {checkOutTime} = req.body


    const guard = await Guard.findOne({guardId:id})
    if(!guard){
        res.status(404).json({message:'Guard not found !!'})
    }

    const guardAttendace = await GuardAttendance.findOne({guard:guard._id})


    if(guardAttendace.checkOutTime != null){
       return res.status(409).json("Check Out is done for today")
    }

    guard.currentStatus = "Off Duty"

    guardAttendace.checkOutTime = checkOutTime

    await guard.save()
    const rest = await guardAttendace.save()

    res.status(200).json(rest)



})


authRoute.get('/guard/attendance',protect,authorize,async (req,res,next)=>{
    const {id} = req.user
    console.log(req.query)

    const guard = await Guard.findOne({guardId:id})

    if(!guard){
        res.status(404).json("Guard Not FOund !!")
    }

    const atten = await GuardAttendance.findOne({guard:guard._id , date : req.query.date})

     if(!atten){
        res.status(404).json("Attendance Not Found !!")
    }

    const history = await GuardAttendance.find({guard:guard._id})

    console.log(atten,history,"not!!")
    res.status(200).json({today:atten,history})
})

authRoute.post('/guard/staff-attendance',protect,authorize,async (req,res,next)=>{
    console.log(req.user,req.body)
    const {id} = req.user
    const {workerId ,date,time} = req.body

      const residents = await Worker2Resident.findOne({ workerId })

      if(!residents){
        return res.status(404).json({message:"No Resident Found Under A Worker Registor"})
      }
  
      const entries =await  PersonelStaffAttendance.find({date,workerId}) || []

      if(entries.length > 0){
        return res.status(409).json({message:"Attendance is done for today !!"})
      }

      const worker = await PersonalStaff.updateOne({
        workerId,
        locationStatus:'outside'
         },{
        $set:{
            locationStatus:'inside'
        }
      })

      console.log(worker)


      

      residents.residentList?.forEach(async (resid) =>{
        const personelStaff = PersonelStaffAttendance({guardId:id,workerId,residentId:resid.residentId,date,entryTime:time,locationStatus:'inside'})

        const res = await personelStaff.save()

      })

      
     res.status(200).json({message:'Attendance Successfully Marked !!'})

})

authRoute.get('/guard/staff',protect,authorize, async (req,res,next)=>{
    console.log(req.query,req.user)

    
    const rest = await PersonalStaff.find({status:'active'})
    
    res.status(200).json(rest)
    
})
authRoute.put('/guard/staff-attendance',protect,authorize,async (req,res,next)=>{
    console.log(req.body,req.user)
    const {workerId,date,time} = req.body

    try {
    const result = await PersonelStaffAttendance.updateMany(
      { 
        workerId: workerId, 
        date: date, 
        locationStatus: 'inside' // Only update houses they haven't "checked out" of yet
      },
      { 
        $set: { 
          locationStatus: 'outside', 
          exitTime: time 
        } 
      }
    );

    console.log(result)

    const worker = await PersonalStaff.updateOne({
        workerId,
        locationStatus:'inside'
    }  ,{
        $set:{
            locationStatus: 'outside', 
        }
    })

    console.log(worker)


    
    res.status(200).json({ 
      success: true, 
      message: `Checked out from ${result.modifiedCount} houses.`,
      count: result.modifiedCount 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
})


authRoute.post('/guard/delivery',protect,authorize,async(req,res,next)=>{
    console.log(req.user,req.body,"Hell Lucy!!")

    const {company,flat,residentId,date,time,name,category,notifType} = req.body
    const title = `${company} Delivery`

    try {

        const resident = await Resident.findOne({residentId})
        if(!resident){
            console.log("not found!!")
            return res.status(404).json({message:"Resident Not Found !!"})
        }

        const newNotif = new Notifications({notifType,residentId,title,category,entryTime:time,entryDate:date})
        const saved = await newNotif.save()

        if(resident.fcmToken){
            try{
                await admin.messaging().send({
                    token: resident.fcmToken,
                    notification:{title:title,body:`${name} is at the gate for ${category}`},
                    data:{type:"Delivery",screen:"AllNotif"}
                })
            }catch(fcmError){
                console.error("FCM Error:",fcmError.message)
            }
        }

        res.status(201).json({message:"Delivery Created",data:saved})

    } catch (error) {
        console.log(error.message)
        res.status(500).json({message:"Server Error"})
    }
})


authRoute.post('/guard/service-staff',protect,authorize,async(req,res,next)=>{
  console.log(req.user,req.body)

  const {residentId,entryDate,entryTime,workerName,category}=req.body

  try{

    const resident=await Resident.findOne({residentId})
    if(!resident) return res.status(404).json({message:'Resident Not Found !!'})

    const title=`${category} entered !`

    const saved=await new Notifications({
      notifType:category,
      residentId,
      title,
      category:'utility',
      entryTime,
      entryDate
    }).save()

    if(resident.fcmToken){
      try{
        await admin.messaging().send({
          token:resident.fcmToken,
          notification:{
            title,
            body:`${workerName} entered from the gate`
          },
          data:{type:"Service",screen:"AllNotif"}
        })
      }catch(fcmError){
        console.error("FCM Error:",fcmError.message)
      }
    }

    res.status(201).json({message:"Service Staff Entry Created",data:saved})

  }catch(error){
    console.log(error.message)
    res.status(500).json({message:"Server Error"})
  }
})
exports.authRoute = authRoute