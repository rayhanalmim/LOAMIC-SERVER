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
const managerDailyReportCollection = mongoose.model('managerDailyReport', new mongoose.Schema({}, { strict: false }));
const dailyRunningProject = mongoose.model('dailyRunningProject', new mongoose.Schema({}, { strict: false }));
const timeCollection = mongoose.model('timeDemo', new mongoose.Schema({}, { strict: false }));

// const dailyReportSchema = {
//   job_name: project.Project_Name,
//   job_id: project.Project_id,
//   employee_name: user.First_Name + ' ' + user.Last_Name_and_Suffix,
//   date: new Date,
//   weather_condition: { weaither: weatherInfo.data.weather[0], OtherInfo: weatherInfo.data.main },
//   activity: 'PlaceholderActivity',
//   manpower: {
//     employee: 'PlaceholderEmployee',
//     hours: 'PlaceholderHours',
//     injured: 'PlaceholderInjured',
//   },
//   rental: 'PlaceholderRental',
//   isInjury: false,
//   injury_img: 'PlaceholderInjuryImage',
//   progress_img: 'PlaceholderProgressImage',
//   eod_img: 'PlaceholderEODImage',
//   receipt_img: 'PlaceholderReceiptImage',
//   checkOut_question: {
//     take_break: 'PlaceholderTakeBreak',
//     take_lunch: 'PlaceholderTakeLunch',
//     isInjured: 'PlaceholderIsInjured',
//   },
// };


// --------------------------dailyWorkingBaseProject----------------------------------

app.get('/checkedInProject', async (req, res) => {
  const result = await dailyRunningProject.find();
  res.send(result);
})

app.get('/managerCheckIn', async(req, res)=>{
  const managerID = parseInt(req.query.managerId);
  const result = await dailyRunningProject.findOne({ 'managerInfo.ID' : managerID })
  if(result){
    return res.send(result)
  }
  else{
    res.send({message: 'project not found'});
  }
})

// -------------------------------------------------------checkIn-----------------------------------------------
app.post('/checkIn', async (req, res) => {
  const id = req.query.projectId;
  const managerID = req.query.managerId;
  const projectIdInt = parseInt(id)
  const managerIdInt = parseInt(managerID)

  const weatherInfo = await axios.get('https://api.openweathermap.org/data/2.5/weather?lat=26.026731&lon=88.480961&appid=e207b65ba744eac979f0272996cbfa4d');

  const project = await projectCollection.findOne({ Project_id: projectIdInt }, { Project_id: 1, Project_Name: 1, Awarding_Body: 1, Client: 1, _id: 0, Project: 1 });
  const manager = await adminCollection.findOne({ ID: managerIdInt }, { ID: 1, Employee_First_Name: 1, Employee_Last_Name_and_Suffix: 1, Role: 1, _id: 0 });

  const isExist = await dailyRunningProject.findOne({ 'project.Project_id': projectIdInt })
  if (isExist) {
    return res.send({ massege: 'this project already listed in current project collection' })
  }
  else {
    const result = await dailyRunningProject.create({ project, checkInDate: new Date(), isCheckIn: true, managerInfo: manager,  weather_condition: { weaither: weatherInfo.data.weather[0], OtherInfo: weatherInfo.data.main },  manpower: {
      employee: 'employee',
      hours: 'hours',
      injured: 'injured',
    } });
    res.send(result)
  }
})

app.post('/timeDemo', async(req, res)=>{
  const time = req.body;
  console.log(time)
  const result = await timeCollection.create(time);
  console.log(result)
  res.send(result)
})

