exports.getHome = (req, res) => {
    res.render('index');
};

exports.getContact = (req, res) => {
    res.render('contact');
};

exports.getDashboard = (req, res) => {
    res.render('dashboard');
};

exports.getProfile = (req, res) => {
    res.render('profile');
};
