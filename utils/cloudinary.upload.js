const cloudinary = require("cloudinary").v2;
const fs = require("fs");

// keep secrets here for now (later move to env)
cloudinary.config({
  cloud_name: "dd5pdy82n",
  api_key: "397341551664711",
  api_secret: "G8Erp1raivFJyMChleae3nOXwpI"
});

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

const uploadImage = async (file) => {
  if (!file) return null;

  let uploadedUrl = null;

  try {

    const result = await cloudinary.uploader.upload(
      file.path,
      {
        folder: "uploads",
        resource_type: "auto"
      }
    );

    uploadedUrl = result.secure_url;

  } catch (error) {
    console.error("Cloudinary Upload Error:", error.message);
    throw new Error("Image upload failed");
  }

  // ALWAYS delete temp file
  try {
    fs.unlinkSync(file.path);
  } catch (err) {
    console.log("Temp file already deleted");
  }

  return uploadedUrl;
};

module.exports = uploadImage;