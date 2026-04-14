const {Resident,ResidentRequest,ResidentNotifications,ServiceStaff} = require('../model/residentModel')

const cloudinary = require('cloudinary').v2
const fetch = require("node-fetch")

const { getIO, getGuardSocketId } = require('../socket')
const customAlphabet = require('nanoid').customAlphabet

const fs = require('fs'); 

const admin = require('../firebase.js')

cloudinary.config({
  cloud_name: "dd5pdy82n",
  api_key: "397341551664711",
  api_secret: "G8Erp1raivFJyMChleae3nOXwpI"
});



exports.addResidentController = async (req,res,next)=>{

    console.log(req.body)
    console.log(req.file,'bedi')

    const { email, flat, id, members, name, password, phone, status, } = req.body;

    const photo ='https://res.cloudinary.com/dd5pdy82n/image/upload/v1774505644/wmnurnvn3iiydjwv1dor.jpg'

     try {

    // const result = await cloudinary.uploader.upload(req.file.path)

    // console.log(result.secure_url,"url to resident")

    
   try {

    const resident = new Resident({name,email,residentId:id,password,phoneNumber:phone,status,photo,flatNumber:flat})
    await resident.save()
    console.log("Success")

   } catch (error) {
    console.log(error,'bitch')
   }

    //  await PersonalStaff.findOneAndUpdate(
    //     {workerId },
    //     {
    //         $set: { photo: result.secure_url }
    //     },
    //     { new: true }
    //     );

    //     res.status(200).json({ message: "Photo Updated Successfully !",photoUrl:result.secure_url });

    

    
  } catch (error) {
    console.log(error)
    res.status(400).json({message:"photo cant be uploaded!"})
  }



//     console.log("Server hit!")

//    try {

//     const resident = new Resident({name,email,residentId:id,phoneNumber:phone,status,flatNumber:flat})
//     await resident.save()
//     console.log("Success")

//    } catch (error) {
//     console.log(error)
//    }

//     console.log(req.body,"We are at add resident controller!")
}


exports.authResidentController = async (req,res,next)=>{
    console.log(req.body,'ghj')

    const {phone,password,residentId,token} = req.body

    

    try {
 
    const resident = await Resident.findOne({ residentId });

    if (!resident) {
            console.log("Resident not exists ")

        }

        else if (resident.password !== password) {
            console.log("Password Not match!!")
        }
    
        else{
            
     
       const data =  await Resident.updateOne(
  { residentId },
  { $set: { fcmToken: token } }
)   


        res.status(200).json(data)

        }

    
    
    }catch(error){
        console.log(error)
     }


     


}




exports.sendPushNot2ResidentController = async (req, res, next) => {
  const { guardId, requestId, flat, purpose, phone, visitorName } = req.body;

  try {
    // 1. Find the Resident
    const residentId = `Res-${flat}`;
    const resident = await Resident.findOne({ residentId });

    console.log(resident)

    if (!resident) {
      // Clean up uploaded file if resident doesn't exist
      if (req.file) fs.unlinkSync(req.file.path);

      return res.status(404).json({ message: "Resident not found for this flat",success:false });
    }

    // 2. Upload Photo to Cloudinary
    let photoUrl = 'https://res.cloudinary.com/dd5pdy82n/image/upload/v1774505644/wmnurnvn3iiydjwv1dor.jpg';
    
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'visitors',
      });
      photoUrl = result.secure_url;
      // Clean up local temp file after successful upload
      fs.unlinkSync(req.file.path);
    }

    // 3. Save Request to Database
    const visitorDetails = {
      name: visitorName,
      phoneNumber: phone,
      photoUrl: photoUrl
    };

    const newRequest = new ResidentRequest({
      requestId,
      guardId,
      residentId,
      purpose,
      visitorDetails,
      flatNumber: flat
    });

    const savedRequest = await newRequest.save();

    // 4. Send Push Notification
    if (resident.fcmToken) {
      try {
        await admin.messaging().send({
          token: resident.fcmToken,
          notification: {
            title: "Gate Alert 🏠",
            body: `${visitorName} is at the gate for ${purpose}`
          },
          data: {
            type: "Visitor",
            requestId: String(requestId),
            screen: 'Notif',
            visitorName: String(visitorName),
            photoUrl: String(photoUrl)
          }
        });
      } catch (fcmError) {
        console.error("FCM Error:", fcmError.message);
        // We don't return error here because the DB record is already saved
      }
    }

    // 5. Success Response
    return res.status(200).json({
      success: true,
      message: "Notification sent to resident",
      data: savedRequest
    });

  } catch (error) {
    console.error("Controller Error:", error);
    
    // Clean up local file if an error occurs during processing
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};
exports.getNotifInfoController =async (req,res,next)=>{

  const {requestId} = req.query
  
  try {
  const result = await ResidentRequest.findOne({requestId})

  res.status(200).json(result)

  } catch (error) {
    res.status(500)
  }

}


exports.respondRequestController = async (req,res,next)=>{

  

  console.log(req.body,'Action done by resident holy crab!!!')

  const {requestId,action} = req.body

  try {
  const request = await ResidentRequest.findOne({requestId})

  request.status = action


  const response = await request.save()



  
  const io = getIO()
  const socketId = getGuardSocketId(request.guardId)

  

   if (socketId) {
    io.to(socketId).emit("respondRequest", {status:action,requestId});
  } else {
    console.log("Guard not online");
  }


  console.log(response,'saved !!!!!!!')

  res.status(200).json(response)
  } catch (error) {
    console.log(error)
  }

}

exports.getResidentNotifController = async (req,res,next)=>{
  console.log(req.query)
  const {residentId} = req.query

  const rest = await ResidentNotifications.findOne({residentId})
  console.log(rest)
  res.status(200).json(rest)
}

exports.addServiceStaffController = async (req,res,next)=>{
  console.log(req.body)

  const {workerName,flat,entryTime,category,serviceStaffId} = req.body

  const newStaff = new ServiceStaff({workerName,flat,entryTime,category,serviceStaffId})

  const rest = await newStaff.save()

  
  
  const resident = await Resident.findOne({residentId:"Res-B402"})
  
  const residentId = 'RES-B402'

  const ret=  await ResidentNotifications.updateOne(
                   { residentId},
                   { $push: { notifList: { name:workerName, category, entryTime } } }
               );

               console.log(ret)



  const token = resident.fcmToken

  const response = await admin.messaging().send({
               token,
               notification: {
                 title:`${category} entered`,
                 body: `Name ${workerName}`
             
               },
               data: {
                 type:category,
                 screen:'NotifList',
                 name:workerName
               }
   })

   console.log(rest)

   res.status(200).json(rest)
}

exports.setAllSerStaffController = async (req,res,next)=>{
  console.log("Hit----------------------------------------------------")
  const remainStaff = await ServiceStaff.find({locationStatus:'inside'})
  res.status(200).json(remainStaff)
}

exports.exitServiceStaffController = async (req,res,next)=>{
  try {
  console.log(req.body)

  const {serviceStaffId} = req.body
  const ret=  await ServiceStaff.updateOne(
                   { serviceStaffId},
                   { $set: { locationStatus: 'outside' } }
               );
  res.status(200).json({message:'Service Staff Exited',serviceStaffId})

  } catch (error) {
    
  }
}