const express = require('express');
const app = express();

const cors = require('cors');
const pool = require('./db');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const crypto = require('crypto');
const secretKey = crypto.randomBytes(32).toString('hex');

const nodemailer = require('nodemailer');


// Middleware
app.use(cors());
app.use(express.json());


app.use(express.urlencoded({ extended: true }));
// Routes
app.post('/test', (req, res) => {
  res.json({ message: 'Received!' });
});



app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});



// Add this route before your other routes
app.get('/users', async (req, res) => {
  try {
    const users = await pool.query('SELECT * FROM Users');
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

//Fetch ToDo List
app.get('/todos', async (req, res) => {
  try {
    const users = await pool.query('SELECT * FROM Todos');
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

//Add ToDos
app.post('/addtodos', async (req, res) => {
  try {
    const { username, task_name } = req.body;
    const user = await pool.query(
      'INSERT INTO Todos (username, task_name) VALUES ($1, $2)',
      [username, task_name]
    );
    res.setHeader('Content-Type', 'application/json')
      res.status(201).json({ message: 'Todo added' });
  } catch(error) {
  console.error(error.message);
    res.status(500).send('Server error')
  } 
});


//Edit Todos
app.put('/editTodos/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { task_name } = req.body;
    
    // Use a PostgreSQL query to update the task name
    const query = 'UPDATE Todos SET task_name = $1 WHERE id = $2';
    const result = await pool.query(query, [task_name, taskId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//Delete
app.delete('/deleteTodo/:id', async (req, res) => {
  const todoId = parseInt(req.params.id);

  try {
    // Use a PostgreSQL query to delete the todo by ID
    const query = 'DELETE FROM Todos WHERE id = $1';
    const result = await pool.query(query, [todoId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Register
app.post('/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      if(!password) {
        return res.status(400).json({ error: 'Password is required' })
      }  

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(406).json({
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }
      
      // Check if the username already exists in the database
    const existingUser = await pool.query(
      'SELECT * FROM Users WHERE username = $1',
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      res.setHeader('Content-Type', 'application/json')
      return res.status(403).json({ error: 'Username taken' });
    }

    if (existingUser.rows.length > 0) {
      return res.status(403).json({ error: 'Username taken' });
    }

    // Check if the email already exists in the database
    const existingEmail = await pool.query(
      'SELECT * FROM Users WHERE email = $1',
      [email]
    );

    if (existingEmail.rows.length > 0) {
      return res.status(405).json({ error: 'Email already in use' });
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
      if (user.rows.length === 0) {
        return res.status(401).json('Invalid credentials');
      }
      const isPasswordValid = await bcrypt.compare(password, user.rows[0].password_hash);
  
      if (!isPasswordValid) {
        return res.status(401).json('Invalid credentials');
      }
      
      const token = jwt.sign({ user: user.rows[0].user_id }, secretKey);      
      
      res.json({ token, username });
    } catch (error) {
      console.error(error.message);
      res.status(500).send('Server error');
    }
    
  });


  



  //Forgot Password
  app.post('/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
  
     const userWithEmailExists = await checkEmailExists(email);
  
      if (!userWithEmailExists) {
        return res.status(400).json({ error: 'Email not found' });
      }
  
      // Generate a unique token
      const token = crypto.randomBytes(16).toString('hex');
      // Set the expiration time for the token
      const expirationTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour in milliseconds
  
      // Store the token and its expiration timestamp in the database
      await pool.query(
        'INSERT INTO reset_tokens (token, email, expiration_time) VALUES ($1::uuid, $2, $3)',
        [token, email, expirationTime]
      );
  
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
  


async function checkEmailExists(email) {
  try {
    const query = 'SELECT COUNT(*) FROM Users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0].count > 0;
  } catch (error) {
    console.error('Error checking if email exists:', error);
    throw error; 
  }
}

app.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const query = 'SELECT email FROM reset_tokens WHERE token = $1 AND expiration_time > NOW()';
    const result = await pool.query(query, [token]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const email = result.rows[0].email;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateQuery = 'UPDATE Users SET password_hash = $1 WHERE email = $2';
    await pool.query(updateQuery, [hashedPassword, email]);

    // Delete the used token from the reset_tokens table
    await pool.query('DELETE FROM reset_tokens WHERE token = $1', [token]);

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server error');
  }
});

  
// Helper function to retrieve user email based on token
async function getUserEmailByToken(token) {
  try {
    // Query the database to retrieve the user's email based on the token
    const query = 'SELECT email FROM Users WHERE reset_token = $1';
    const result = await pool.query(query, [token]);

    // Check if a user with the provided token exists in the database
    if (result.rows.length === 0) {
      return null; 
    }
   
    return result.rows[0].email;
  } catch (error) {
    console.error('Error retrieving user email by token:', error);
    throw error; // Handle the error appropriately in your application
  }
}

// Helper function to update the user's password in the database
async function updatePasswordByEmail(email, newPassword) {
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const query = 'UPDATE Users SET password_hash = $1 WHERE email = $2';
    await pool.query(query, [hashedPassword, email]);

 
    return true;
  } catch (error) {
    console.error('Error updating user password by email:', error);
    throw error; 
  }
}
  

app.get('/validate-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    // Query the database to check if the token exists and is not expired
    const query = 'SELECT email FROM reset_tokens WHERE token = $1 AND expiration_time > NOW()';
    const result = await pool.query(query, [token]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    
    res.status(200).json({ message: 'Token is valid' });
    res.json({ token })
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server error');
  }
});

async function deleteExpiredTokens() {
  try {
    const currentTime = new Date();
    const query = 'DELETE FROM reset_tokens WHERE expiration_time <= $1';
    const result = await pool.query(query, [currentTime]);
    console.log(`Deleted ${result.rowCount} expired tokens`);
  } catch (error) {
    console.error('Error deleting expired tokens:', error);
    res.status(501).send('Unable to delete expired tokens');
  }
}


async function startServer() {

  await deleteExpiredTokens();


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

}

startServer();