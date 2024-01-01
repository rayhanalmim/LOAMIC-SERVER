const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 5000;
const axios = require('axios');

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://loamicDB:02hYw9qqhERUyT41@cluster0.tdvw5wt.mongodb.net/loamicDB?retryWrites=true&w=majority`;

mongoose.connect(uri, {
});

const db = mongoose.connection;

db.on('error', (err) => {
  console.error(`Error connecting to MongoDB: ${err}`);
});

db.once('open', () => {
  console.log('Connected to MongoDB');

});

const userCollection = mongoose.model('users', new mongoose.Schema({}, { strict: false }));
const contractCollection = mongoose.model('contract', new mongoose.Schema({}, { strict: false }));
const projectCollection = mongoose.model('project', new mongoose.Schema({}, { strict: false }));
const companyInfo = mongoose.model('aboutUs', new mongoose.Schema({}, { strict: false }));
const adminCollection = mongoose.model('UserRole', new mongoose.Schema({}, { strict: false }));
const dailyReportCollection = mongoose.model('dailyReport', new mongoose.Schema({}, { strict: false }));

// ------------------------------dailyReport---------------------------------------
app.get('/dailyReport', async(req, res)=>{
  const info = req.body;
  const userId = req.body.userId;
  const projectId = req.body.projectId;
  
  const weatherInfo = await axios.get('https://api.openweathermap.org/data/2.5/weather?lat=26.026731&lon=88.480961&appid=e207b65ba744eac979f0272996cbfa4d');
  const currentWaither = {weaither: weatherInfo.data.weather[0], OtherInfo: weatherInfo.data.main};

  res.send(currentWaither);
})

app.get('/users', async(req, res)=>{
  const result = await userCollection.find();
  res.send(result);
})

app.get('/aboutUs', async(req, res)=>{
  const result = await companyInfo.find();
  res.send(result);
})

app.get('/currentUser', async (req, res)=>{
  const pin = req.query.pin;
  const pinInt = parseInt(pin);
  console.log(pinInt)
  const result = await userCollection.find({ Pin : pinInt})
  res.send(result);
})

app.get('/contract', async (req, res)=>{
  const result = await contractCollection.find();
  res.send(result);
})

app.get('/projects', async (req, res)=>{
  const result = await projectCollection.find({ status: 'Active'});
  // const result = await surveyCollection.find({ surveyor: email })
  res.send(result);
})

// ------------------------------checkAdmin-------------------------------------
app.get('/isAdmin', async (req, res)=>{
  const email = req.query.email;
  const password = req.query.password;
  console.log(email, password)
  const isExists = await adminCollection.findOne({ email_address: email, password: password })
  console.log(isExists)
  if(isExists){
    return res.send(isExists)
  }
  else{
    return res.status(402).send({message: 'Unauthorize access'})
  }
})

// --------------------------------------localApi-------------------------------------------

app.get('/', (req, res) => {
  res.send('Loamic server running');
});

app.listen(port, () => {
  console.log(`Loamic Server is running on port ${port}`);
});