const express = require('express');
// const fetch = require("node-fetch");
const axios = require("axios")

const multer = require("multer")

const cloudinary = require('cloudinary').v2

const { passController, addResidentVehicleController, staffPassController, staffPassHistoryController, addNewPersonalStaffController, fetchAllPersonalStaffController, updatePersonalStaffScheduleController, updateEntryAllowedController, updateStaffAttendanceController, updateStaffPhotoController } = require('../controller/passController');
const { verifyPassController } = require('../controller/passController');

const passRoute = express.Router();



cloudinary.config({
  cloud_name: "dd5pdy82n",
  api_key: "397341551664711",
  api_secret: "G8Erp1raivFJyMChleae3nOXwpI"
});


passRoute.post('/addVisitorPass',passController);

passRoute.post('/verifyVisitorPass',verifyPassController)

passRoute.post('/addResidentVehicles',(req,res,next)=>{
    console.log(req.body,"bolid")
    res.status(200).json({ message: "Data received successfully!"})
    

})

passRoute.post('/addStaffPass',staffPassController)

passRoute.get('/fetchStaffHistory',staffPassHistoryController)


passRoute.post('/addPersonalStaff',addNewPersonalStaffController)

passRoute.get('/fetchAllPersonalStaff',fetchAllPersonalStaffController)

passRoute.post('/updatePersonalStaffSchedule',updatePersonalStaffScheduleController)

passRoute.post('/updateEntryAllowedStatus',updateEntryAllowedController)

passRoute.post('/addfaceembedding2server',async (req,res,next)=>{
    try {
    const { workerId, vector } = req.body;


   console.log("Hit sending")
    const response = await axios.post(
      "https://faceworker.lakshay9763.workers.dev/insert", // your worker URL
      {
        id: workerId,
        vector: vector,
      }
    );

    // const response = await axios.post(
    //   "https://face-worker.lakshay9763.workers.dev/search",
    //   { vector }
    // );

    console.log(response.data,'evil ...!')

    res.json(response.data);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Insert failed" });
  }
})


passRoute.post('/comparefaceembedding',async (req,res,next)=>{
    try {
    const { vector } = req.body;



    console.log('evil ...!',vector.length)

    
    // const response = await axios.post("https://faceworker.lakshay9763.workers.dev/delete",{id:"WRK-MNVP5SQT"}) //{ vector }, { timeout: 10000 });
    // // res.json(response.data);
    // console.log(response)


    const response = await axios.post("https://faceworker.lakshay9763.workers.dev/search", { vector }, { timeout: 10000 });
    res.json(response.data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Insert failed" });
  }
})


passRoute.post('/updateStaffAttendance',updateStaffAttendanceController)



const upload = multer({dest:"uploads/"})

passRoute.post('/updateStaffPhoto',upload.single("image"), updateStaffPhotoController)






// {
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

exports.passRoute = passRoute