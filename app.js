require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const db = require('./db');
const app = express();
const port = process.env.PORT || 8080;
const userEmail = 'mmaaced@gmail.com';
const instanceName = 'links';
const tableName = 'ice_users.db';
const fs = require('fs');
const secretKey = process.env.SECRET_KEY; 

app.use(bodyParser.json()); 

const verifyCredentials = async (email, password) => {
  try {
    const filePath = `https://cander-db.com/instances/mmaaced@gmail.com/links/ice_users.db`;
    const response = await fetch(filePath, {
      headers: {
        'Authorization': `${process.env.ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    const userData = await response.json();
    console.log(userData)
    for (const entry of userData) {
      if (entry.email === email) {
        const hashedPassword = entry.hashed_password;
        return await bcrypt.compare(password, hashedPassword);
      }
    }
    return false; // Email not found
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return false;
  }
};




// Register new user
app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(406).json({
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }

        // Check if user already exists
        const existingUser = await db.fetchUserByEmail(userEmail, instanceName, tableName, email);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = { username, email, hashed_password: hashedPassword };
        const result = await db.addUser(userEmail, instanceName, tableName, newUser);
        

        res.status(201).json({ message: 'User registered successfully', user: result });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login user
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Fetch user by email
        const user = await db.fetchUserByEmail(userEmail, instanceName, tableName, email);
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.hashed_password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Create JWT
        const token = jwt.sign({ email: user.email }, secretKey, { expiresIn: '1h' });

        res.json({ message: 'Login successful', token, username: user.username });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Forgot Password
app.post('/forgot-password', async (req, res) => {
  try {
      const { email } = req.body;

      const userWithEmailExists = await db.checkEmailExists(email);

      if (!userWithEmailExists) {
          return res.status(400).json({ error: 'Email not found' });
      }

      // Generate a unique token
      const token = crypto.randomBytes(16).toString('hex');
      // Set the expiration time for the token
      const expirationTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour in milliseconds

      // Store the token and its expiration timestamp in the database
      const newToken = { token, email, expiration_time: expirationTime };
      await db.makeRequest('POST', '/instances/mmaaced@gmail.com/links/reset_tokens.db', newToken);

      const transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
              user: process.env.EMAIL,
              pass: process.env.PASSWORD,
          },
      });

      const mailOptions = {
          from: 'The Cold List <no-reply@clinttheengineer.com>',
          to: email,
          subject: 'Password Reset',
          html: `
              <p>You have requested to reset your password.</p>
              <p>Click the following link to reset your password:</p>
              <a href="https://the-cold-list.netlify.app/validate-password?token=${token}">Reset Password</a>
          `,
      };

      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              console.error('Error sending email:', error);
              res.status(500).send('Failed to send password reset email');
          } else {
              console.log('Password reset email sent:', info.response);
              res.status(200).json({ message: 'Password reset email sent' });
          }
      });
  } catch (error) {
      console.error(error.message);
      res.status(500).send('Server error');
  }
});


app.post('/reset-password/:token', async (req, res) => {
  try {
      const { token } = req.params;
      const { newPassword } = req.body;

      const query = `/instances/mmaaced@gmail.com/links/reset_tokens.db`;
      const result = await db.makeRequest('GET', query);
      const tokenData = result.find(t => t.token === token && new Date(t.expiration_time) > new Date());

      if (!tokenData) {
          return res.status(400).json({ error: 'Invalid or expired token' });
      }

      const email = tokenData.email;
      console.log(email)
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updateQuery = `/instances/mmaaced@gmail.com/links/ice_users.db`;
      await db.makeRequest('PUT', updateQuery, { password_hash: hashedPassword });

      // Delete the used token from the reset_tokens table
      await db.makeRequest('DELETE', `/instances/mmaaced@gmail.com/links/reset_tokens.db/${tokenData.id}`);

      res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
      console.error(error.message);
      res.status(500).send('Server error');
  }
});



app.get('/validate-password/:token', async (req, res) => {
  try {
      const { token } = req.params;
      // Query the database to check if the token exists and is not expired
      const query = `/instances/mmaaced@gmail.com/links/reset_tokens.db`;
      const result = await db.makeRequest('GET', query);
      const tokenData = result.find(t => t.token === token && new Date(t.expiration_time) > new Date());

      if (!tokenData) {
          return res.status(400).json({ error: 'Invalid or expired token' });
      }

      res.status(200).json({ message: 'Token is valid', token });
  } catch (error) {
      console.error(error.message);
      res.status(500).send('Server error');
  }
});

async function deleteExpiredTokens() {
  try {
      const currentTime = new Date().toISOString();
      const query = `/instances/mmaaced@gmail.com/links/reset_tokens.db`;
      const result = await db.makeRequest('GET', query);

      const expiredTokens = result.filter(token => new Date(token.expiration_time) <= new Date(currentTime));

      for (const token of expiredTokens) {
          await db.makeRequest('DELETE', `/instances/mmaaced@gmail.com/links/reset_tokens.db/${token.id}`);
      }

      console.log(`Deleted ${expiredTokens.length} expired tokens`);
  } catch (error) {
      console.error('Error deleting expired tokens:', error);
      throw new Error('Unable to delete expired tokens');
  }
}




// View all todos for the logged-in user
app.get('/:username/todos', async (req, res) => {
  const { username } = req.params;

  try {
      const todos = await db.makeRequest('GET', '/instances/mmaaced@gmail.com/links/todos.db');
      const userTodos = todos.filter(todo => todo.username === username);
      res.status(200).json(userTodos);
  } catch (error) {
      res.status(500).send('Internal server error');
  }
});


// Create a new todo
app.post('/:username/todos', async (req, res) => {
  const { username } = req.params;
  const { task_name } = req.body;

  if (!task_name) {
      return res.status(400).send('Task name is required');
  }

  const newTodo = { username, task_name };

  try {
      await db.makeRequest('POST', '/instances/mmaaced@gmail.com/links/todos.db', newTodo);
      res.status(201).send('Todo created successfully');
  } catch (error) {
      res.status(500).send('Internal server error');
  }
});


// Update an existing todo
app.put('/:username/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { task_name } = req.body;
  const { username } = req.params;

  if (!task_name) {
      return res.status(400).send('Task name is required');
  }

  try {
      const todos = await db.makeRequest('GET', '/instances/mmaaced@gmail.com/links/todos.db');
      const userTodos = todos.filter(todo => todo.username === username);

      const todoIndex = parseInt(id) - 1;
      if (todoIndex < 0 || todoIndex >= userTodos.length) {
          return res.status(404).send('Todo not found');
      }

      const todo = userTodos[todoIndex];
      todo.task_name = task_name;

      await db.makeRequest('PUT', `/instances/mmaaced@gmail.com/links/todos.db/${todoIndex + 1}`, todo);
      res.status(200).send('Todo updated successfully');
  } catch (error) {
      res.status(500).send('Internal server error');
  }
});


// Delete a todo
app.delete('/:username/todos/:id', async (req, res) => {
  const { id, username } = req.params;

  try {
      const todos = await db.makeRequest('GET', '/instances/mmaaced@gmail.com/links/todos.db');
      const userTodos = todos.filter(todo => todo.username === username);

      const todoIndex = parseInt(id) - 1;
      if (todoIndex < 0 || todoIndex >= userTodos.length) {
          return res.status(404).send('Todo not found');
      }

      await db.makeRequest('DELETE', `/instances/mmaaced@gmail.com/links/todos.db/${todoIndex + 1}`);
      res.status(200).send('Todo deleted successfully');
  } catch (error) {
      res.status(500).send('Internal server error');
  }
});




async function startServer() {

  await deleteExpiredTokens();


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

}

startServer();