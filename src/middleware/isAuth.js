module.exports = (req, res, next) => {
    // Auth check logic
    console.log('Auth check middleware');
    next();
};
