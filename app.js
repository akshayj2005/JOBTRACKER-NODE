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
// Trust Proxy for Render (Required for secure cookies behind load balancer)
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

// Serve static files from 'src/public'
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session & Passport Configuration
const session = require('express-session');
// Robust connect-mongo import
const connectMongoRaw = require('connect-mongo');

let MongoStore;
if (connectMongoRaw.create) {
    MongoStore = connectMongoRaw;
} else if (connectMongoRaw.default && connectMongoRaw.default.create) {
    MongoStore = connectMongoRaw.default;
} else if (connectMongoRaw.MongoStore && connectMongoRaw.MongoStore.create) {
    MongoStore = connectMongoRaw.MongoStore;
} else {
    // Fallback or error if needed (though one of the above usually catches it)
    MongoStore = connectMongoRaw;
}

const passport = require('./src/config/passport');

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 30 * 60 // 30 minutes
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 30 * 60 * 1000 // 30 minutes
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Global Middleware to set user for EJS templates
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

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
app.use('/admin', require('./src/routes/adminRoutes'));

// Image Upload Route
app.post('/api/upload', upload.single('profileImage'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
});


// Initialize Application Logic on Startup
app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);

    // --- Reschedule Notifications on Restart ---
    try {
        const Job = require('./src/models/Job');
        const User = require('./src/models/User');
        const notificationService = require('./src/services/notificationService');

        console.log('🔄 valid jobs for upcoming notifications...');
        const allJobs = await Job.find({});
        let count = 0;

        for (const job of allJobs) {
            if (!job.rounds || job.rounds === '[]') continue;

            const user = await User.findOne({ userId: job.userId });
            if (!user) continue;

            let rounds = [];
            try {
                rounds = typeof job.rounds === 'string' ? JSON.parse(job.rounds) : job.rounds;
            } catch (e) { continue; }

            if (Array.isArray(rounds)) {
                rounds.forEach((round, index) => {
                    if (round.datetime) {
                        const scheduled = notificationService.scheduleInterviewNotifications(round, job, user, job._id.toString(), index);
                        if (Object.keys(scheduled).length > 0) count++;
                    }
                });
            }
        }
        console.log(`✅ Rescheduled notifications for ${count} rounds across all jobs.`);
    } catch (err) {
        console.error('❌ Error during startup notification scheduling:', err);
    }
});
