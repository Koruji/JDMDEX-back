# JDMDEX API Documentation

Backend API for Japanese car Pokédex with JWT authentication, MariaDB database, and Bunny CDN for image storage.

**Base URL:** `http://localhost:3000`
**CDN URL:** `https://jdmdex-cdn.loocist23.fr/`

---

## Authentication

All car-related endpoints require a valid JWT token in the `Authorization` header.

### Register

salut toi

Create a new user account.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Response (201 Created):**
```json
{
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### Login

Authenticate and get a JWT token.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "password123"
  }'
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### Get Current User

Get information about the authenticated user.

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com"
  }
}
```

---

## Cars

All car endpoints require authentication.

### List All Cars

Get all cars owned by the authenticated user.

**Request:**
```bash
curl -X GET http://localhost:3000/api/cars \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Nissan Skyline GT-R",
    "brand": "Nissan",
    "year": 1999,
    "horsepower": 280,
    "engine": "RB26DETT 2.6L Twin-Turbo",
    "mileage": 50000,
    "owner": "John Doe",
    "location": "Tokyo, Japan",
    "latitude": 35.6895,
    "longitude": 139.6917,
    "user_id": 1,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z",
    "photos": [
      {
        "id": 1,
        "car_id": 1,
        "filename": "users/1/cars/1/123456789.jpg",
        "is_primary": true,
        "url": "https://jdmdex-cdn.loocist23.fr/users/1/cars/1/123456789.jpg",
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
]
```

---

### Get Car by ID

Get a specific car by its ID.

**Request:**
```bash
curl -X GET http://localhost:3000/api/cars/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Nissan Skyline GT-R",
  "brand": "Nissan",
  "year": 1999,
  "horsepower": 280,
  "engine": "RB26DETT 2.6L Twin-Turbo",
  "mileage": 50000,
  "owner": "John Doe",
  "location": "Tokyo, Japan",
  "latitude": 35.6895,
  "longitude": 139.6917,
  "user_id": 1,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "photos": []
}
```

**Response (404 Not Found):**
```json
{
  "error": "Car not found or not authorized."
}
```

---

### Create Car

Create a new car. Optionally upload photos.

**Request (without photos):**
```bash
curl -X POST http://localhost:3000/api/cars \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Toyota Supra RZ",
    "brand": "Toyota",
    "year": 1997,
    "horsepower": 280,
    "engine": "2JZ-GTE 3.0L Twin-Turbo",
    "mileage": 35000,
    "owner": "John Doe",
    "location": "Osaka, Japan",
    "latitude": 34.6937,
    "longitude": 135.5023
  }'
```

**Request (with photos):**
```bash
curl -X POST http://localhost:3000/api/cars \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "name=Nissan Skyline GT-R" \
  -F "brand=Nissan" \
  -F "year=1999" \
  -F "horsepower=280" \
  -F "engine=RB26DETT 2.6L Twin-Turbo" \
  -F "photos=@/path/to/photo1.jpg" \
  -F "photos=@/path/to/photo2.jpg"
```

**Response (201 Created):**
```json
{
  "id": 2,
  "name": "Nissan Skyline GT-R",
  "brand": "Nissan",
  "year": 1999,
  "horsepower": 280,
  "engine": "RB26DETT 2.6L Twin-Turbo",
  "mileage": null,
  "owner": null,
  "location": null,
  "latitude": null,
  "longitude": null,
  "user_id": 1,
  "created_at": "2024-01-15T11:00:00.000Z",
  "updated_at": "2024-01-15T11:00:00.000Z",
  "photos": [
    {
      "id": 1,
      "car_id": 2,
      "filename": "123456789.jpg",
      "is_primary": true,
      "created_at": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

---

### Update Car

Update an existing car.

**Request:**
```bash
curl -X PUT http://localhost:3000/api/cars/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nissan Skyline GT-R R34",
    "brand": "Nissan",
    "year": 2002,
    "horsepower": 280,
    "engine": "RB26DETT 2.6L Twin-Turbo"
  }'
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Nissan Skyline GT-R R34",
  "brand": "Nissan",
  "year": 2002,
  "horsepower": 280,
  "engine": "RB26DETT 2.6L Twin-Turbo",
  "mileage": 50000,
  "owner": "John Doe",
  "location": "Tokyo, Japan",
  "latitude": 35.6895,
  "longitude": 139.6917,
  "user_id": 1,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T11:30:00.000Z",
  "photos": []
}
```

**Response (404 Not Found):**
```json
{
  "error": "Car not found or not authorized."
}
```

---

### Delete Car

Delete a car and its associated photos.

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/cars/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (204 No Content):**
*(Empty body)*

**Response (404 Not Found):**
```json
{
  "error": "Car not found or not authorized."
}
```

---

### Add Photos to Car

Add one or more photos to an existing car.

**Request:**
```bash
curl -X POST http://localhost:3000/api/cars/1/photos \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "photos=@/path/to/photo1.jpg" \
  -F "photos=@/path/to/photo2.jpg"
