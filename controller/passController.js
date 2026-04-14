const { Passes, Passes_Info,Vehiles_Add ,StaffPasses,StaffPassesInfo,PersonalStaff} = require("../model/passModel");
const { Worker2Resident } = require("../model/residentModel");
const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: "dd5pdy82n",
  api_key: "397341551664711",
  api_secret: "G8Erp1raivFJyMChleae3nOXwpI"
});


exports.passController = async (req,res,next)=>{

    

    console.log(req.body)
    console.log("Serwor works access")

    let {residentID,vehicleNumber,vehicleType} = req.body;
   
    const {plateNumber} = req.body
    

    if(residentID != null){

        vehicleNumber = vehicleNumber.toUpperCase()

        console.log("hello lucifer")


        const residentVehicles = new Vehiles_Add({residentId:residentID,vehicleNumber,vehicleType})

        try {
            const response = await residentVehicles.save()
            console.log(response,"Saved to mongo successfully")
            res.status(200).json({ message: "Data received successfully!"})
        
            next()

        } catch (error) {
             console.log(error.errors,"someerror comes 12345")
        }
       
    }else if (plateNumber!=null){
        try {
           const vehicleNumber = plateNumber

            const foundVehicle = await Vehiles_Add.findOne({ vehicleNumber })

            console.log(foundVehicle)

            if (!foundVehicle) { return res.status(404).json({ success: false, message: "Not a resident Vehicle" }); }

            return res.status(200).json({success:true,message:"Resident Vehicle"})



        } catch (error) {
            console.log(error)
        }



    }
    else {
        const {passId,residentId,visitorName,visitorCount,phone,passType,purpose,duration,visitDate,flatNumber,status,entryAllowed,createdAt}  = req.body

    // const block = new Block({societyId,blockName});  // collection name

    const passes = new Passes({ passId,flatNumber,createdAt});
    const passInfo = new Passes_Info({passId,visitorName,visitorCount,phone,purpose,visitDate,duration})
    try {
        const res1 =await passes.save()
        const res2 =await passInfo.save()
        console.log(res1,res2,"successfulll")
        res.status(200).json({ message: "Data received successfully!"})
        
        next()

    } catch (error) {
        console.log(error.errors,"someerror comes 1234")
    }

    }

    
}

exports.verifyPassController = async (req, res, next) => {

    const {vehicleNumber} = req.body 

    if(vehicleNumber!=null){
        console.log(req.body,"yey")
    }else{

        try {
    const {passId} = req.body
    
    const pass = await Passes.findOne({passId})

    console.log(pass)

    if (!pass) { return res.status(404).json({ success: false, message: "Pass not found" }); }

    else if (!pass.entryAllowed){
        pass.status = "Approved"
        pass.entryAllowed = true
        pass.entryTime = new Date().toLocaleTimeString();
        await pass.save()

        

        return res.json({ success: true, message: "Entry allowed" });

    }else{
        return res.status(400).json({ success: false, message: "Pass already used" });
    }



  } catch (error) {
    console.log(error)
  }
    }
  
}



const PassDate = (selectedDate) => {

  const date = new Date()

      switch (selectedDate) {
        case 'today' : break;
        case 'tomorrow' : date.setDate(date.getDate() + 1);
        break;
        case 'day2' : date.setDate(date.getDate()+2);
        break;
        case 'day3' : date.setDate(date.getDate()+3);
        break;
      }

      date.setHours(9, 0, 0, 0);

      return date
  }

  // plumbers carpenters electricians 

exports.staffPassController = async (req,res,next)=>{

    const {
        residentId,
        gateCode,
        flatNo,
        workerName,
        service,
        work,
        selectedDate,
        selectedTime,
        phone,
    } = req.body


    console.log(req.body,"rtyuio")

    const visitDate = PassDate(req.body.selectedDate);

    const StaffPass = new StaffPasses({gateCode,workerName,flatNo,jobType:service,workDate:visitDate});

    const StaffPassInfo = new StaffPassesInfo({residentId,gateCode,workerName,workDate:visitDate,jobType:service});

    try {
        const res1 = await StaffPass.save()
        const res2 = await StaffPassInfo.save()

        console.log(res1,res2,"Success For worker")
        res.status(200).json({message:"Success to staff"})
    } catch (error) {
        res.status(400)
    }

    
 
}

exports.staffPassHistoryController = async (req,res,next)=>{
    const {residentId} = req.query
    

    try {
        const findResult = await StaffPassesInfo.find({residentId}).sort({ createdAt: -1 })
        res.status(200).json(findResult)
        // console.log(findResult)
    } catch (error) {
        res.status(500).json({ message: "Error fetching data", error });
    }


}


