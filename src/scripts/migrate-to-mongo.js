const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const User = require('../models/User');
const Job = require('../models/Job');

const jobsFilePath = path.join(__dirname, '../data/jobs.json');

async function migrate() {
    try {
        console.log('🚀 Starting migration...');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        if (!fs.existsSync(jobsFilePath)) {
            console.log('ℹ️ No jobs.json found. Nothing to migrate.');
            process.exit(0);
        }

        const data = fs.readFileSync(jobsFilePath, 'utf8');
        const legacyData = JSON.parse(data || '[]');

        console.log(`📦 Found ${legacyData.length} records in jobs.json`);

        for (const item of legacyData) {
            const userId = item.userId || item.user_id;
            if (!userId) {
                console.warn('⚠️ Skipping item without userId:', item.id);
                continue;
            }

            if (item.company === 'Profile') {
                console.log(`👤 Migrating profile for user: ${userId}`);
                await User.findOneAndUpdate(
                    { userId },
                    {
                        $set: {
                            fullName: item.full_name || item.fullName,
                            phone: item.phone,
                            location: item.location,
                            professionalSummary: item.professional_summary || item.professionalSummary,
                            skills: item.skills,
                            experience: item.experience,
                            education: item.education,
                            certifications: item.certifications,
                            projects: item.projects,
                            linkedin: item.linkedin,
                            github: item.github,
                            twitter: item.twitter,
                            website: item.website,
                            profileImage: item.profile_image || item.profileImage
                        }
                    },
                    { upsert: true }
                );
            } else {
                console.log(`💼 Migrating job: ${item.company} - ${item.position} for user: ${userId}`);

                // Check if job already exists to avoid duplicates (using legacy ID if stored or company/pos/user)
                // Since Mongoose _id is different, we just create new ones or use a simple heuristic
                // For migration, we'll just create them. If user runs it twice, it might duplicate.

                const newJob = new Job({
                    userId,
                    company: item.company,
                    position: item.position,
                    status: item.status,
                    appliedDate: item.applied_date || item.appliedDate || null,
                    notes: item.notes || '',
                    rounds: typeof item.rounds === 'object' ? JSON.stringify(item.rounds) : item.rounds || '[]',
                    createdAt: item.id ? new Date(parseInt(item.id)) : new Date()
                });

                await newJob.save();
            }
        }

        console.log('🎉 Migration completed successfully!');

        // Safety: Backup file before deleting
        const backupPath = jobsFilePath + '.bak';
        fs.copyFileSync(jobsFilePath, backupPath);
        console.log(`💾 Backup created at ${backupPath}`);

        // Delete original file as requested
        fs.unlinkSync(jobsFilePath);
        console.log(`🗑️ Deleted ${jobsFilePath}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
