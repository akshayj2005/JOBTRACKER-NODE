const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const path = require('path');
const multer = require('multer');
require('dotenv').config();
const connectDB = require('./src/config/db');

// Connect to Cloud Database
connectDB();

// Configure multer for profile image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'src/public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error("Only image files are allowed!"));
    }
});

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static files from 'src/public'
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Routes
const pageRoutes = require('./src/routes/pageRoutes');
const authRoutes = require('./src/routes/authRoutes');
const jobRoutes = require('./src/routes/jobRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

app.use('/', pageRoutes);
app.use('/api/auth', authRoutes); // Updated route path
app.use('/api/jobs', jobRoutes);
app.use('/api/notifications', notificationRoutes);

// Image Upload Route
app.post('/api/upload', upload.single('profileImage'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
