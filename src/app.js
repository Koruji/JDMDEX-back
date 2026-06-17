const express = require('express');
const cors = require('cors');
const path = require('path');


const carsRouter = require('./routes/cars');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/cars', carsRouter);

app.use(express.static(path.join(__dirname, '../../front')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../front/index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚗 JDMDex server running → http://localhost:${PORT}\n`);
  });
}

module.exports = app;
