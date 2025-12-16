const WaitingList = require('../models/WaitingList');
const { validateEmail, sanitizeString } = require('../utils/validation');

// Subscribe to waiting list
exports.subscribe = async (req, res) => {
  try {
    const { email, type, referralSource } = req.body;

    // Validate and sanitize email
    if (!email) {
      return res.status(400).json({ 
        error: 'Email address is required',
        field: 'email'
      });
    }

    const sanitizedEmail = sanitizeString(email);
    if (!validateEmail(sanitizedEmail)) {
      return res.status(400).json({ 
        error: 'Please enter a valid email address',
        field: 'email'
      });
    }

    // Validate type (generic)
    const sanitizedType = sanitizeString(type);
    if (!sanitizedType || typeof sanitizedType !== 'string' || !sanitizedType.trim()) {
      return res.status(400).json({ 
        error: 'Please select your interest type',
        field: 'type'
      });
    }

    // Check if email already exists
    const existingEntry = await WaitingList.findOne({ email: sanitizedEmail.toLowerCase() });
    if (existingEntry) {
      return res.status(409).json({ 
        error: 'This email is already on our waiting list',
        field: 'email'
      });
    }

    // Create new waiting list entry
    const waitingListEntry = new WaitingList({
      email: sanitizedEmail.toLowerCase(),
      type: sanitizedType.trim(),
      referralSource: sanitizeString(referralSource) || 'website'
    });

    await waitingListEntry.save();

    // Return success response without sensitive data
    const response = waitingListEntry.toJSON();
    delete response.email; // Don't return email in response for privacy

    res.status(201).json({
      message: 'Successfully joined the waiting list!',
      data: response
    });
  } catch (error) {
    console.error('Waiting list subscription error:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'This email is already on our waiting list',
        field: 'email'
      });
    }
    
    if (error.name === 'ValidationError') {
      const field = Object.keys(error.errors)[0];
      return res.status(400).json({ 
        error: error.errors[field].message,
        field: field
      });
    }
    
    res.status(500).json({ 
      error: 'Something went wrong. Please try again later.',
      field: 'general'
    });
  }
};

// Get waiting list stats (public)
exports.getStats = async (req, res) => {
  try {
    const totalSubscribers = await WaitingList.countDocuments({ status: 'active' });

    const typeAgg = await WaitingList.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);

    const typeCounts = (typeAgg || []).reduce((acc, row) => {
      if (!row?._id) return acc;
      acc[String(row._id)] = row.count || 0;
      return acc;
    }, {});

    // Backward compatibility fields (legacy UI/tests)
    const buyerCount = (typeCounts.buyer || 0) + (typeCounts.both || 0);
    const sellerCount = (typeCounts.seller || 0) + (typeCounts.both || 0);

    // Add some mock growth data for demonstration
    const growthThisWeek = Math.floor(totalSubscribers * 0.05); // 5% growth
    
    res.json({
      totalSubscribers,
      buyerCount,
      sellerCount,
      typeCounts,
      growthThisWeek,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Waiting list stats error:', error);
    res.status(500).json({ 
      error: 'Unable to load statistics',
      field: 'general'
    });
  }
};