// ------------------------------dailyReport---------------------------------------
app.post('/dailyReport', async (req, res) => {
  const userId = parseInt(req.query.userId);
  const projectId = parseInt(req.query.projectId);
  const { role } = req.query;
  const { activity, rental, isInjury, injury_img, progress_img, eod_img, receipt_img, date, workingUnderManagerId, employee, hours, injured } = req.body;
  const dateObj = new Date();
  const dateString = dateObj.toISOString();
  const todayDate = dateString.substring(0, 10);
  console.log(userId, projectId, role, activity, rental, isInjury, injury_img, progress_img, eod_img, receipt_img, date, todayDate);

  const project = await projectCollection.findOne({ Project_id: projectId }, { Project_id: 1, Project_Name: 1, _id: 0 });
  const weatherInfo = await axios.get('https://api.openweathermap.org/data/2.5/weather?lat=26.026731&lon=88.480961&appid=e207b65ba744eac979f0272996cbfa4d');
  const currentWaither = { weaither: weatherInfo.data.weather[0], OtherInfo: weatherInfo.data.main };

  if (role === 'user') {
    const user = await userCollection.findOne({ ID: userId }, { First_Name: 1, Last_Name_and_Suffix: 1, Role: 1, ID: 1, _id: 0 });

    const dailyReport = {
      job_name: project.Project_Name,
      job_id: project.Project_id,
      employee_name: user.First_Name + ' ' + user.Last_Name_and_Suffix,
      workingUnderManagerId: workingUnderManagerId,
      date: new Date,
      weather_condition: { weaither: weatherInfo.data.weather[0], OtherInfo: weatherInfo.data.main },
      activity: activity,
      rental: rental,
      isInjury: isInjury,
      injury_img: injury_img,
      progress_img: progress_img,
      eod_img: eod_img,
      receipt_img: receipt_img,
    };

    const todayCollection = await dailyReportCollection.findOne({ Date: date });

    if (todayCollection) {
      const update = await dailyReportCollection.updateOne(
        { Date: date },
        {
          $push: { dailyReport: dailyReport },
        },
      );
      return res.send(update);
    }
    else {
      const create = await dailyReportCollection.create({ Date: todayDate, dailyReport: [dailyReport] })
      return res.send(create);
    }
  }
  else {
    const manager = await adminCollection.findOne({ ID : userId });

    const dailyReportForManager = {
      job_name: project.Project_Name,
      job_id: project.Project_id,
      employee_name: manager.First_Name + ' ' + manager.Last_Name_and_Suffix,
      date: new Date,
      weather_condition: { weaither: weatherInfo.data.weather[0], OtherInfo: weatherInfo.data.main },
      activity: activity,
      manpower: {
        employee: employee,
        hours: hours,
        injured: injured,
      },
      rental: rental,
      isInjury: false,
      injury_img: injury_img,
      progress_img: progress_img,
      eod_img: eod_img,
      receipt_img: receipt_img
    };

    const todayCollection = await managerDailyReportCollection.findOne({ Date: date });

    if (todayCollection) {
      const update = await managerDailyReportCollection.updateOne(
        { Date: date },
        {
          $push: { dailyReport: dailyReportForManager },
        },
      );
      return res.send(update);
    }
    else {
      const create = await managerDailyReportCollection.create({ Date: todayDate, dailyReport: [dailyReportForManager] })
      return res.send(create);
    }

  }
})

app.get('/users', async (req, res) => {
  const result = await userCollection.find();
  res.send(result);
})

app.get('/aboutUs', async (req, res) => {
  const result = await companyInfo.find();
  res.send(result);
})

app.get('/currentUser', async (req, res) => {
  const pin = req.query.pin;
  const pinInt = parseInt(pin);
  console.log(pinInt)
  const result = await userCollection.find({ Pin: pinInt })
  res.send(result);
})

// -------------------------------------projectBaseContract--------------------------------------
app.get('/contract', async (req, res) => {
  const id = req.query.projectId;
  const idInt = parseInt(id);
  console.log(idInt)
  const result = await contractCollection.find({ Project_id: idInt });
  console.log(result)
  res.send(result);
})

// ------------------------------project----------------------------------
app.get('/projects', async (req, res) => {
  const result = await projectCollection.find({ status: 'Active' });
  // const result = await surveyCollection.find({ surveyor: email })
  res.send(result);
})

