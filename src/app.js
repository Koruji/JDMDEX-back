const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const carsRouter = require('./routes/cars');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const eventsRouter = require('./routes/events');
const favoritesRouter = require('./routes/favorites');
const { swaggerUi, specs } = require('./swagger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/cars', carsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/users/favorites', favoritesRouter);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚗 JDMDex server running → http://localhost:${PORT}\n`);
  });
}

module.exports = app;
