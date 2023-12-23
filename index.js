const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://loamicDB:02hYw9qqhERUyT41@cluster0.tdvw5wt.mongodb.net/loamicDB?retryWrites=true&w=majority`;

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (err) => {
  console.error(`Error connecting to MongoDB: ${err}`);
});

db.once('open', () => {
  console.log('Connected to MongoDB');

  const userCollection = mongoose.model('users', new mongoose.Schema({}, { strict: false }));

  app.get('/users', async(req, res)=>{
    const result = await userCollection.find();
    res.send(result);
  })

  app.get('/currentUser', async (req, res)=>{
    const pin = req.query.pin;
    const pinInt = parseInt(pin);
    console.log(pinInt)
    const result = await userCollection.find({ Pin : pinInt})
    res.send(result);
  })

});

app.get('/', (req, res) => {
  res.send('Loamic server running');
});

app.listen(port, () => {
  console.log(`Loamic Server is running on port ${port}`);
});