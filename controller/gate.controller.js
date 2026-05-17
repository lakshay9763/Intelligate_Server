const crypto = require('crypto');
const fs = require('fs');

const { Resident, ResidentQR } = require('../model/resident.model.js');
const { GateDevices, ActivateDevice, VisitorRequest } = require('../model/gate.model.js');
const { sendPushNotificationToResidents } = require('../utils/notifications.utils.js');
const uploadImage = require('../utils/cloudinary.upload.js');

exports.GetMasterList = async (req, res, next) => {
  try {
    const data = await Resident.find();
    
    res.status(200).json({ 
      success: true, 
      message: 'Resident list fetched successfully.', 
      residentList: data 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.AddDevice = async (req, res) => {
  try {
    const { activationId, deviceId, fcmToken } = req.body;

    if (!activationId) {
      return res.status(400).json({ success: false, message: 'Missing Activation ID' });
    }

    const pendingDevice = await ActivateDevice.findOne({ activationId });

    if (!pendingDevice || pendingDevice.status === 'USED') {
      return res.status(404).json({ success: false, message: 'QR Invalid or Already Used' });
    }

    if (new Date() > pendingDevice.expireAt) {
      return res.status(410).json({ success: false, message: 'QR Expired' });
    }

    let expiresAt = null;

    if (pendingDevice.deviceType === 'TEMPORARY') {
      expiresAt = new Date(Date.now() + Number(pendingDevice.duration) * 60 * 60 * 1000);
    }

    const device = new GateDevices({
      deviceId,
      fcmToken,
      pinCode: pendingDevice.pinCode,
      gateName: pendingDevice.gateName,
      deviceType: pendingDevice.deviceType,
      expiresAt
    });

    await device.save();

    await ActivateDevice.deleteOne({ _id: pendingDevice._id });

    return res.status(200).json({
      success: true,
      message: 'Device paired successfully',
      gate: pendingDevice.gateName
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This device is already registered to a gate.'
      });
    }

    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.VerifyResident = async (req, res, next) => {
  try {
    const { qrCodeValue } = req.query;

    const entry = await ResidentQR.findOneAndUpdate(
      { qrCodeValue, status: 'pending' }, 
      { $set: { status: 'validated' } }, 
      { new: true }
    );

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Invalid or already validated QR code' });
    }

    res.status(200).json({ success: true, message: 'Valid resident.', data: entry });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.CreateVisitorPass = async (req, res, next) => {
  try {
    const { familyId, name, phone, purpose } = req.body;
    const { deviceId } = req.user;

    const residents = await Resident.find({ familyId });

    
    if (!residents || residents.length === 0) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return res.status(404).json({ success: false, message: 'Resident not found.' });
    }

    const requestId = crypto.randomBytes(6).toString('hex').toUpperCase();

    let photoUrl = null;
    if (req.file) {
      photoUrl = await uploadImage(req.file);
    }

    const response = await VisitorRequest.create({
      requestId,
      familyId,
      name,
      phone,
      purpose,
      photo: photoUrl,
      deviceId
    });

    // setTimeout(() => {
      sendPushNotificationToResidents(residents, { name, requestId, photoUrl })
        .catch(err => console.error("Background FCM Error:", err.message));
    // }, 5000);

    res.status(201).json({ success: true, message: 'Request created.', data: response });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.GetVisitorPass = async (req, res, next) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    await VisitorRequest.updateMany(
      {
        status: 'pending',
        createdAt: { $lte: fiveMinutesAgo }
      },
      {
        $set: { status: 'expired' }
      }
    );

    const recentPasses = await VisitorRequest.find({
      createdAt: { $gt: tenMinutesAgo }
    }).sort({ createdAt: -1 });

    return res.status(200).json({ 
      success: true, 
      message: 'Visitor passes fetched.', 
      data: recentPasses 
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch visitor passes' });
  }
};