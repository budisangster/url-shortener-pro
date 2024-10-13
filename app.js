require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const shortid = require('shortid');
const validUrl = require('valid-url');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet');
const validator = require('validator');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/urlShortener';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Add this line near the top of the file, after other middleware declarations
app.use('/fonts', express.static('public/fonts'));

// Custom Helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://code.jquery.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  }
});
app.use(limiter);

// MongoDB connection
const client = new MongoClient(MONGODB_URI);
let db;

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db('urlShortener');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

connectToDatabase();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const bearerHeader = req.headers['authorization'];
  if (typeof bearerHeader !== 'undefined') {
    const bearer = bearerHeader.split(' ');
    const bearerToken = bearer[1];
    jwt.verify(bearerToken, JWT_SECRET, (err, authData) => {
      if (err) {
        res.sendStatus(403);
      } else {
        req.user = authData;
        next();
      }
    });
  } else {
    res.sendStatus(403);
  }
};

// Input validation middleware
const validateRegistration = (req, res, next) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  next();
};

// Add this new middleware
const validateUrl = (req, res, next) => {
  const { url } = req.body;
  if (!url || !isValidUrl(url)) {
    console.error('Invalid URL:', url);
    return res.status(400).json({ error: 'Invalid URL' });
  }
  next();
};

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Routes
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const users = db.collection('users');
    const existingUser = await users.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCount = await users.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    const result = await users.insertOne({
      username,
      email,
      password: hashedPassword,
      role,
      createdAt: new Date()
    });

    res.status(201).json({ message: 'User registered successfully', role });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed due to a server error' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const users = db.collection('users');
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ _id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { _id: user._id, username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/shorten', verifyToken, async (req, res) => {
  const { url, customSlug, expirationDate } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!validUrl.isUri(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    console.log('Received shorten request:', { url, customSlug, expirationDate });
    const urls = db.collection('urls');
    const shortUrl = customSlug || shortid.generate();

    if (customSlug) {
      const existingUrl = await urls.findOne({ shortUrl });
      if (existingUrl) {
        return res.status(400).json({ error: 'Custom slug already in use' });
      }
    }

    const newUrl = {
      originalUrl: url,
      shortUrl,
      userId: new ObjectId(req.user._id),
      createdAt: new Date(),
      clicks: 0,
      lastClicked: null
    };

    if (expirationDate) {
      newUrl.expiresAt = new Date(expirationDate);
    }

    await urls.insertOne(newUrl);
    res.json({ shortUrl: `${req.protocol}://${req.get('host')}/${shortUrl}` });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Error shortening URL', details: error.message });
  }
});

