const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const { protect } = require('../middleware/auth.js');
const { Resident, ResidentSession } = require('../model/resident.model.js');
const { GateDevices } = require('../model/gate.model.js');

const authRoute = express.Router();

// ALWAYS use environment variables for sensitive keys in production
const SECRET_KEY = process.env.JWT_SECRET || "Lucifer the Morning Star!";

authRoute.post('/login', async (req, res) => {
  const { phone, role, password, fcmToken, deviceId, pinCode } = req.body;

  if (role === 'resident') {
    try {
      const user = await Resident.findOne({ phone });

      if (!user) {
        return res.status(404).json({ success: false, message: "Resident not found!!" });
      }

      const isPinCorrect = await bcrypt.compare(password, user.password);
      
      if (!isPinCorrect) {
        return res.status(401).json({ success: false, message: "Invalid Password." });
      }

      const existingSession = await ResidentSession.findOne({ phone, isActive: true });
      
      if (existingSession) {
        await existingSession.deleteOne();
      }

      user.fcmToken = fcmToken;
      await user.save();

      const session = await ResidentSession.create({
        phone,
        deviceId,
        memberId: user.memberId,
        familyId: user.familyId,
        role,
      });

      const token = jwt.sign(
        {
          sessionId: session._id,
          memberId: user.memberId,
          familyId: user.familyId,
          role: 'resident',
        },
        SECRET_KEY,
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        success: true,
        token,
        role: 'resident',
        userData: {
          name: user.name,
          familyId: user.familyId,
          memberId: user.memberId,
          phone: user.phone,
        },
      });

    } catch (err) {
      return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
    
  } else if (role === 'gate') {
    try {
      const device = await GateDevices.findOne({ deviceId });

      // Check if device exists FIRST before checking properties
      if (!device) {
        return res.status(404).json({ success: false, message: "Device is not registered with gate." });
      }

      if (!device.isActive) {
        return res.status(403).json({ success: false, message: "Permission revoked by admin" });
      }

      const isPinCorrect = await bcrypt.compare(pinCode, device.pinCode);

      if (!isPinCorrect) {
        return res.status(401).json({ success: false, message: "Invalid Access PIN." });
      }

      const token = jwt.sign(
        {
          deviceId: device.deviceId,
          deviceType: device.deviceType,
          role: 'gate',
        },
        SECRET_KEY,
        { expiresIn: '365d' }
      );

      return res.status(200).json({
        success: true,
        message: "Authentication successful",
        token,
        gateName: device.gateName
      });
      
    } catch (err) {
      return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
    
  } else {
    // If role is neither 'resident' nor 'gate'
    return res.status(400).json({ success: false, message: "Invalid role specified" });
  }
});

authRoute.post('/logout', protect, async (req, res, next) => {
  try {
    const { phone } = req.body;
    const session = await ResidentSession.findOneAndDelete({ phone, isActive: true });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session Not Found !!!" });
    }

    return res.status(200).json({ success: true, message: "Session deleted, logged out successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

authRoute.post('/check-phone', async (req, res, next) => {
  try {
    const { phone } = req.body;
    const user = await Resident.findOne({ phone });

    if (!user) {
      // Must have 'return' here, otherwise it sends 404 AND tries to send 200 below
      return res.status(404).json({ success: false, message: 'Phone not found.' });
    }

    return res.status(200).json({ success: true, message: 'User found' });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = authRoute;