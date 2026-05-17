const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');

const { Admin, AdminSession } = require('../model/admin.model.js');
const { Resident, VisitorPass } = require('../model/resident.model');
const { ActivateDevice, GateDevices, UtilityMovement, DelievryMovement, VisitorMovement } = require('../model/gate.model');
const { Staff, StaffMovement, StaffAffiliation } = require('../model/staff.model.js');
const { UtilityWorker } = require('../model/utility.model.js');

const { addResident, removeFamilyFromSociety, removeStaffFromSociety, removeUtilityFromSociety, adminLogin, adminLogout, checkSession } = require('../controller/admin.controller.js');
const { getGateDeviceAllSocketId, getIO } = require('../socket.js');
const societyRoute  = require('./society/society.route.js');
const { protectAdmin } = require('../middleware/auth.js');

const upload = multer({ dest: 'uploads/' });
const adminRoute = express.Router();

// ==========================================
// Authentication & Core Admin Routes
// ==========================================
adminRoute.post('/login', adminLogin);
adminRoute.post('/logout', protectAdmin, adminLogout);
adminRoute.get('/me', protectAdmin, checkSession);

adminRoute.post('/create', protectAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const saltLevels = 10;
    const hashedPassword = await bcrypt.hash(password, saltLevels);

    const admin = new Admin({ name, email, role, password: hashedPassword });
    await admin.save();

    const adminData = admin.toObject(); 
    delete adminData.password;

    res.status(200).json({ success: true, message: 'Admin created', admin: adminData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Admin cant be added' });
  }
});

adminRoute.delete('/remove', protectAdmin, async (req, res, next) => {
  try {
    const { adminId } = req.body;
    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    if (admin.role !== 'superadmin') {
      return res.status(401).json({ success: false, message: 'You have no permission to remove admins.' });
    }

    await Promise.all([
      Admin.findByIdAndDelete(adminId),
      AdminSession.findOneAndDelete({ adminId })
    ]);

    res.status(200).json({ success: true, message: 'Successfully deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Admin cant be removed' });
  }
});

adminRoute.get('/all', protectAdmin, async (req, res, next) => {
  try {
    const admins = await Admin.find({}).select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, admins });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch admins' });
  }
});

// Use society route middleware
adminRoute.use('/society', protectAdmin, societyRoute);

// ==========================================
// Resident Management
// ==========================================
adminRoute.post('/resident', protectAdmin, upload.single('image'), addResident);