app.get('/:shortUrl', async (req, res) => {
  const { shortUrl } = req.params;

  try {
    const urls = db.collection('urls');
    const url = await urls.findOne({ shortUrl });

    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }

    if (url.expiresAt && url.expiresAt < new Date()) {
      return res.status(410).json({ error: 'URL has expired' });
    }

    await urls.updateOne(
      { _id: url._id },
      { 
        $inc: { clicks: 1 },
        $set: { lastClicked: new Date() }
      }
    );

    res.redirect(url.originalUrl);
  } catch (error) {
    console.error('Error retrieving URL:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/stats/:shortUrl', verifyToken, async (req, res) => {
  const { shortUrl } = req.params;

  try {
    const urls = db.collection('urls');
    const result = await urls.findOne({ shortUrl, userId: new ObjectId(req.user._id) });
    if (result) {
      res.json({
        originalUrl: result.originalUrl,
        shortUrl: `${req.protocol}://${req.get('host')}/${shortUrl}`,
        clicks: result.clicks || 0,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
        lastClicked: result.lastClicked
      });
    } else {
      res.status(404).json({ error: 'URL not found' });
    }
  } catch (error) {
    console.error('Error retrieving stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/urls', verifyToken, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    console.log('User ID from token:', req.user._id);
    const urls = db.collection('urls');
    const totalUrls = await urls.countDocuments({ userId: new ObjectId(req.user._id) });
    const userUrls = await urls.find({ userId: new ObjectId(req.user._id) })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({
      urls: userUrls.map(url => ({
        ...url,
        shortUrl: `${req.protocol}://${req.get('host')}/${url.shortUrl}`
      })),
      currentPage: page,
      totalPages: Math.ceil(totalUrls / limit),
      totalUrls
    });
  } catch (error) {
    console.error('Error retrieving user URLs:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

app.delete('/api/url/:shortCode', verifyToken, async (req, res) => {
  try {
    const { shortCode } = req.params;
    const urls = db.collection('urls');
    
    // Find the URL and check if it belongs to the current user
    const url = await urls.findOne({ shortUrl: shortCode });
    
    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }
    
    if (url.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You do not have permission to delete this URL' });
    }
    
    // Delete the URL
    await urls.deleteOne({ shortUrl: shortCode });
    
    res.json({ message: 'URL deleted successfully' });
  } catch (error) {
    console.error('Error deleting URL:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User profile routes
app.get('/api/user/profile', verifyToken, async (req, res) => {
    try {
        const users = db.collection('users');
        const user = await users.findOne({ _id: new ObjectId(req.user._id) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ username: user.username, email: user.email });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/user/profile', verifyToken, async (req, res) => {
    const { username, email } = req.body;
    try {
        const users = db.collection('users');
        await users.updateOne(
            { _id: new ObjectId(req.user._id) },
            { $set: { username, email } }
        );
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// User settings routes
app.get('/api/user/settings', verifyToken, async (req, res) => {
    try {
        const users = db.collection('users');
        const user = await users.findOne({ _id: new ObjectId(req.user._id) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            defaultExpirationDays: user.defaultExpirationDays || 30,
            enableNotifications: user.enableNotifications || false
        });
    } catch (error) {
        console.error('Error fetching user settings:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/user/settings', verifyToken, async (req, res) => {
    const { defaultExpirationDays, enableNotifications } = req.body;
    try {
        const users = db.collection('users');
        await users.updateOne(
            { _id: new ObjectId(req.user._id) },
            { $set: { defaultExpirationDays, enableNotifications } }
        );
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Analytics route
app.get('/api/analytics', verifyToken, async (req, res) => {
    try {
        const urls = db.collection('urls');
        const userUrls = await urls.find({ userId: new ObjectId(req.user._id) }).toArray();
        
        const totalClicks = userUrls.reduce((sum, url) => sum + (url.clicks || 0), 0);
        const totalUrls = userUrls.length;
        
        // Get top 5 URLs by clicks
        const topUrls = userUrls
            .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
            .slice(0, 5)
            .map(url => ({
                originalUrl: url.originalUrl,
                shortUrl: url.shortUrl,
                clicks: url.clicks || 0
            }));
        
        res.json({
            totalClicks,
            totalUrls,
            topUrls
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

app.put('/api/url/:shortUrl', verifyToken, validateUrl, async (req, res) => {
    const { shortUrl } = req.params;
    const { originalUrl, customSlug, expirationDate } = req.body;

    console.log('Received update request:', { shortUrl, originalUrl, customSlug, expirationDate });

    try {
        const urls = db.collection('urls');
        const existingUrl = await urls.findOne({ shortUrl, userId: new ObjectId(req.user._id) });

        if (!existingUrl) {
            return res.status(404).json({ error: 'URL not found' });
        }

        const updateData = { originalUrl };

        if (customSlug && customSlug !== shortUrl) {
            const slugExists = await urls.findOne({ shortUrl: customSlug });
            if (slugExists) {
                return res.status(400).json({ error: 'Custom slug already in use' });
            }
            updateData.shortUrl = customSlug;
        }

        if (expirationDate) {
            updateData.expiresAt = new Date(expirationDate);
        } else {
            updateData.expiresAt = null;
        }

        await urls.updateOne(
            { shortUrl, userId: new ObjectId(req.user._id) },
            { $set: updateData }
        );

        res.json({ message: 'URL updated successfully' });
    } catch (error) {
        console.error('Error updating URL:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

app.get('/api/url/:shortUrl', async (req, res) => {
    const { shortUrl } = req.params;

    try {
        const urls = db.collection('urls');
        const url = await urls.findOne({ shortUrl });

        if (!url) {
            return res.status(404).json({ error: 'URL not found' });
        }

        if (url.expiresAt && url.expiresAt < new Date()) {
            return res.status(410).json({ error: 'URL has expired' });
        }

        await urls.updateOne(
            { _id: url._id },
            { 
                $inc: { clicks: 1 },
                $set: { lastClicked: new Date() }
            }
        );

        res.json({ originalUrl: url.originalUrl });
    } catch (error) {
        console.error('Error retrieving URL:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add an admin-only route to get all users
app.get('/api/admin/users', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = db.collection('users');
    const allUsers = await users.find({}, { projection: { password: 0 } }).toArray();
    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a route to search URLs
app.get('/api/urls/search', verifyToken, async (req, res) => {
  const { query } = req.query;
  try {
    const urls = db.collection('urls');
    const searchResults = await urls.find({
      userId: new ObjectId(req.user._id),
      $or: [
        { originalUrl: { $regex: query, $options: 'i' } },
        { shortUrl: { $regex: query, $options: 'i' } }
      ]
    }).toArray();
    res.json(searchResults);
  } catch (error) {
    console.error('Error searching URLs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/urls', verifyToken, async (req, res) => {
  try {
    const urls = db.collection('urls');
    const userUrls = await urls.find({ userId: new ObjectId(req.user._id) }).toArray();
    res.json(userUrls);
  } catch (error) {
    console.error('Error fetching user URLs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});