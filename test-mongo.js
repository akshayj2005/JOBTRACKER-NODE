const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
    try {
        console.log('Connecting to:', process.env.MONGODB_URI);
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        process.exit(0);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

testConnection();
