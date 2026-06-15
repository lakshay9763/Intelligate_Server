const express = require('express');
const multer = require('multer');

const { Resident, VisitorPass, Notifications } = require('../model/resident.model.js');
const admin = require('../firebase.js');
const { DelievryMovement, UtilityMovement, VisitorMovement ,BiometricData} = require('../model/gate.model.js');
const { Staff, StaffMovement } = require('../model/staff.model.js');
const { UtilityWorker } = require('../model/utility.model.js');

const { protectGate } = require('../middleware/auth.js');
const { authorize } = require('../middleware/roleCheck.js');
const { GetMasterList, AddDevice, VerifyResident, CreateVisitorPass, GetVisitorPass } = require('../controller/gate.controller.js');
const uploadImage = require('../utils/cloudinary.upload.js');

const upload = multer({ dest: 'uploads/' });

const gateRoute = express.Router();

// Helper function to capitalize strings safely
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// ==========================================
// Gate Device & Resident Setup
// ==========================================
gateRoute.post('/add-device', AddDevice);
gateRoute.get('/verify-resident', protectGate, VerifyResident);
gateRoute.get('/resident-master-list', protectGate, GetMasterList);

// ==========================================
// Visitor Passes
// ==========================================
gateRoute.post('/visitor-pass', upload.single('image'), protectGate, authorize, CreateVisitorPass);
gateRoute.get('/visitor-pass', protectGate, authorize, GetVisitorPass);

