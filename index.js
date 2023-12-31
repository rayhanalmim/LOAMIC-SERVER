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

// -------------------------------------------------------checkIn-----------------------------------------------
app.post('/checkIn', async (req, res) => {
  const id = req.query.projectId;
  const managerID = req.query.managerId;
  const projectIdInt = parseInt(id)
  const managerIdInt = parseInt(managerID)
  const project = await projectCollection.findOne({ Project_id: projectIdInt }, { Project_id: 1, Project_Name: 1, Awarding_Body: 1, Client: 1, _id: 0, Project: 1 });
  const manager = await adminCollection.findOne({ ID: managerIdInt }, { ID: 1, Employee_First_Name: 1, Employee_Last_Name_and_Suffix: 1, Role: 1, _id: 0 });
  const isExist = await dailyRunningProject.findOne({ 'project.Project_id': projectIdInt })
  if (isExist) {
    return res.send({ massege: 'this project already listed in current project collection' })
  }
  else {
    const result = await dailyRunningProject.create({ project, checkInDate: new Date(), isCheckIn: true, managerInfo: manager });
    res.send(result)
  }
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

// --------------------------------------localApi-------------------------------------------

app.get('/', (req, res) => {
  res.send('Loamic server running');
});

app.listen(port, () => {
  console.log(`Loamic Server is running on port ${port}`);
});