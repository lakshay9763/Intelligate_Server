const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { Resident } = require('../model/resident.model');
const { Staff } = require('../model/staff.model');
const { UtilityWorker } = require('../model/utility.model');
const { Admin, AdminSession } = require('../model/admin.model');
const uploadImage = require('../utils/cloudinary.upload');

// ALWAYS use environment variables for sensitive keys in production
const SECRET_KEY = process.env.JWT_SECRET || "Lucifer the Morning Star!";

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email, isActive: true });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid Password.' });
    }

    const sessionToken = jwt.sign(
      { adminId: admin._id, role: admin.role },
      SECRET_KEY,
      { expiresIn: '12h' }
    );

    await AdminSession.create({
      adminId: admin._id,
      token: sessionToken,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
    });

    res.cookie('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      admin: { id: admin._id, name: admin.name, role: admin.role, email: admin.email }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error during login" });
  }
};

exports.adminLogout = async (req, res, next) => {
  try {
    const token = req.cookies.admin_session;

    if (token) {
      await AdminSession.deleteOne({ token });
    }

    res.clearCookie('admin_session');
    res.status(200).json({ success: true, message: "Logged out successfully" });  
  } catch (error) {
    res.status(500).json({ success: false, message: "Error during logout" });
  }
};

exports.checkSession = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.adminId);

    if (!admin || !admin.isActive) {
      res.clearCookie('admin_session'); 
      return res.status(401).json({ success: false, message: "Account deactivated or deleted." });
    }

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error verifying session." });
  }
};

exports.addResident = async (req, res, next) => {
  try {
    const { name, phone, phase, block, plot, floor, password, email, familyId } = req.body;

    let photoUrl = null;
    if (req.file) {
      photoUrl = await uploadImage(req.file);
    }

    const saltLevels = 10;
    const hashedPassword = await bcrypt.hash(password, saltLevels);

    const resident = new Resident({
      name,
      phone,
      role: 'owner',
      email,
      familyId,
      phase,
      block,
      plot,
      floor,
      password: hashedPassword,
      photo: photoUrl,
      memberId: `${familyId}-OWNER-1`
    });

    await resident.save();

    res.status(201).json({ success: true, message: "Resident added successfully", data: resident });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to add resident", error: error.message });
  }
};

exports.removeFamilyFromSociety = async (familyId) => {
  try {
    const familyMembers = await Resident.find({ familyId });
    
    if (familyMembers.length === 0) {
      return { success: false, message: "No residents found for this Family ID." };
    }

    const memberIds = familyMembers.map(member => member.memberId);
    const modelNames = mongoose.modelNames();

    for (const modelName of modelNames) {
      const Model = mongoose.model(modelName);
      const schemaFields = Object.keys(Model.schema.paths);

      if (schemaFields.includes('familyId')) {
        await Model.deleteMany({ familyId: familyId });
      }

      if (schemaFields.includes('memberId')) {
        await Model.deleteMany({ memberId: { $in: memberIds } });
      }
    }

    return { success: true, message: "Owner and his family removed completely from all records." };
  } catch (error) {
    return { success: false, message: "Server error during dynamic removal." };
  }
};

exports.removeStaffFromSociety = async (documentId, staffId) => {
  try {
    const staff = await Staff.findById(documentId);
    
    if (!staff) {
      return { success: false, message: "Staff member not found." };
    }

    const modelNames = mongoose.modelNames();

    for (const modelName of modelNames) {
      const Model = mongoose.model(modelName);
      const schemaFields = Object.keys(Model.schema.paths);

      try {
        if (schemaFields.includes('staffId')) {
          await Model.deleteMany({ staffId: { $in: [staffId, documentId] } });
        }

        if (schemaFields.includes('staff')) {
          await Model.deleteMany({ staff: documentId });
        }
      } catch (err) {
        // Safely catches "CastErrors" if Mongoose strictly expects an ObjectId
      }
    }

    return { success: true, message: "Staff member and affiliations removed completely." };
  } catch (error) {
    return { success: false, message: "Server error during dynamic removal." };
  }
};

exports.removeUtilityFromSociety = async (utilityId) => {
  try {
    const util = await UtilityWorker.findOne({ utilityId });
    
    if (!util) {
      return { success: false, message: "Utility worker not found." };
    }

    const modelNames = mongoose.modelNames();

    for (const modelName of modelNames) {
      const Model = mongoose.model(modelName);
      const schemaFields = Object.keys(Model.schema.paths);

      try {
        if (schemaFields.includes('utilityId')) {
          await Model.deleteMany({ utilityId: utilityId });
        }
      } catch (err) {
        // Safely catches type mismatches
      }
    }

    return { success: true, message: "Utility worker and history removed completely." };
  } catch (error) {
    return { success: false, message: "Server error during dynamic removal." };
  }
};