gateRoute.get('/verify-visitor-qr', protectGate, authorize, async (req, res, next) => {
  try {
    const { passId } = req.query;
    const now = new Date();

    const pass = await VisitorPass.findOne({ passId });
    if (!pass) {
      return res.status(404).json({ success: false, message: 'Invalid Visitor Pass' });
    }

    const passExpiredDate = new Date(pass.endDate);
    passExpiredDate.setHours(23, 59, 59, 999);

    if (now > passExpiredDate) {
      return res.status(400).json({ success: false, message: 'Pass has expired!' });
    }
    if (pass.isCancelled) {
      return res.status(400).json({ success: false, message: `Pass is cancelled by resident ${pass.cancelledBy || ''}` });
    }

    const { name, familyId, memberId, phone, purpose } = pass;
    const resident = await Resident.findOne({ familyId, memberId }, 'name fcmToken -_id').lean();

    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    const formattedTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    await Notifications.create({
      familyId,
      title: `Visitor Entry: ${name}`,
      description: `QR Pass from ${resident.name}`,
      category: 'visitor',
      notifType: 'visitor',
      entryTime: formattedTime,
      approvedBy: memberId,
      personDetails: { name, phone }
    });

    await VisitorMovement.create({
      passId,
      name,
      familyId,
      phone,
      passStartDate: pass.visitDate,
      passEndDate: pass.endDate,
      purpose
    });

    res.status(200).json({ success: true, message: `Entry allowed for ${name}` });

    // Background FCM Task
    if (resident.fcmToken) {
      admin.messaging().send({
        token: resident.fcmToken,
        notification: {
          title: `Visitor Entry: ${name}`,
          body: `Verified by QR code shared by ${resident.name}`
        },
        data: { type: 'visitor', screen: 'AllNotif' }
      }).catch(err => console.error('FCM Error:', err.message));
    }

  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

gateRoute.put('/visitor', protectGate, authorize, async (req, res, next) => {
  try {
    const { documentId } = req.body;
    const updatedVisitor = await VisitorMovement.findByIdAndUpdate(
      documentId,
      { $set: { status: 'COMPLETED', exitTime: new Date() } },
      { new: true }
    );

    if (!updatedVisitor) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    res.status(200).json({ success: true, message: 'Visitor exited.', data: updatedVisitor });
  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false });
  }
});

gateRoute.get('/active-visitor', protectGate, authorize, async (req, res, next) => {
  try {
    const fcmList = await VisitorMovement.find({ status: 'IN_PROGRESS', passId: null }).sort({ entryTime: -1 });

    if (!fcmList) {
      return res.status(404).json({ success: false, message: 'No active visitor' });
    }

    const now = new Date();
    const allActivePasses = await VisitorPass.find({ endDate: { $gte: now }, status: 'active' });
    const activePassIds = allActivePasses.map(pass => pass.passId);

    const passCounts = await VisitorMovement.aggregate([
      {
        $match: {
          requestId: null,
          passId: { $in: activePassIds },
          status: 'IN_PROGRESS'
        }
      },
      {
        $group: {
          _id: '$passId',
          inProgressCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          passId: '$_id',
          inProgressCount: 1
        }
      }
    ]);

    const finalCounts = activePassIds.map(id => {
      const found = passCounts.find(p => p.passId === id);
      return {
        passId: id,
        inProgressCount: found ? found.inProgressCount : 0
      };
    });

    res.status(200).json({ success: true, data: { fcmList, passList: allActivePasses, passCounts: finalCounts } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// Service Staff & Utility
// ==========================================
gateRoute.post('/service-staff', protectGate, authorize, async (req, res, next) => {
  try {
    const { familyId, memberId, name, type, photo, utilityId, otherType } = req.body;
    const resident = await Resident.findOne({ familyId, memberId });

    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const capitalType = capitalize(type);
    const capitalName = capitalize(name);

    await Notifications.create({
      familyId,
      title: `${capitalType} Entry: ${capitalName}`,
      description: `booked by ${resident.name}`,
      category: 'utility',
      notifType: type,
      entryTime: formattedTime,
      approvedBy: memberId,
      personDetails: { name,photo }
    });

    const utility = await UtilityMovement.create({
      familyId,
      type,
      othertype: otherType,
      name,
      photo,
      utilityId
    });

    res.status(201).json({ success: true, data: utility });

    if (resident.fcmToken) {
      admin.messaging().send({
        token: resident.fcmToken,
        notification: {
          title: `${type} entered: ${name}`,
          body: `booked by ${resident.name}`
        },
        data: { type: 'utility', screen: 'AllNotif' }
      }).catch(err => console.error('FCM Error:', err.message));
    }

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

gateRoute.put('/service-staff', protectGate, authorize, async (req, res, next) => {
  try {
    const { utilityId } = req.body;
    const utility = await UtilityMovement.findById(utilityId);

    if (!utility) {
      return res.status(404).json({ success: false, message: 'Entry not exists' });
    }

    if (utility.status !== 'IN_PROGRESS') {
      return res.status(400).json({ success: false, message: 'Already exited' });
    }

    utility.status = 'COMPLETED';
    utility.exitTime = Date.now();
    await utility.save();

    return res.status(200).json({ success: true, data: utility, message: 'Exit successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

gateRoute.get('/pending-utility', protectGate, authorize, async (req, res, next) => {
  try {
    const utilities = await UtilityMovement.find({ status: 'IN_PROGRESS' }).lean();
    if (!utilities || utilities.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending utilities not found' });
    }
    res.status(200).json({ success: true, data: utilities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

gateRoute.post('/register-utility', upload.single('image'), protectGate, authorize, async (req, res, next) => {
  try {
    const { name, phone, tasks, category, otherType } = req.body;

    const exists = await UtilityWorker.findOne({ phone });
    if (exists) {
      return res.status(409).json({ message: `Phone number is already registered.` });
    }

    let parsedScope = [];
    try {
      parsedScope = typeof tasks === 'string' ? JSON.parse(tasks) : tasks;
    } catch (e) {
      parsedScope = tasks ? [tasks] : [];
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadImage(req.file);
    }

    const utility = new UtilityWorker({ 
      name, 
      phone, 
      photo: imageUrl, 
      category, 
      otherType, 
      registeredBy: 'GUARD', 
      tasks: parsedScope 
    });

    await utility.save();

    res.status(200).json({ success: true, data: utility });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({ success: false, message: `${field} is already registered.` });
    }
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

gateRoute.get('/utility-master-list', protectGate, authorize, async (req, res, next) => {
  try {
    const utility = await UtilityWorker.find().lean();
    res.status(200).json({ success: true, data: utility });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// Deliveries
// ==========================================
gateRoute.post('/delivery', protectGate, authorize, async (req, res, next) => {
  try {
    const { company, familyId, memberId, riderName, category, notifType } = req.body;
    const resident = await Resident.findOne({ familyId, memberId });

    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const capitalType = capitalize(notifType);

    await Notifications.create({
      familyId,
      title: `${capitalType} for ${resident.name}`,
      description: `${company} order logged at gate.`,
      category,
      notifType: notifType,
      entryTime: formattedTime,
      approvedBy: memberId,
      personDetails: { name: riderName, company }
    });

    const delivery = await DelievryMovement.create({
      familyId,
      riderName,
      company,
    });

    res.status(201).json({ success: true, data: delivery });

    if (resident.fcmToken) {
      admin.messaging().send({
        token: resident.fcmToken,
        notification: {
          title: `${capitalType} for ${resident.name}`,
          body: `${company} order logged at gate.`
        },
        data: { type: 'delievry', screen: 'AllNotif' }
      }).catch(err => console.error('FCM Error:', err.message));
    }

  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

gateRoute.put('/delivery', protectGate, authorize, async (req, res, next) => {
  try {
    const { deliveryId } = req.body;
    const delivery = await DelievryMovement.findById(deliveryId);

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Entry not exists' });
    }

    if (delivery.status !== 'IN_PROGRESS') {
      return res.status(400).json({ success: false, message: 'Already exited' });
    }

    delivery.status = 'COMPLETED';
    delivery.exitTime = Date.now();
    await delivery.save();

    return res.status(200).json({ success: true, data: delivery, message: 'Exit successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

gateRoute.get('/pending-deliveries', protectGate, authorize, async (req, res, next) => {
  try {
    const delivery = await DelievryMovement.find({ status: 'IN_PROGRESS' }).lean();
    if (!delivery || delivery.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending deliveries not found' });
    }
    res.status(200).json({ success: true, data: delivery });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// Society Staff & Track Staff
// ==========================================
gateRoute.get('/staff', protectGate, authorize, async (req, res, next) => {
  try {
    const staff = await Staff.find({ status: 'active' }).lean();
    res.status(200).json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

gateRoute.get('/staff-master-list', protectGate, authorize, async (req, res, next) => {
  try {
    const staffs = await Staff.find().lean();
    const activeStaff = await StaffMovement.find({ status: 'IN_PROGRESS' }).lean();

    if (!staffs) {
      return res.status(404).json({ success: false, message: 'No staff exists !!' });
    }

    const staffAfterActiveFilter = staffs.map(st => {
      const isInside = activeStaff.some(stf => st.staffId === stf.staffId);
      return {
        ...st,
        isInside: isInside ? 1 : 0
      };
    });

    res.status(200).json({ success: true, data: staffAfterActiveFilter });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

gateRoute.post('/track-staff', protectGate, authorize, async (req, res, next) => {
  try {
    const { staffId } = req.body;
    const staff = await Staff.findOne({ staffId });
    
    if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff member not found.'});
    }

    const existing = await StaffMovement.findOne({ staffId, status: 'IN_PROGRESS' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Already marked inside' });
    }

    const staffEntry = await StaffMovement.create({
      staffId,
      name: staff.name,
      phone: staff.phone,
      type: staff.category,
      photo: staff.photo
    });

    res.status(200).json({ success: true, data: staffEntry });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

gateRoute.put('/track-staff', protectGate, authorize, async (req, res, next) => {
  try {
    const { staffId } = req.body;
    const staff = await StaffMovement.findOne({ staffId, status: 'IN_PROGRESS' });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Entry not exists' });
    }

    staff.status = 'COMPLETED';
    staff.exitTime = Date.now();
    await staff.save();

    return res.status(200).json({ success: true, data: staff, message: 'Exit successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

gateRoute.get('/track-staff', protectGate, authorize, async (req, res, next) => {
  try {
    const staff = await StaffMovement.find({ status: 'IN_PROGRESS' }).lean();
    if (!staff || staff.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending Staff not found' });
    }
    res.status(200).json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

gateRoute.post('/staff-vacency', upload.single('image'), protectGate, authorize, async (req, res, next) => {
  try {
    const { name, phone, tasks, category, otherType } = req.body;

    const existing = await Staff.findOne({ phone });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Staff already exists with this phone' });
    }

    let parsedScope = [];
    try {
      parsedScope = typeof tasks === 'string' ? JSON.parse(tasks) : tasks;
    } catch (e) {
      parsedScope = tasks ? [tasks] : [];
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadImage(req.file);
    }

    const staff = new Staff({
      name,
      phone,
      scopeOfWork: parsedScope,
      category,
      otherType,
      registeredBy: 'GUARD',
      photo: imageUrl,
    });

    await staff.save();

    return res.status(201).json({ success: true, message: 'Staff registered successfully', data: staff });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', success: false });
  }
});

// ==========================================
// Todays Gate Logs
// ==========================================
gateRoute.get('/todays-log', protectGate, authorize, async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const timeAndExitedFilter = { entryTime: { $gte: startOfDay, $lte: endOfDay }, status: 'COMPLETED' };
    const timeAndExitedRejectedFilter = { entryTime: { $gte: startOfDay, $lte: endOfDay }, status: { $in: ['COMPLETED', 'REJECTED'] }, passId: null };

    const [delievries, utilities, staffs, visitors] = await Promise.all([
      DelievryMovement.find(timeAndExitedFilter).lean(),
      UtilityMovement.find(timeAndExitedFilter).lean(),
      StaffMovement.find(timeAndExitedFilter).lean(),
      VisitorMovement.find(timeAndExitedRejectedFilter).lean()
    ]);

    const normalizeDelievry = delievries.map(item => ({
      ...item,
      logType: 'delivery',
      displayName: item.riderName,
      displayCategory: item.company
    }));

    const normalizeUtility = utilities.map(item => ({
      ...item,
      logType: 'utility',
      displayName: item.name,
      displayCategory: item.othertype || item.type
    }));

    const normalizeStaffs = staffs.map(item => ({
      ...item,
      logType: 'staff',
      displayName: item.name,
      displayCategory: item.category || 'default'
    }));

    const normalizeVisitorRequests = visitors.map(item => ({
      ...item,
      logType: 'visitor',
      displayName: item.name,
      purpose: item.purpose,
      displayCategory: 'visitor'
    }));

    const combinedLogs = [...normalizeDelievry, ...normalizeUtility, ...normalizeStaffs, ...normalizeVisitorRequests].sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime));

    res.status(200).json({ success: true, data: combinedLogs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



gateRoute.post('/face/register', upload.single('image'), async (req, res) => {
  try {
    const { id, name, actorType, role } = req.body;


    if (!req.body.embedding) {
      return res.status(400).json({ success: false, message: "Missing embedding vector array." });
    }

    // convert json array to real array 
    const vectorArray = JSON.parse(req.body.embedding);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "Missing cropped face image file." });
    }

    
    const vectorizeId = `${actorType.toLowerCase()}_${id}`;

    const imageUri = await uploadImage(req.file)

    const payloadForCloudflare = {
      id: vectorizeId,
      vector: vectorArray,
      metadata: {
        name: name,
        type: actorType.toLowerCase(), // resident, staff, utility
        role: role,                   // Maid, Plumber, Tenant, etc.
        photo: imageUri,
      }
    };

    const cloudflareResponse = await fetch('https://faceworker.lakshay9763.workers.dev/insert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payloadForCloudflare)
    });

    const cloudflareData = await cloudflareResponse.json();

    if (cloudflareData.success) {

      const dualSave = await BiometricData.findOneAndUpdate({ vectorizeId:vectorizeId},{
        name,
        type:actorType.toLowerCase(),
        role:role,
        photo:imageUri
      },
        {
          upsert:true, // if exists update it , if not  create it
          new:true
        }
      )


      

      return res.status(200).json({
        success: true,
        message: "Successfully synchronized biometrics to cloud intelligence layer.",
        data:dualSave
      });
    } else {
      throw new Error(cloudflareData.error || "Cloudflare engine rejected the record entry.");
    }

  } catch (error) {
    console.error("[IntelliGate Error] Registration failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error running biometric registration pipeline.",
      error: error.message
    });
  }
});

gateRoute.post('/face/search', async (req, res) => {
    try {
        const { embedding } = req.body;
        
        if (!embedding) {
            return res.status(400).json({ success: false, message: "No embedding provided" });
        }

        const vectorArray = typeof embedding === 'string' ? JSON.parse(embedding) : embedding;

        const cloudflareResponse = await fetch('https://faceworker.lakshay9763.workers.dev/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vector: vectorArray })
        });

        const cloudflareData = await cloudflareResponse.json();


        console.log(cloudflareData,'not')

        // 2. Check if we found a match and if the confidence is high enough
        if (cloudflareData.matches && cloudflareData.matches.length > 0) {
            const bestMatch = cloudflareData.matches[0];
            
            if (bestMatch.score >= 0.50) {
                
                // 3. Match found! Get the clean profile from MongoDB
                const profile = await BiometricData.findOne({ vectorizeId: bestMatch.id });

                if (profile) {
                    return res.status(200).json({ 
                        success: true, 
                        isMatch: true, 
                        score: bestMatch.score,
                        profile: profile 
                    });
                }
            }
        }

        // 4. If no match passed the threshold
        return res.status(200).json({ 
            success: true, 
            isMatch: false, 
            message: "Unrecognized Person" 
        });

    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).json({ success: false, message: "Server search failed." });
    }
});


module.exports = gateRoute;
