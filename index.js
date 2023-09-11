const http = require('http');

const express = require('express');

const { Server } = require('socket.io');

const cors = require('cors');
const pool = require('./db');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const crypto = require('crypto');
const secretKey = crypto.randomBytes(32).toString('hex');


const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  console.log('User connected')
})

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

//Fetch ToDo List
app.get('/todos', async (req, res) => {
  try {
    const users = await pool.query('SELECT * FROM Todos');
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
  io.emit('addtodos', { todo })
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
  io.emit('todoDeleted', { todoId: req.params.id });
});


// Register
app.post('/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;
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
  console.log(user.rows)
  console.log(user.rows[0].password_hash)
  console.log(user.rows[0].user_id)
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





// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});