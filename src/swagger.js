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
      schemas: {
        User: {
          type: 'object',
          properties: {
            user_id: { type: 'integer', description: 'User ID' },
            username: { type: 'string', description: 'Username' },
            email: { type: 'string', format: 'email', description: 'User email' },
            social_media: { type: 'string', nullable: true, description: 'Social media handle' },
            profil_img_url: { type: 'string', nullable: true, description: 'Profile image URL' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Car: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Car ID' },
            name: { type: 'string', description: 'Car name' },
            brand: { type: 'string', description: 'Car brand' },
            year: { type: 'integer', description: 'Manufacturing year' },
            horsepower: { type: 'integer', description: 'Engine horsepower' },
            engine: { type: 'string', description: 'Engine specifications' },
            mileage: { type: 'integer', nullable: true, description: 'Car mileage in km' },
            owner: { type: 'string', nullable: true, description: 'Car owner name' },
            location: { type: 'string', nullable: true, description: 'Car location' },
            latitude: { type: 'number', format: 'float', nullable: true, description: 'GPS latitude' },
            longitude: { type: 'number', format: 'float', nullable: true, description: 'GPS longitude' },
            user_id: { type: 'integer', description: 'Owner user ID' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            photos: {
              type: 'array',
              items: { $ref: '#/components/schemas/Photo' },
            },
          },
        },
        Photo: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Photo ID' },
            car_id: { type: 'integer', description: 'Parent car ID' },
            filename: { type: 'string', description: 'Photo filename' },
            is_primary: { type: 'boolean', description: 'Is this the primary photo' },
            url: { type: 'string', description: 'Full CDN URL' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Event ID' },
            name: { type: 'string', description: 'Event name' },
            dateStart: { type: 'string', format: 'date-time', description: 'Start date' },
            dateEnd: { type: 'string', format: 'date-time', description: 'End date' },
            location: { type: 'string', nullable: true, description: 'Event location' },
            type: { type: 'string', enum: ['rasso', 'expo', 'autre'], description: 'Event type' },
            notes: { type: 'string', nullable: true, description: 'Additional notes' },
            user_id: { type: 'integer', description: 'Owner user ID' },
            username: { type: 'string', description: 'Owner username' },
            profil_img_url: { type: 'string', nullable: true, description: 'Owner profile image' },
            comments_count: { type: 'integer', description: 'Number of comments' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        EventComment: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Comment ID' },
            event_id: { type: 'string', description: 'Parent event ID' },
            user_id: { type: 'integer', description: 'User ID' },
            text: { type: 'string', description: 'Comment text' },
            username: { type: 'string', description: 'User username' },
            profil_img_url: { type: 'string', nullable: true, description: 'User profile image' },
            created_at: { type: 'string', format: 'date-time' },
          },
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
