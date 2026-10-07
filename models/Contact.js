const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, default: '' },
    phone: String,
    message: { type: String, required: true },
    // Which on-site form this came from (e.g. "Hero Enquiry Form", "Contact Form",
    // "Landlord Property Submission") and the page it was submitted from, so the
    // lead email/admin list can show where an inquiry originated.
    formName: { type: String, default: 'Contact Form' },
    pageUrl: String,
    // Any extra fields a particular form collects beyond the core ones above
    // (company, company size, requirement, property location/size/type, etc.)
    extra: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ['new', 'read', 'responded'], default: 'new' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contact', contactSchema);
