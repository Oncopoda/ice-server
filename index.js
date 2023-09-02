const express = require('express');
const cors = require('cors');
const pool = require('./db');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const crypto = require('crypto');
const secretKey = crypto.randomBytes(32).toString('hex');


const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Routes
app.post('/test', (req, res) => {
  console.log(req.body);
  res.json({ message: 'Received!' });
});




// Add this route before your other routes
app.get('/users', async (req, res) => {
  try {
    const users = await pool.query('SELECT * FROM Users');
    console.log(users.rows)
    // Check that users.rows is a valid array of objects
    if (Array.isArray(users.rows)) {
      // Send the list of users as a JSON response
      res.json(users.rows);
    } else {
      // Handle unexpected data structure
      res.status(500).send('Unexpected data structure');
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server error');
  }
});





// Register
app.post('/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      console.log(token)
      if(!password) {
        return res.status(400).json({ error: 'Password is required' })
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      await pool.query(
        'INSERT INTO Users (username, email, password_hash) VALUES ($1, $2, $3)',
        [username, email, hashedPassword]
      );
      res.setHeader('Content-Type', 'application/json')
      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      console.error(error.message);
      res.status(500).send('Server error');
    }
  });



// Login
app.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await pool.query(
        'SELECT * FROM Users WHERE username = $1',
        [username]
      );
  console.log(user_id)
  console.log(user.rows[0])
      if (user.rows.length === 0) {
        return res.status(401).json('Invalid credentials');
      }
      const isPasswordValid = await bcrypt.compare(password, user.rows[0].password);
  
      if (!isPasswordValid) {
        return res.status(401).json('Invalid credentials');
      }
      
      const token = jwt.sign({ user: user_id }, secretKey);      
      res.json({ token });
    } catch (error) {
      console.error(error.message);
      res.status(500).send('Server error');
    }
    
  });





// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});