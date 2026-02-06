class Job {
    constructor(id, userId, company, position, status, rounds = '[]', extras = {}) {
        this.id = id;
        this.userId = userId;
        this.company = company;
        this.position = position;
        this.status = status;
        this.appliedDate = extras.appliedDate || null;
        this.notes = extras.notes || '';
        this.rounds = rounds;
        this.full_name = extras.full_name || '';
        this.email = extras.email || '';
        this.phone = extras.phone || '';
        this.location = extras.location || '';
        this.professional_summary = extras.professional_summary || '';
        this.skills = extras.skills || '[]';
        this.experience = extras.experience || '[]';
        this.education = extras.education || '[]';
        this.certifications = extras.certifications || '[]';
        this.projects = extras.projects || '[]';
        this.profile_image = extras.profile_image || '';
        this.linkedin = extras.linkedin || '';
        this.github = extras.github || '';
        this.twitter = extras.twitter || '';
        this.website = extras.website || '';
    }
}

module.exports = Job;
