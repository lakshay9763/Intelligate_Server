export const authorize  = (req, res, next) => {
  const path = req.originalUrl;
  const userRole = req.user.role
  // 1. Guard Routes Protection
  if (path.includes('/gate') && userRole !== 'gate') {
    return res.status(403).json({ message: "Forbidden: Gate device access only" });
  }

  // 2. Resident Routes Protection
  if (path.includes('/resident') && userRole !== 'resident') {
    return res.status(403).json({ message: "Forbidden: Resident access only" });
  }

  console.log(path,"Everything okey")

  next();
};