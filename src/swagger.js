const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'JDMDEX API',
      version: '1.0.0',
      description: 'Japanese car Pokédex backend API',
      contact: {
        name: 'JDMDEX Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter token in format (Bearer <token>)',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.js',
    './src/models/*.js',
  ],
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
};
