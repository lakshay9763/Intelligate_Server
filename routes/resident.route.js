const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

const { Resident, VisitorPass, Notifications, ResidentQR } = require('../model/resident.model.js');
const { Staff, StaffAffiliation, StaffMovement, PersonelStaffAttendance } = require('../model/staff.model.js'); // Ensure PersonelStaffAttendance is exported here
const { VisitorRequest, VisitorMovement } = require('../model/gate.model.js');
const { UtilityWorker } = require('../model/utility.model.js');

const { protect } = require('../middleware/auth.js');
const { authorize } = require('../middleware/roleCheck.js');
const { getGateDeviceSocketId, getIO } = require('../socket.js');
const uploadImage = require('../utils/cloudinary.upload.js');

const upload = multer({ dest: 'uploads/' });

// ALWAYS use environment variables for sensitive keys in production
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const residentRoute = express.Router();

residentRoute.get('/', protect, authorize, async (req, res, next) => {
  try {
    const { memberId, familyId } = req.user;
    const resident = await Resident.findOne({ memberId, familyId });

    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found.' });
    }

    res.status(200).json({ success: true, data: resident });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

residentRoute.patch('/update-photo', protect, authorize, upload.single('image'), async (req, res, next) => {
  try {
    const { familyId, memberId } = req.user;
    let imageUrl = null;

    if (req.file) {
      try {
        imageUrl = await uploadImage(req.file);
      } catch (uploadError) {
        return res.status(500).json({ success: false, message: 'Image upload failed. Try again.' });
      }
    }

    const updatedPhoto = await Resident.findOneAndUpdate(
      { familyId, memberId },
      { $set: { photo: imageUrl } },
      { new: true }
    );

    res.status(200).json({ success: true, message: 'Image updated successfully.', data: updatedPhoto });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

residentRoute.post('/family', protect, authorize, async (req, res, next) => {
  try {
    const { name, phone, phase, block, plot, floor, password, relation, role } = req.body;
    const { familyId } = req.user;

    const resident = new Resident({ name, phone, role, familyId, phase, block, plot, floor, password, relation });
    await resident.save();

    res.status(200).json({ success: true, message: 'Family member added successfully!' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

residentRoute.get('/family', protect, authorize, async (req, res, next) => {
  try {
    const { familyId } = req.user;
    const familyMembers = await Resident.find({ familyId });

    res.status(200).json({ success: true, data: familyMembers, message: 'Family members found!' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

residentRoute.post('/visitor-pass', protect, authorize, async (req, res, next) => {
  try {
    const { name, phone, visitDate, endDate, purpose } = req.body;
    const { familyId, memberId } = req.user;

    const endDate12AM = new Date(endDate);
    endDate12AM.setHours(23, 59, 59, 999);

    const visitor = new VisitorPass({
      name,
      phone,
      visitDate,
      endDate: endDate12AM,
      purpose,
      familyId,
      memberId,
      createdBy: memberId
    });

    const savedVisitor = await visitor.save();

    res.status(201).json({ success: true, data: savedVisitor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

residentRoute.post('/staff', protect, authorize, upload.single('image'), async (req, res, next) => {
  try {
    const { name, phone, scopeOfWork, category } = req.body;
    const { familyId } = req.user;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Staff photo is required' });
    }

    let parsedScope = [];
    try {
      parsedScope = typeof scopeOfWork === 'string' ? JSON.parse(scopeOfWork) : scopeOfWork;
    } catch (e) {
      parsedScope = scopeOfWork ? [scopeOfWork] : [];
    }

    let imageUri = null;
    try {
      imageUri = await uploadImage(req.file);
    } catch (uploadError) {
      return res.status(500).json({ success: false, message: 'Image upload failed. Try again.' });
    }

    const staff = new Staff({
      name,
      phone,
      scopeOfWork: parsedScope,
      category,
      registeredBy: 'RESIDENT',
      photo: imageUri,
      activeHousesCount: 1
    });

    await staff.save();

    const affiliation = new StaffAffiliation({
      staffId: staff._id,
      familyId,
      status: 'active'
    });

    await affiliation.save();

    res.status(201).json({
      success: true,
      message: 'Staff registered and subscribed successfully',
      data: { staff, affiliation }
    });

  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ success: false, message: `A staff member with this ${field} already exists.` });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

residentRoute.get('/staff', protect, authorize, async (req, res, next) => {
  try {
    const { familyId } = req.user;
    const rawData = await StaffAffiliation.find({ familyId, status: 'active' })
      .populate('staffId')
      .lean();

    const cleanData = rawData.map(item => ({
      status: item.status,
      hiredDate: item.hiredDate,
      familyId: item.familyId,
      ...item.staffId
    }));

    res.status(200).json({ success: true, data: cleanData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

residentRoute.delete('/staff', protect, authorize, async (req, res, next) => {
  try {
    const { familyId, memberId } = req.user;
    const { staffId } = req.body;

    if (!staffId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid staffId' });
    }

    const updatedAffiliation = await StaffAffiliation.findOneAndUpdate(
      { staffId, familyId, status: 'active' },
      {
        $set: {
          status: 'fired',
          fireDate: Date.now(),
          firedBy: memberId
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedAffiliation) {
      return res.status(404).json({ success: false, message: 'No active affiliation found for this staff member and family.' });
    }

    await Staff.updateOne(
      { _id: staffId, activeHousesCount: { $gt: 0 } },
      { $inc: { activeHousesCount: -1 } },
      { new: true }
    );

    res.status(200).json({ success: true, message: 'Staff member successfully removed.', data: updatedAffiliation });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

residentRoute.get(
  '/staff/check/:phone',
  protect,
  authorize,
  async (req, res) => {
    try {
      const { phone } = req.params;

      const staff = await Staff.aggregate([
        {
          $match: { phone }
        },

        {
          $lookup: {
            from: "staffaffiliations",
            localField: "_id",
            foreignField: "staffId",
            as: "affiliations"
          }
        },

        {
          $addFields: {
            activeHousesCount: {
              $size: {
                $filter: {
                  input: "$affiliations",
                  as: "aff",
                  cond: { $eq: ["$$aff.status", "active"] }
                }
              }
            }
          }
        },

        {
          $project: {
            affiliations: 0
          }
        }
      ]);

      if (!staff.length) {
        return res.status(404).json({
          success: false,
          message: "No staff member exists with this number."
        });
      }

      res.status(200).json({
        success: true,
        data: staff[0],
        message: "Staff Found!!"
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server Error"
      });
    }
  }
);


residentRoute.get('/all-society-staff', protect, authorize, async (req, res, next) => {
  try {
    const { category } = req.query;
    const allStaff = await Staff.aggregate([
      {
        $match: { category }
      },

      {
        $lookup: {
          from: "staffaffiliations",
          localField: "_id",
          foreignField: "staffId",
          as: "affiliations"
        }
      },

      {
        $addFields: {
          activeHousesCount: {
            $size: {
              $filter: {
                input: "$affiliations",
                as: "aff",
                cond: { $eq: ["$$aff.status", "active"] }
              }
            }
          }
        }
      },

      {
        $project: {
          affiliations: 0   // hide joined data
        }
      },

      {
        $sort: { activeHousesCount: 1 }
      }
    ]);


    if (!allStaff || allStaff.length === 0) {
      return res.status(404).json({ success: false, message: 'No staff category exists.' });
    }

    res.status(200).json({ success: true, data: allStaff, message: 'Staff entries found.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

residentRoute.post('/subscribe-staff', protect, authorize, async (req, res) => {
  try {
    const { staffId } = req.body; 
    const { familyId } = req.user;

    const staff = await Staff.findOne({ staffId });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    const exists = await StaffAffiliation.findOne({
      staffId: staff._id,
      familyId,
      status: 'active'
    });

    if (exists) return res.status(400).json({ success: false, message: 'Staff already added' });

    staff.activeHousesCount += 1;
    await staff.save();

    await StaffAffiliation.create({
      staffId: staff._id,
      familyId,
      status: 'active'
    });

    res.status(200).json({ success: true, message: 'Staff added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

residentRoute.post('/generate-pass', protect, authorize, async (req, res, next) => {
  try {
    const { memberId, familyId } = req.user;
    const qrCodeValue = crypto.randomBytes(16).toString('hex');

    const pass = new ResidentQR({ familyId, memberId, qrCodeValue });
    await pass.save();

    res.status(200).json({ success: true, qrCodeValue });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

residentRoute.get('/visitor-request', protect, authorize, async (req, res, next) => {
  try {
    const { requestId } = req.query;
    const requestDetails = await VisitorRequest.findOne({ requestId });
    
    if(!requestDetails) {
        return res.status(404).json({ success: false, message: 'Visitor request not found.' });
    }

    res.status(200).json({ success: true, data: requestDetails });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

residentRoute.post('/visitor-request', protect, authorize, async (req, res, next) => {
  try {
    const { requestId, action, gateDeviceId } = req.body;
    const { familyId, memberId } = req.user;
    const now = new Date();

    const memberName = await Resident.findOne({ memberId }, 'name -_id').lean();

    const alreadyApproved = await VisitorRequest.findOne(
      { requestId, status: { $in: ['approved', 'rejected', 'expired'] } }, 
      'requestId status -_id'
    ).lean();

    if (alreadyApproved) {
      return res.status(400).json({ success: false, message: `Request is ${alreadyApproved.status || 'approved'}` });
    }

    const requestDetails = await VisitorRequest.findOneAndUpdate(
      { requestId }, 
      { $set: { status: action } }, 
      { new: true }
    );

    const status = requestDetails.status === 'approved' ? 'IN_PROGRESS' : 'REJECTED';

    await VisitorMovement.create({ 
      requestId: requestDetails.requestId, 
      familyId, 
      name: requestDetails.name, 
      photo: requestDetails.photo, 
      phone: requestDetails.phone, 
      status, 
      purpose: requestDetails.purpose 
    });

    const formattedTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    await Notifications.create({
      familyId,
      title: `Visitor Entry: ${requestDetails.name}`,
      description: `Approved by ${memberName?.name || 'Resident'}`,
      category: 'visitor',
      notifType: 'visitor',
      entryTime: formattedTime,
      approvedBy: memberId,
      personDetails: { name: requestDetails.name, phone: requestDetails.phone, photo: requestDetails.photo }
    });

    const socketId = getGateDeviceSocketId(gateDeviceId);
    const io = getIO();
    
    if (socketId) {
      io.to(socketId).emit('respond-visitor-request', {
        message: 'Open the gate',
        data: requestDetails,
        timestamp: Date.now()
      });
    }

    res.status(200).json({ success: true, message: `Entry ${action}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

residentRoute.get('/staff-attendance', protect, authorize, async (req, res, next) => {
  try {
    const { id } = req.user;
    
    // Note: Ensure PersonelStaffAttendance is properly imported at the top from staff.model.js
    const atten = await PersonelStaffAttendance.find({ residentId: id });
    
    if (!atten || atten.length === 0) {
      return res.status(404).json({ success: false, message: 'Attendance Not Found!!' });
    }
    
    res.status(200).json({ success: true, data: atten, message: 'Attendance Found!!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

residentRoute.get('/notifications', protect, authorize, async (req, res, next) => {
  try {
    const { familyId } = req.user;
    const notificationsList = await Notifications.find({ familyId }).sort({ createdAt: -1 }).lean();

    if (!notificationsList) {
      return res.status(404).json({ success: false, message: 'Messages not found!' });
    }

    res.status(200).json({ success: true, data: notificationsList });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

residentRoute.get('/visitor', protect, authorize, async (req, res, next) => {
  try {
    const { familyId } = req.user;

    const fcmList = await VisitorMovement.find({ familyId, passId: null });

    const passCounts = await VisitorMovement.aggregate([
      {
        $match: {
          familyId: familyId,
          requestId: null,
          status: { $in: ['COMPLETED', 'IN_PROGRESS'] }
        }
      },
      {
        $group: {
          _id: '$passId',
          totalOccurrences: { $sum: 1 },
          statusesFound: { $addToSet: '$status' }
        }
      }
    ]);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    await VisitorPass.updateMany(
      { familyId, endDate: { $lte: endOfToday }, status: 'active' },
      { $set: { status: 'expired' } }
    );

    const allActiveExpiredPasses = await VisitorPass.find({ familyId });

    res.status(200).json({ 
      success: true, 
      data: { fcmList: fcmList || [], passCounts, passList: allActiveExpiredPasses } 
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false });
  }
});

residentRoute.put('/visitor', protect, authorize, async (req, res, next) => {
  try {
    const { documentId } = req.body;

    const visitorMovement = await VisitorMovement.findByIdAndUpdate(
      documentId, 
      { $set: { status: 'COMPLETED', exitTime: new Date() } },
      { new: true }
    );

    if (!visitorMovement) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    res.status(200).json({ success: true, message: 'Visitor exited.', data: visitorMovement });
  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false });
  }
});

residentRoute.get('/staff/attendance', protect, authorize, async (req, res, next) => {
  try {
    const { staffId } = req.query;
    const attendanceRecords = await StaffMovement.find({ staffId }, 'staffId entryTime status -_id').lean();
    
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return res.status(404).json({ success: false, message: 'No records found' });
    }

    res.status(200).json({ success: true, data: attendanceRecords });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

residentRoute.put('/visitor-qr/revoke', protect, authorize, async (req, res, next) => {
  try {
    const { familyId, memberId } = req.user;
    const { passId } = req.body;

    await VisitorMovement.updateMany(
      { passId, status: 'IN_PROGRESS' },
      { $set: { exitTime: new Date(), status: 'COMPLETE' } }
    );

    const resident = await Resident.findOne({ familyId, memberId }, 'name -_id').lean();

    const updatedPass = await VisitorPass.findOneAndUpdate(
      { passId, status: 'active' },
      { $set: { status: 'cancelled', isCancelled: true, cancelledBy: resident?.name || 'Resident' } },
      { new: true }
    );

    if (!updatedPass) {
      return res.status(404).json({ success: false, message: 'Pass already cancelled or not found!' });
    }

    res.status(200).json({ success: true, data: updatedPass });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

residentRoute.get('/utility', async (req, res, next) => {
  try {
    const utilityWorkers = await UtilityWorker.find({ status: 'ACTIVE' });

    if (!utilityWorkers || utilityWorkers.length === 0) {
      return res.status(404).json({ message: 'No utility worker found.', success: false });
    }

    res.status(200).json({ success: true, data: utilityWorkers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

residentRoute.get('/pending-approvals', protect, authorize, async (req, res, next) => {
  try {
    const { familyId } = req.user;
    const fiveMinutesAgo = new Date(Date.now() - 10 * 60 * 1000); // Note: Variable says 5 mins but math is 10 mins

    const pendingRequests = await VisitorRequest.find({
      familyId,
      status: { $in: ['pending', 'approved'] },
      createdAt: { $gte: fiveMinutesAgo }
    }).sort({ createdAt: -1 });

    if (!pendingRequests || pendingRequests.length === 0) {
      return res.status(404).json({ success: false, message: 'No pending requests.' });
    }

    res.status(200).json({ success: true, data: pendingRequests });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', success: false });
  }
});

module.exports = residentRoute;
