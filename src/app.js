const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const carsRouter = require('./routes/cars');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const eventsRouter = require('./routes/events');
const { swaggerUi, specs } = require('./swagger');
const { requestLogger, errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Middleware pour logger les requêtes (log les erreurs automatiquement)
app.use(requestLogger);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/cars', carsRouter);
app.use('/api/events', eventsRouter);

// 404 handler for undefined routes (avec logging)
app.use(notFoundHandler);

// Error handler global (doit être après toutes les routes)
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚗 JDMDex server running → http://localhost:${PORT}\n`);
  });
}

module.exports = app;
