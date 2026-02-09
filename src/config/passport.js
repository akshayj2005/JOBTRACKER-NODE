const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback"
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user exists
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    return done(null, user);
                }

                // check if email exists
                const email = profile.emails[0].value;
                user = await User.findOne({ email });

                if (user) {
                    // Link google account
                    user.googleId = profile.id;
                    await user.save();
                    return done(null, user);
                }

                // Create new user
                const newUser = new User({
                    userId: email.split('@')[0] + Math.floor(Math.random() * 1000), // Generate unique userId
                    email: email,
                    fullName: profile.displayName,
                    googleId: profile.id,
                    profileImage: profile.photos ? profile.photos[0].value : '',
                    authProvider: 'google',
                    isVerified: true, // OAuth emails are verified
                    password: 'oauth-login-' + Date.now() // Dummy password
                });

                await newUser.save();
                done(null, newUser);
            } catch (err) {
                done(err, null);
            }
        }));
}

// GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "/api/auth/github/callback",
        scope: ['user:email']
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ githubId: profile.id });

                if (user) {
                    return done(null, user);
                }

                // GitHub might not return email if private, handling that
                const email = (profile.emails && profile.emails[0] && profile.emails[0].value) ||
                    `${profile.username}@github.placeholder.com`;

                // Check if email already exists
                user = await User.findOne({ email });
                if (user) {
                    user.githubId = profile.id;
                    // Update profile image if missing
                    if (!user.profileImage && profile.photos) {
                        user.profileImage = profile.photos[0].value;
                        await user.save();
                    }
                    await user.save();
                    return done(null, user);
                }

                const newUser = new User({
                    userId: profile.username || 'gh_user_' + Math.floor(Math.random() * 1000),
                    email: email,
                    fullName: profile.displayName || profile.username,
                    githubId: profile.id,
                    profileImage: profile.photos ? profile.photos[0].value : '',
                    authProvider: 'github',
                    isVerified: true,
                    password: 'oauth-login-' + Date.now()
                });

                await newUser.save();
                done(null, newUser);
            } catch (err) {
                done(err, null);
            }
        }));
}

module.exports = passport;