// ------------------------------checkAdmin-------------------------------------
app.get('/isAdmin', async (req, res) => {
  const email = req.query.email;
  const password = req.query.password;
  console.log(email, password)
  const isExists = await adminCollection.findOne({ email_address: email, password: password, Role: 'Admin' })
  console.log(isExists)
  if (isExists) {
    return res.send(isExists)
  }
  else {
    return res.status(402).send({ message: 'Unauthorize access' })
  }
})


app.get('/isManager', async (req, res) => {
  const email = req.query.email;
  const password = req.query.password;
  console.log(email, password)
  const isExists = await adminCollection.findOne({ email_address: email, password: password, Role: 'Manager' })
  console.log(isExists)
  if (isExists) {
    return res.send(isExists)
  }
  else {
    return res.status(402).send({ message: 'Unauthorize access' })
  }
})

// -----------------------------------adminCRUD-----------------------------------------------

app.post('/addProject', async(req, res)=>{
  const project = req.body;
  const result = await projectCollection.create(project);
  res.send(result);
})

app.post('/updateProject', async(req, res)=>{
  const projectID = parseInt(req.query.projectId);
  const {Project_id, status, Project_Name, Awarding_Body, Client, Project, Street, City, County, State, Zip, Contract_value, Project_Intro, Project_Duration, Project_Start_Date, Project_Complete_Date, Project_Category, Project_Type, cover_image_url, img_1_url, img_2_url, img_3_url, img_4_url, img_5_url, img_6_url, img_7_url, img_8_url, video_1_url, video_2_url } = req.body;

  const result = await projectCollection.updateOne(
    { Project_id: projectID },
    { $set: { Project_id: Project_id, status: status, Project_Name: Project_Name, Awarding_Body: Awarding_Body, Client: Client, Project: Project, Street: Street, City: City, County: County, State: State, Zip: Zip, Contract_value: Contract_value, Project_Intro: Project_Intro, Project_Duration: Project_Duration, Project_Start_Date: Project_Start_Date, Project_Complete_Date: Project_Complete_Date, Project_Category: Project_Category, Project_Type: Project_Type, cover_image_url: cover_image_url, img_1_url: img_1_url, img_2_url: img_2_url, img_3_url: img_3_url, img_4_url: img_4_url, img_5_url: img_5_url, img_6_url: img_6_url, img_7_url: img_7_url, img_8_url: img_8_url, video_1_url: video_1_url, video_2_url: video_2_url } },
  );
  res.send(result);
})

// ----------------------------------employeeSection--------------------------------------
app.post('/addEmployee', async(req, res)=>{
  const employee = req.body;
  const result = await adminCollection.create(employee);
  res.send(result);
})

app.post('/updateEmployee', async(req, res)=>{
  const employeeID = parseInt(req.query.employeeId);
  const { Employee_Last_Name_and_Suffix, Employee_First_Name, Employee_Status, Role, email_address, password } = req.body;
  console.log(req.body)

  const result = await adminCollection.updateOne(
    { ID: employeeID },
    { $set: { Employee_Last_Name_and_Suffix: Employee_Last_Name_and_Suffix, Employee_First_Name: Employee_First_Name, Employee_Status: Employee_Status, Role: Role, email_address: email_address, password: password } },
  );
  res.send(result);
})

// -------------------------------------ContractPage---------------------------------------------
app.post('/addContract', async(req, res)=>{
  const contract = req.body;
  const result = await contractCollection.create(contract);
  res.send(result);
})

app.post('/updateContract', async(req, res)=>{
  const contractID = parseInt(req.query.contractId);
  const { Project_id, Name, Title, email, Company, Phone_number } = req.body;
 
  const result = await contractCollection.updateOne(
    { _id: new Object(id) },
    { $set: { Project_id: Project_id, Name: Name, Title: Title, email: email, Company: Company, Phone_number: Phone_number } },
  );
  res.send(result);
})

// --------------------------------------localApi-------------------------------------------

app.get('/', (req, res) => {
  res.send('Loamic server running');
});

app.listen(port, () => {
  console.log(`Loamic Server is running on port ${port}`);
});