adminRoute.get('/resident', async (req, res, next) => {
  try {
    const residentList = await Resident.find();
    res.status(200).json(residentList);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

adminRoute.put('/resident', protectAdmin, async (req, res, next) => {
  try {
    const { name, email, phone, familyId, memberId } = req.body;
    const resident = await Resident.findOne({ familyId, memberId });

    if (!resident) {
      return res.status(404).json({ success: false, message: 'Resident not found' });
    }

    if (name) resident.name = name;
    if (email !== undefined) resident.email = email;

    if (phone && phone !== resident.phone) {
      const saltLevels = 10;
      resident.password = await bcrypt.hash(phone, saltLevels);
      resident.phone = phone;
    }

    const updatedResident = await resident.save();
    return res.status(200).json({ success: true, data: updatedResident });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

adminRoute.delete('/resident', protectAdmin, async (req, res, next) => {
  try {
    const { familyId } = req.body;
    const deleres = await removeFamilyFromSociety(familyId);
    
    res.status(200).json({ success: deleres.success, message: deleres.message, familyId });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error to remove family.' });
  }
});

// ==========================================
// Gate Device Management
// ==========================================
adminRoute.post('/add-device', protectAdmin, async (req, res, next) => {
  try {
    const { deviceType, gate, pin, duration } = req.body;

    if (!deviceType || !gate || !pin) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const saltLevels = 10;
    const hashedPin = await bcrypt.hash(pin, saltLevels);
    const activationId = crypto.randomBytes(16).toString('hex');
    const expiryTime = new Date(Date.now() + 5 * 60 * 1000);

    const activate = new ActivateDevice({
      activationId,
      pinCode: hashedPin,
      gateName: gate,
      deviceType: deviceType.toUpperCase(),
      expireAt: expiryTime,
      duration: duration
    });

    await activate.save();

    return res.status(201).json({
      success: true,
      activationId: activate.activationId,
      expiresAt: expiryTime
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

adminRoute.get('/gate-device', async (req, res, next) => {
  try {
    const devices = await GateDevices.find();
    if (!devices) {
      return res.status(404).json({ success: false, message: 'No gate devices exists.' });
    }
    res.status(200).json({ success: true, data: devices });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

adminRoute.put('/gate-device', protectAdmin, async (req, res, next) => {
  try {
    const { type, deviceId } = req.body;

    if (type === 'grant') {
      const rest = await GateDevices.findOneAndUpdate({ deviceId, isActive: false }, { $set: { isActive: true } }, { new: true });
      return res.status(200).json({ success: true, data: rest });
    }
    
    if (type === 'revoke') {
      const rest = await GateDevices.findOneAndUpdate({ deviceId, isActive: true }, { $set: { isActive: false } }, { new: true });
      return res.status(200).json({ success: true, data: rest });
    }

    res.status(400).json({ success: false, message: 'Invalid action type' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

adminRoute.delete('/gate-device', protectAdmin, async (req, res, next) => {
  try {
    const { deviceId } = req.body;
    const delt = await GateDevices.findOneAndDelete({ deviceId });
    
    if (!delt) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }
    
    res.status(200).json({ success: true, message: 'Device deleted successfully', deviceId });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// Log & Access Monitoring
// ==========================================
adminRoute.get('/entry-logs', async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayFilter = { entryTime: { $gte: startOfDay, $lte: endOfDay } };

    const [delievries, utilities, staffs, visitors] = await Promise.all([
      DelievryMovement.find(todayFilter).lean(),
      UtilityMovement.find(todayFilter).lean(),
      StaffMovement.find(todayFilter).lean(),
      VisitorMovement.find(todayFilter).lean()
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
      displayCategory: 'visitor'
    }));

    const combinedLogs = [...normalizeDelievry, ...normalizeUtility, ...normalizeStaffs, ...normalizeVisitorRequests]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.status(200).json({ success: true, data: combinedLogs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

adminRoute.get('/visitor/inside', async (req, res, next) => {
  try {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayFilter = { entryTime: { $lte: endOfDay }, status: 'IN_PROGRESS', passId: null };
    const rest = await VisitorMovement.find(todayFilter).lean();

    if (!rest || rest.length === 0) {
      return res.status(404).json({ success: false, message: 'No visitor found inside' });
    }

    res.status(200).json({ success: true, data: rest });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

adminRoute.get('/visitor', async (req, res, next) => {
  try {
    const fcmList = await VisitorMovement.find({ status: 'IN_PROGRESS', passId: null }).sort({ entryTime: -1 });

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

    res.status(200).json({ success: true, data: { fcmList: fcmList || [], passList: allActivePasses, passCounts: finalCounts } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==========================================
// Staff & Utility Management
// ==========================================
adminRoute.get('/staff', async (req, res, next) => {
  try {
    const staffList = await Staff.find();

    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const staffToday = await StaffMovement.find({ entryTime: { $gte: today } }).sort({ entryTime: -1 });

    res.status(200).json({ success: true, data: { staffList, staffToday } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

adminRoute.get('/staff/details', async (req, res, next) => {
  try {
    const { staffId, documentId } = req.query;
    const activeHouses = await StaffAffiliation.find({ staffId: documentId, status: 'active' }, 'familyId hiredDate -_id');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const thisMonthLogs = await StaffMovement.find({
      staffId,
      entryTime: {
        $gte: startOfMonth,
        $lt: startOfNextMonth,
      },
      status: 'COMPLETED'
    }, 'entryTime exitTime -_id');

    res.status(200).json({ success: true, data: { logs: thisMonthLogs, houses: activeHouses } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

adminRoute.delete('/staff', protectAdmin, async (req, res, next) => {
  try {
    const { documentId, staffId } = req.body;
    const deleres = await removeStaffFromSociety(documentId, staffId);
    
    res.status(200).json({ success: deleres.success, message: deleres.message, staffId });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error to remove staff.' });
  }
});

adminRoute.get('/utility', async (req, res, next) => {
  try {
    const workers = await UtilityWorker.find();
    if (!workers) {
      return res.status(404).json({ message: 'No utility worker found.', success: false });
    }
    res.status(200).json({ success: true, data: workers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

adminRoute.get('/utility/details', async (req, res, next) => {
  try {
    const { utilityId } = req.query;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const thisMonthLogs = await UtilityMovement.find({
      utilityId,
      entryTime: {
        $gte: startOfMonth,
        $lt: startOfNextMonth,
      },
      status: 'COMPLETED'
    }, 'familyId entryTime exitTime -_id');

    res.status(200).json({ success: true, data: { logs: thisMonthLogs } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

adminRoute.put('/utility/toogle-access', protectAdmin, async (req, res, next) => {
  try {
    const { documentId, accessDenied } = req.body;
    const status = accessDenied ? 'DISABLED' : 'ACTIVE';

    const updt = await UtilityWorker.findByIdAndUpdate(documentId, {
      $set: { accessDenied: accessDenied, status: status }
    }, { new: true });

    if (!updt) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const socketIds = getGateDeviceAllSocketId();
    const io = getIO();
    const socketIdsArray = Object.values(socketIds) || [];

    socketIdsArray.forEach(sid => {
      if (sid) {
        io.to(sid).emit('updateutilitylist', {
          utilityId: updt.utilityId,
          status: updt.status,
          accessDenied: updt.accessDenied
        });
      }
    });

    res.status(200).json({ success: true, data: updt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

adminRoute.delete('/utility', protectAdmin, async (req, res, next) => {
  try {
    const { utilityId } = req.body;
    const deleres = await removeUtilityFromSociety(utilityId);
    
    res.status(200).json({ success: deleres.success, message: deleres.message, utilityId });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error to remove utility worker.' });
  }
});

module.exports = adminRoute;