exports.addResidentVehicleController = async (req,res,next)=>{
    console.log(req.body)

    
    const vehicle = new Vehiles_Add(req.body);
    
    try {
        
        const res2 =await vehicle.save()
        console.log(res2,"successfulll")
        res.status(200).json({ message: "Data received successfully!"})
        
        next()

    } catch (error) {
        console.log(error.errors,"someerror comes")
    }
}

exports.addNewPersonalStaffController = async (req,res,next)=>{

    console.log(req.body)

    const {workerId,residentId,category,since,entryAllowed,status,name,phone,salary,shift,schedule,tasks,photo,flat} = req.body


    const personalStaff = new PersonalStaff({workerId,residentId,name,category,entryAllowed,phone,photo,salary,schedule,shift,since,status,tasks,flat})
    const res2staf= new Worker2Resident({workerId,residentList:{
        residentId
    }})
    try {
        const response = await personalStaff.save()
        const restt = await res2staf.save()

        console.log(restt,'success Elephant')
        res.status(200).json(response)
    } catch (error) {
        console.log(error)
        res.status(400).json({message:"Error"})
    }

//     {
//   workerId: 'WRK-MMPXUIEC',
//   residentId: 'RES-B204',
//   category: 'maid',
//   since: 'Mar 2026',
//   entryAllowed: true,
//   status: 'active',
//   name: 'Sunita',
//   phone: '55802580',
//   salary: '500',
//   shift: 'All day',
//   schedule: {
//     Mon: true,
//     Tue: true,
//     Wed: false,
//     Thu: true,
//     Fri: false,
//     Sat: true,
//     Sun: false
//   },
//   tasks: [ 'Cleaning' ],
//   photo: null
// }
}

exports.fetchAllPersonalStaffController = async (req,res,next)=>{
    try {
  const { residentId } = req.query;

  const data = await PersonalStaff.find({ residentId });

  console.log(data)

  res.status(200).json({
   data
  });

} catch (error) {
  res.status(500).json({
    message: "Server error"
  });
}
   
}

exports.updatePersonalStaffScheduleController = async (req,res,next)=>{
    console.log(req.body)
    const {residentId,workerId,schedule} = req.body

    try {
        const updateDoc = await PersonalStaff.findOneAndUpdate({residentId,workerId},{$set : {schedule:schedule}},{new:true})
        console.log(updateDoc,"sitch")
        res.status(200).json({message:"Schedule updated successfully"})
    } catch (error) {
        
    }
}

exports.updateEntryAllowedController = async (req,res,next)=>{
    console.log(req.body,"gghgh")

    const {residentId,workerId,action} = req.body

    

    try {
        if(action==='blockEntry'){
        const response = await PersonalStaff.findOneAndUpdate({residentId,workerId},{$set : {entryAllowed:false}},{new:true})
        res.status(200).json({message:"Successfully Blocked"})
        console.log(response,'sdfghjk')
        }else if(action==='allowEntry'){
             const response = await PersonalStaff.findOneAndUpdate({residentId,workerId},{$set : {entryAllowed:true}},{new:true})
        res.status(200).json({message:"Successfully Allow"})
        console.log(response,'sdfghjk')
        }
        
       
    } catch (error) {
        res.status(400).json({message:"Error Comes"})
       
    }
}

exports.updateStaffAttendanceController = async (req,res,next)=>{
        console.log(req.body,'helll......!!')

         const {residentId,workerId,entryDate,entryTime} = req.body

        const existing = await PersonalStaff.findOne({
        residentId,
        workerId,
        "attendance.date": entryDate
        });

        if (existing) {
            console.log(existing,'exists')
        return res.status(200).json({ message: "Attendance already marked for today" });
        }

        console.log("Not found!",residentId)


        const newAttendance = {
        date: entryDate,
        status: "present", // or dynamic
        timeIn: entryTime, // optional
        arrivalStatus: "on-time"};

        await PersonalStaff.findOneAndUpdate(
        { residentId, workerId },
        {
            $push: { attendance: newAttendance }
        },
        { new: true }
        );

        res.status(200).json({ message: "Attendance added successfully" });

            
}


exports.updateStaffPhotoController = async (req,res,next)=>{

  console.log("API HIT 🔥");
  console.log("FILE:", req.file); 
  console.log("BODY:", req.body.workerId);

  const {workerId} = req.body


  try {

    const result = await cloudinary.uploader.upload(req.file.path)

    console.log(result.secure_url,"url to staff")

     await PersonalStaff.findOneAndUpdate(
        {workerId },
        {
            $set: { photo: result.secure_url}
        },
        { new: true }
        );

        res.status(200).json({ message: "Photo Updated Successfully !",photoUrl:result.secure_url });

    
  } catch (error) {
    console.log(error)
    res.status(400).json({message:"photo cant be uploaded!"})
  }
}

/// maids driver cooks nanny


