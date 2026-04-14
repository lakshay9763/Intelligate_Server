const jwt = require("jsonwebtoken")


const SECRET_KEY = "Lucifer the Morning Star!"

const protect = (req, res, next) => {
  
  console.log(req.headers)

  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 2. Verify & Destructure
    // decoded will be { id, role, iat, exp }
    const decoded = jwt.verify(token, SECRET_KEY);

    
    
    
    req.user = decoded; 
    
    next(); // Move to the actual route
  } catch (err) {
    console.log(err)
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expired", code: "EXPIRED" });
    }
    res.status(401).json({ message: "Token is not valid" });
  }

}  

exports.protect = protect