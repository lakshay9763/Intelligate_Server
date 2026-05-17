const jwt = require("jsonwebtoken")
const { GateDevices } = require("../model/gate.model")
const { ResidentSession } = require("../model/resident.model.js")
const { AdminSession } = require("../model/admin.model.js")


const SECRET_KEY = "Lucifer the Morning Star!"

const protect =async (req, res, next) => {
  

  const authHeader = req.headers.authorization

 

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const token = authHeader.split(' ')[1];

  try {
   
    const decoded = jwt.verify(token, SECRET_KEY);

    const deviceId =  req.headers['x-device-id'];

    console.log(deviceId)
 

     const session = await ResidentSession.findOne({
      _id:decoded.sessionId,
      deviceId,
      isActive: true,
    });

    if(!session){
      return res.status(401).json({
        message: "Session expired or logged in on another device",
        forceLogout: true,
      });
    }

    
    
    
    req.user = decoded; 
    
    next();
  } catch (err) {
    console.log(err)
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expired", code: "EXPIRED" });
    }
    res.status(401).json({ message: "Token is not valid" });
  }

}  


const protectGate =async (req,res,next)=>{

  console.log("Hit hell ")


  const authHeader = req.headers.authorization

  console.log(authHeader)

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const token = authHeader.split(' ')[1];

  try {
   
    const decoded = jwt.verify(token, SECRET_KEY);


    const deviceId = req.headers['x-device-id'];

    if (decoded.deviceId !== deviceId) {
      return res.status(403).json({ 
        message: "Security violation: Token does not match this hardware." 
      });
    }

    const dev = await GateDevices.findOne({deviceId,isActive:true})

    console.log(dev,"Active device sesion")

    if(!dev){
       return res.status(401).json({
        message: "Permission revoked by admin",
        forceLogout: true,
      });

    }

    req.user = {...decoded,deviceId}

    
    next();
  } catch (err) {
    console.log(err)
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expired", code: "EXPIRED" });
    }
    res.status(401).json({ message: "Token is not valid" });
  }

}

const protectResident = async (req, res, next) => {
   
   const {sessionId} = req.user

   const deviceId =  req.headers['x-device-id'];
 

    const session = await ResidentSession.findOne({_id:sessionId,isActive:true,deviceId})

    // console.log(session,'hell')

   

    next();
 
};


const protectAdmin = async (req,res,next)=>{
  try {
    const token = req.cookies.admin_session
    console.log(token,'chekc')
    if(!token){
      return res.status(401).json({message:'Unauthrized! please login'})
    }

    const decoded = jwt.verify(token,SECRET_KEY)

    const activeSession = await AdminSession.findOne({token})

    if(!activeSession){
      res.clearCookie('admin_session')
      res.status(401).json({message: "Session expired or revoked."})
    }
    req.admin = decoded; 
    next();


  } catch (error) {
    res.clearCookie('admin_session');
    res.status(401).json({ message: "Invalid session." });
  }
}






module.exports = {protectGate,protect,protectResident,protectAdmin}