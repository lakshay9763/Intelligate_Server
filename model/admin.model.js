const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String,enum:['superadmin','admin'] ,default: 'admin' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true })


const adminSessionSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    token: { type: String, required: true, unique: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    expiresAt:{type:Date,required:true,index:{expires:0}}  // auto  deleted when expire time reached ttl index



},{timestamps:true})

const Admin = mongoose.model('Admin', adminSchema);
const AdminSession = mongoose.model('AdminSession', adminSessionSchema);

module.exports = { Admin, AdminSession };