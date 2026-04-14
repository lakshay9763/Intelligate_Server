
const { Passes, Passes_Info,PersonalStaff } = require('../model/passModel');
const {Worker2Resident,ResidentNotifications,Resident} = require('../model/residentModel')

const admin = require('../firebase');
const e = require('cors');


exports.updateLocationStatusController = async (req, res, next) => {

  

  try {
    console.log(req.body, "workdone")


    const { workerId, guardId, locationStatus,entryDate,entryTime ,name,category} = req.body;

   
    const newStatus = locationStatus === "outside" ? "inside" : "outside";

    

   
    const updated = await PersonalStaff.updateMany(
      { workerId, locationStatus },
      { $set: { locationStatus: newStatus } }
    );

    const message = locationStatus==='inside' ? 'Exit Successfully' : 'Entry Successfull'

    if(newStatus==='inside'){
        const existing = await PersonalStaff.findOne({
        workerId,
        "attendance.date": entryDate
        });

        if (existing) {
           console.log("Already Exists")
         

        
           const {residentList} = await Worker2Resident.findOne({ workerId })

           console.log(residentList,'Pubgg!')

           residentList.forEach(async (element) => {
            
            const {residentId} = element                 
 
             const resident = await Resident.findOne({
               residentId
             })

             const token = resident.fcmToken

             const ret=  await ResidentNotifications.updateOne(
                   { residentId},
                   { $push: { notifList: { name, category, entryTime } } }
               );
              


            const rest = await admin.messaging().send({
             token: token,                                        // 3
             notification: {
               title:`${category} entered`,
               body: `Name ${name}`
           
             },
             data: {
               type:category,
               screen:'NotifList',
               name
             }
           })




           });

      
          }


        }
        
        else{

        const newAttendance = {
        date: entryDate,
        status: "present", // or dynamic
        timeIn: entryTime, // optional
        arrivalStatus: "on-time"};

        
        const restt = await PersonalStaff.updateMany(
        { workerId },
        {
            $push: { attendance: newAttendance }
        },
        { new: true }
        );

        console.log(restt,'Attendance Marked')

        }


        
    

   
    res.status(200).json({
      workerId,
      guardId,
      locationStatus: newStatus,
      message,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }



    // console.log(req.body)
    //  const { workerId, guardId, locationStatus,entryDate,entryTime } = req.body;

  
    // const w2r = new Worker2Resident({workerId,residentList:[{residentId:"RES-B204",fcmToken:"eo5ZKWNgQrSV51FzcEG8eK:APA91bFYllXr6dzbUWbZ7Wk6InST8OxlI4NaGviLX9W1tHWtWnK0kd84MdR9U03FoeeRf9lf9LwbKwNTDxxGUfmyT0XzesJ-vbgWax4eVv4vG83THPd2Crg"}]})

    // const restt = await w2r.save()
    // console.log(restt)
}