```

**Response (201 Created):**
```json
{
  "id": 1,
  "name": "Nissan Skyline GT-R",
  "brand": "Nissan",
  "year": 1999,
  "horsepower": 280,
  "engine": "RB26DETT 2.6L Twin-Turbo",
  "mileage": 50000,
  "owner": "John Doe",
  "location": "Tokyo, Japan",
  "latitude": 35.6895,
  "longitude": 139.6917,
  "user_id": 1,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "photos": [
    {
      "id": 1,
      "car_id": 1,
      "filename": "123456789.jpg",
      "is_primary": true,
      "created_at": "2024-01-15T11:30:00.000Z"
    },
    {
      "id": 2,
      "car_id": 1,
      "filename": "987654321.jpg",
      "is_primary": false,
      "created_at": "2024-01-15T11:30:00.000Z"
    }
  ]
}
```

**Response (404 Not Found):**
```json
{
  "error": "Car not found or not authorized."
}
```

---

### Delete Photo

Delete a specific photo from a car.

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/cars/1/photos/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (204 No Content):**
*(Empty body)*

**Response (404 Not Found):**
```json
{
  "error": "Photo not found or not authorized."
}
```

---

### Car Recognition (AI Mock)

Recognize a car from a photo. Returns random JDM car data.

**Request:**
```bash
curl -X POST http://localhost:3000/api/cars/recognize \
  -F "photo=@/path/to/car_photo.jpg"
```

**Response (200 OK):**
```json
{
  "brand": "Mazda",
  "name": "RX-7 FD",
  "year": 1993,
  "horsepower": 255,
  "engine": "13B-REW Rotary Twin-Turbo",
  "mileage": null,
  "owner": null,
  "confidence": 85
}
```

---

## Notes

- **Image Storage**: All images are uploaded directly to Bunny CDN with the structure `users/{userId}/cars/{carId}/{filename}`. Photo responses include a `url` field with the full CDN URL (e.g., `https://jdmdex-cdn.loocist23.fr/users/1/cars/5/1781775699116-964697260.png`).
- **No Local Storage**: Files are not stored locally on the server.

---

## Data Schemas

### User
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com"
}
```

### Car
```json
{
  "id": 1,
  "name": "Nissan Skyline GT-R",
  "brand": "Nissan",
  "year": 1999,
  "horsepower": 280,
  "engine": "RB26DETT 2.6L Twin-Turbo",
  "mileage": 50000,
  "owner": "John Doe",
  "location": "Tokyo, Japan",
  "latitude": 35.6895,
  "longitude": 139.6917,
  "user_id": 1,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "photos": []
}
```

### Photo
```json
{
  "id": 1,
  "car_id": 1,
  "filename": "users/1/cars/1/123456789.jpg",
  "is_primary": true,
  "url": "https://jdmdex-cdn.loocist23.fr/users/1/cars/1/123456789.jpg",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

---

## Error Responses

| Code | Description | Example |
|------|-------------|---------|
| 400 | Bad request | `{"error": "Username, email, and password are required."}` |
| 401 | Not authenticated | `{"error": "Access denied. No token provided."}` |
| 403 | Not authorized | `{"error": "Access denied. You do not own this resource."}` |
| 404 | Not found | `{"error": "Car not found or not authorized."}` |
| 409 | Conflict | `{"error": "Username or email already exists."}` |
| 500 | Server error | `{"error": "An error occurred while fetching cars."}` |

---

## Swagger UI

Interactive API documentation available at:
```
http://localhost:3000/api-docs
```

---

## Environment Variables

Create a `.env` file from `.env.example`:

```env
PORT=3000
NODE_ENV=development

MYSQL_HOST=mariadb
MYSQL_PORT=3306
MYSQL_DATABASE=jdmdex
MYSQL_USER=jdmdex_user
MYSQL_PASSWORD=jdmdex_pass

JWT_SECRET=supersecretjdmdexkey12345
JWT_EXPIRES_IN=24h

# Bunny CDN Configuration
BUNNY_API_KEY=your_bunny_storage_api_key
BUNNY_STORAGE_ZONE=jdmdex
BUNNY_PULL_ZONE=jdmdex-cdn.loocist23.fr
```
