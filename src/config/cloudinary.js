const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'jobtracker-profiles',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        // Optimization and Transformation settings
        format: 'auto', // Auto-format (webp/avif where possible)
        transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'auto' }, // Smart crop to face/subject
            { quality: 'auto' }, // Auto quality
            { fetch_format: 'auto' } // Auto format
        ]
    }
});

module.exports = { cloudinary, storage };
