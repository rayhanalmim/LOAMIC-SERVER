const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 5000;
const axios = require('axios');
require('dotenv').config()
const multer = require('multer');
const AWS = require('aws-sdk');
const PDFDocument = require('pdfkit');
const fs = require('fs'); 

app.use(cors())
app.use(express.json())

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const s3 = new AWS.S3();

const upload = multer({
  storage: multer.memoryStorage(),
}).fields([
  { name: 'imagePath1', maxCount: 1 },
  { name: 'imagePath2', maxCount: 1 },
  { name: 'imagePath3', maxCount: 1 },
]);


const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.tdvw5wt.mongodb.net/loamicDB?retryWrites=true&w=majority`;

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
const managerCheckInCollection = mongoose.model('AllCheckIn(Manager)', new mongoose.Schema({}, { strict: false }));
const clockInCollection = mongoose.model('clockInCollection', new mongoose.Schema({}, { strict: false }));
const imageCollection = mongoose.model('imageTempCo', new mongoose.Schema({}, { strict: false }));


// -----------------------------imageUploadApi-------------------------------
// upload.single('imagePath'),

app.post('/uploadImage', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('Error uploading to S3:', err);
      return res.status(500).json({ error: 'Failed to upload to S3' });
    }

    const uploadPromises = [];

    // Loop through each field name and upload the corresponding file
    ['imagePath1', 'imagePath2', 'imagePath3'].forEach((fieldName) => {
      const file = req.files[fieldName][0];

      const params = {
        Bucket: 'loamic-media',
        Key: Date.now().toString() + '-' + file.originalname,
        Body: file.buffer,
        ACL: 'public-read',
        ContentType: file.mimetype,
      };

      uploadPromises.push(
        new Promise((resolve, reject) => {
          s3.upload(params, (err, data) => {
            if (err) {
              console.error('Error uploading to S3:', err);
              reject({ error: `Failed to upload ${fieldName} to S3` });
            } else {
              console.log(data);
              console.log(`Image ${fieldName} uploaded successfully. S3 Object URL:`, data.Location);
              resolve({ message: `Image ${fieldName} uploaded successfully`, url: data.Location });
            }
          });
        })
      );
    });

    try {
      const results = await Promise.all(uploadPromises);
      res.json(results);
    } catch (error) {
      res.status(500).json(error);
    }
  });
});

// -------------------------------getPdf---

app.get('/test', async (req, res)=>{
  const dateObj = new Date();
    const dateString = dateObj.toISOString();
    const todayDate = dateString.substring(0, 10);
    const managerEmail = req.query.testtest;
    console.log(managerEmail);

    const dailyReportCol = await managerDailyReportCollection.findOne({
      $and: [
        { Date: todayDate },
        { dailyReport: { $elemMatch: { email: managerEmail } } }
      ]
    });

    if (!dailyReportCol) {
      return res.send({ message: 'No daily report found for this manager on this date' });
    }
    res.send(dailyReportCol);
})

// --------------------------daynamic_Pdf_Create------------------------

// app.get('/downloadManagerDailyReport', async (req, res) => {
//   try {
//     const dateObj = new Date();
//     const dateString = dateObj.toISOString();
//     const todayDate = dateString.substring(0, 10);
//     const managerEmail = req.query.managerEmail;

//     // Fetch daily report from MongoDB
//     const dailyReportCol = await managerDailyReportCollection.findOne({
//       $and: [
//         { Date: todayDate },
//         { dailyReport: { $elemMatch: { email: managerEmail } } }
//       ]
//     });

//     if (!dailyReportCol) {
//       return res.send({ message: 'No daily report found for this manager on this date' });
//     }
//     console.log(dailyReportCol)

//     const managerDataArray = dailyReportCol.dailyReport.filter(entry => entry.email === managerEmail);
//     const managerData = managerDataArray[0];

//     console.log(managerData);

//     // Create a PDF
//     const doc = new PDFDocument();

//     // Use a writable stream to capture the PDF content
//     const pdfBuffer = [];
//     doc.on('data', chunk => pdfBuffer.push(chunk));
//     doc.on('end', async () => {
//       // Upload the PDF buffer to S3
//       const params = {
//         Bucket: 'loamic-media',
//         Key: 'invoice.pdf',
//         Body: Buffer.concat(pdfBuffer),
//         ContentType: 'application/pdf',
//       };

//       try {
//         await s3.upload(params).promise();

//         // Set headers for triggering the download
//         res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
//         res.setHeader('Content-Type', 'application/pdf');

//         // Provide the S3 download link
//         const downloadLink = s3.getSignedUrl('getObject', {
//           Bucket: 'loamic-media',
//           Key: 'invoice.pdf',
//           Expires: 60,  // Link expiration time in seconds
//         });

//         res.json({ downloadLink });
//       } catch (uploadError) {
//         console.error(uploadError);
//         res.status(500).send('Error uploading PDF to S3');
//       }
//     });

//     // PDF content generation...
//     const distanceMargin = 18;
//     doc
//       .fillAndStroke('#0e8cc3')
//       .lineWidth(20)
//       .lineJoin('round')
//       .rect(
//         distanceMargin,
//         distanceMargin,
//         doc.page.width - distanceMargin * 2,
//         doc.page.height - distanceMargin * 2,
//       )
//       .stroke();

//     try {
//       const imageResponse = await axios.get(managerData.imageUrl, { responseType: 'arraybuffer' });
//       const imageBuffer = Buffer.from(imageResponse.data);
//       doc.image(
//         imageBuffer,
//         doc.page.width / 2 - 190 / 2,
//         60,
//         {
//           fit: [190, 100],
//           align: 'center',
//         }
//       );
//     } catch (imageError) {
//       console.error('Error downloading image:', imageError);
//       // Handle error, you may want to use a default image in case of failure
//     }

//     doc.moveDown();
//     doc.moveDown();
//     doc.moveDown();
//     doc.moveDown();
//     doc.moveDown();
//     doc.moveDown();
//     doc.moveDown();

//     doc.font('Times-Roman').fontSize(20).fill('#C2272F').text('Daily Report For Manager', { align: 'center'});
//     doc.moveDown();

//     doc.font('Times-Roman').fontSize(17).fill('#020617').text('Job Informations', { align: 'center', underline: true });
//     doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Job Name: ${managerData.job_name}`, { indent: 14 });
//     doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Manager Name: ${managerData.employee_name}`, { indent: 14 });
//     doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Date: ${todayDate}`, { indent: 14 });

//     doc.moveDown(); // Move down to create space between sections

//     doc.font('Times-Roman').fontSize(17).fill('#020617').text('Weather Informations', { align: 'center' , underline: true});
//     doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Weather Condition: ${managerData?.weatherCondition?.condition?.text}`, { indent: 14 });
//     doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Temperature (°C): ${managerData.weatherCondition.temp_c}`, { indent: 14 });

//     doc.moveDown();    
//     doc.font('Times-Roman').fontSize(17).fill('#020617').text('Checking Information', { align: 'center' , underline: true});
//     doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock In At: ${managerData.clockInAt} UTC+0`, { indent: 14 });
//     doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock Out At: ${managerData.ClockOutAt} UTC+0`, { indent: 14 });

//     doc.moveDown();

//     doc.font('Times-Roman').fontSize(16).fill('#020617').text('Manpower', { align: 'center' , underline: true});
//     doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Total workers: Coming Soon`, { indent: 14 });
//     doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Total Injured: Coming Soon`, { indent: 14 });
//     doc.moveDown();

//     doc.font('Times-Roman').fontSize(17).fill('#020617').text('Image', { align: 'center' , underline: true});

//     function addClickableImageLink(text, url) {
//       // Calculate the maximum width of the entire line (text + URL)
//       const lineMaxWidth = doc.widthOfString(`${text}: ${url}`, { indent: 20 });
  
//       // Add text with a link
//       doc.font('Times-Roman').fontSize(14).fill('#021c27').link(20, doc.y, lineMaxWidth, 20, url).text(`${text}: ${url}`, { indent: 20 });
  
//       // Move down to create space for the next content
//       doc.moveDown();
//     }
  
//     // Example usage
//     addClickableImageLink('injury_img', 'https://loamic-media.s3.useast-2.amazonaws.com/1707026887685-1200px-Node.js_logo.svg.png');
//     addClickableImageLink('progress_img', 'https://loamic-media.s3.us-east-2.amazonaws.com/1707026887704-hoe89yws-720.jpg');
//     addClickableImageLink('eod_img', 'https://loamic-media.s3.useast-2.amazonaws.com/1707026887708-_.jpg');

//     doc.moveDown();
//     doc.moveDown();
//     doc.end();

//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Internal Server Error');
//   }
// });

// http://localhost:5000/downloadManagerDailyReport?managerEmail=Jmassey@loamicbuilders.com

app.get('/downloadManagerDailyReport', async (req, res) => {
  const dateObj = new Date();
  const dateString = dateObj.toISOString();
  const todayDate = dateString.substring(0, 10);
  const managerEmail = req.query.managerEmail;
  const dailyReportCol = await managerDailyReportCollection.findOne({
    $and: [
      { Date: todayDate },
      { dailyReport: { $elemMatch: { email: managerEmail } } }
    ]
  });
  if (!dailyReportCol) {
    return res.send({ message: 'no daily report found for this manager in this date' });
  }
  const managerDataArray = dailyReportCol.dailyReport.filter(entry => entry.email === managerEmail);
  const managerData = managerDataArray[0];
  console.log(managerEmail);
  console.log(managerData)

  try {
    // Fetch data from the database using Mongoose
    const dataFromDatabase = 'rayhan'

    // Fetch image URL from the database
    const imageUrl = "https://loamic-media.s3.us-east-2.amazonaws.com/1706962846030-IMG-20240203-WA0000__1_-removebg.png";

    // Create a PDF
    const doc = new PDFDocument();

    // Use a writable stream to capture the PDF content
    const pdfBuffer = [];
    const pdfFilename = `invoice_${managerEmail}_${Date.now()}.pdf`;

    doc.on('data', chunk => pdfBuffer.push(chunk));
    doc.on('end', async () => {
      // Upload the PDF buffer to S3
      const params = {
        Bucket: 'loamic-media',
        Key: pdfFilename,
        Body: Buffer.concat(pdfBuffer),
        ContentType: 'application/pdf',
      };

      try {
        await s3.upload(params).promise();
        

        // Generate a pre-signed URL for the uploaded PDF
        const signedUrl = await s3.getSignedUrlPromise('getObject', {
          Bucket: 'loamic-media',
          Key: pdfFilename,
          Expires: 60 * 600, // Link expires in 5 minutes
        });

        // Send the pre-signed URL in JSON format as a response
        res.json({ downloadUrl: signedUrl });
      } catch (uploadError) {
        console.error(uploadError);
        res.status(500).send('Error uploading PDF to S3');
      }
    });

    const distanceMargin = 18;
    doc
      .fillAndStroke('#0e8cc3')
      .lineWidth(20)
      .lineJoin('round')
      .rect(
        distanceMargin,
        distanceMargin,
        doc.page.width - distanceMargin * 2,
        doc.page.height - distanceMargin * 2,
      )
      .stroke();

    try {
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);
      doc.image(
        imageBuffer,
        doc.page.width / 2 - 190 / 2,
        60,
        {
          fit: [190, 100],
          align: 'center',
        }
      );
    } catch (imageError) {
      console.error('Error downloading image:', imageError);
      // Handle error, you may want to use a default image in case of failure
    }

    doc.moveDown();
    doc.moveDown();
    doc.moveDown();
    doc.moveDown();
    doc.moveDown();
    doc.moveDown();
    doc.moveDown();

    doc.font('Times-Roman').fontSize(20).fill('#C2272F').text('Daily Report For Manager', { align: 'center'});
    doc.moveDown();

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Job Informations', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Job Name: ${managerData.job_name}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Manager Name: ${managerData.employee_name}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Date: ${todayDate}`, { indent: 14 });

    doc.moveDown(); // Move down to create space between sections

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Weather Informations', { align: 'center' , underline: true});
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Weather Condition: ${managerData.weaitherCondition.condition.text}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Temperature (°C): ${managerData.weaitherCondition.temp_c}`, { indent: 14 });

    doc.moveDown();    
    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Checking Information', { align: 'center' , underline: true});
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock In At: ${managerData.clockInAt} UTC+0`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock Out At: ${managerData.ClockOutAt} UTC+0`, { indent: 14 });

    doc.moveDown();

    doc.font('Times-Roman').fontSize(16).fill('#020617').text('Manpower', { align: 'center' , underline: true});
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Total workers: Comming Soon`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Total Injured: Comming Soon`, { indent: 14 });
    doc.moveDown();

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Image', { align: 'center' , underline: true});

    function addClickableImageLink(text, url) {
      // Calculate the maximum width of the entire line (text + URL)
      const lineMaxWidth = doc.widthOfString(`${text}: ${url}`, { indent: 20 });
  
      // Add text with a link
      doc.font('Times-Roman').fontSize(14).fill('#021c27').link(20, doc.y, lineMaxWidth, 20, url).text(`${text}: ${url}`, { indent: 20 });
  
      // Move down to create space for the next content
      doc.moveDown();
  }
  
  // Example usage
  addClickableImageLink('injury_img', 'https://loamic-media.s3.useast-2.amazonaws.com/1707026887685-1200px-Node.js_logo.svg.png');
  addClickableImageLink('progress_img', 'https://loamic-media.s3.us-east-2.amazonaws.com/1707026887704-hoe89yws-720.jpg');
  addClickableImageLink('eod_img', 'https://loamic-media.s3.useast-2.amazonaws.com/1707026887708-_.jpg');
  

    doc.moveDown();



    doc.moveDown();

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/downloadEmployeeDailyReport', async (req, res) => {
  const dateObj = new Date();
  const dateString = dateObj.toISOString();
  const todayDate = dateString.substring(0, 10);
  const managerEmail = req.query.managerEmail;
  const dailyReportCol = await managerDailyReportCollection.findOne({
    $and: [
      { Date: todayDate },
      { dailyReport: { $elemMatch: { email: managerEmail } } }
    ]
  });
  if (!dailyReportCol) {
    return res.send({ message: 'no daily report found for this manager in this date' });
  }
  const managerDataArray = dailyReportCol.dailyReport.filter(entry => entry.email === managerEmail);
  const managerData = managerDataArray[0];
  console.log(managerEmail);
  console.log(managerData)

  try {
    // Fetch data from the database using Mongoose
    const dataFromDatabase = 'rayhan'

    // Fetch image URL from the database
    const imageUrl = "https://loamic-media.s3.us-east-2.amazonaws.com/1706962846030-IMG-20240203-WA0000__1_-removebg.png";

    // Create a PDF
    const doc = new PDFDocument();

    // Use a writable stream to capture the PDF content
    const pdfBuffer = [];

    doc.on('data', chunk => pdfBuffer.push(chunk));
    doc.on('end', async () => {
      // Upload the PDF buffer to S3
      const params = {
        Bucket: 'loamic-media',
        Key: 'invoice.pdf',
        Body: Buffer.concat(pdfBuffer),
        ContentType: 'application/pdf',
      };

      try {
        await s3.upload(params).promise();

        // Set headers for triggering the download
        res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
        res.setHeader('Content-Type', 'application/pdf');

        // Stream the S3 object directly to the response
        const pdfStream = s3.getObject({ Bucket: 'loamic-media', Key: 'invoice.pdf' }).createReadStream();
        pdfStream.pipe(res);
      } catch (uploadError) {
        console.error(uploadError);
        res.status(500).send('Error uploading PDF to S3');
      }
    });

    const distanceMargin = 18;
    doc
      .fillAndStroke('#0e8cc3')
      .lineWidth(20)
      .lineJoin('round')
      .rect(
        distanceMargin,
        distanceMargin,
        doc.page.width - distanceMargin * 2,
        doc.page.height - distanceMargin * 2,
      )
      .stroke();

    try {
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);
      doc.image(
        imageBuffer,
        doc.page.width / 2 - 190 / 2,
        60,
        {
          fit: [190, 100],
          align: 'center',
        }
      );
    } catch (imageError) {
      console.error('Error downloading image:', imageError);
      // Handle error, you may want to use a default image in case of failure
    }

    doc.moveDown();
    doc.moveDown();
    doc.moveDown();
    doc.moveDown();
    doc.moveDown();
    doc.moveDown();
    doc.moveDown();

    doc.font('Times-Roman').fontSize(20).fill('#C2272F').text('Daily Report For Manager', { align: 'center'});
    doc.moveDown();

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Job Informations', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Job Name: ${managerData.job_name}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Manager Name: ${managerData.employee_name}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Date: ${todayDate}`, { indent: 14 });

    doc.moveDown(); // Move down to create space between sections

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Weather Informations', { align: 'center' , underline: true});
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Weather Condition: ${managerData.weaitherCondition.condition.text}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Temperature (°C): ${managerData.weaitherCondition.temp_c}`, { indent: 14 });

    doc.moveDown();    
    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Checking Information', { align: 'center' , underline: true});
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock In At: ${managerData.clockInAt} UTC+0`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock Out At: ${managerData.ClockOutAt} UTC+0`, { indent: 14 });

    doc.moveDown();

    doc.font('Times-Roman').fontSize(16).fill('#020617').text('Manpower', { align: 'center' , underline: true});
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Total workers: Comming Soon`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Total Injured: Comming Soon`, { indent: 14 });
    doc.moveDown();

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Image', { align: 'center' , underline: true});

    function addClickableImageLink(text, url) {
      // Calculate the maximum width of the entire line (text + URL)
      const lineMaxWidth = doc.widthOfString(`${text}: ${url}`, { indent: 20 });
  
      // Add text with a link
      doc.font('Times-Roman').fontSize(14).fill('#021c27').link(20, doc.y, lineMaxWidth, 20, url).text(`${text}: ${url}`, { indent: 20 });
  
      // Move down to create space for the next content
      doc.moveDown();
  }
  
  // Example usage
  addClickableImageLink('injury_img', 'https://loamic-media.s3.useast-2.amazonaws.com/1707026887685-1200px-Node.js_logo.svg.png');
  addClickableImageLink('progress_img', 'https://loamic-media.s3.us-east-2.amazonaws.com/1707026887704-hoe89yws-720.jpg');
  addClickableImageLink('eod_img', 'https://loamic-media.s3.useast-2.amazonaws.com/1707026887708-_.jpg');
  

    doc.moveDown();



    doc.moveDown();
    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
// -------------------------------------------employeeClockInCard------------------------------------

app.get('/employeeClockInCard', async (req, res) => {
  const id = parseInt(req.query.userId);
  const dateObj = new Date();
  const dateString = dateObj.toISOString();
  const todayDate = dateString.substring(0, 10);

  const employeeData = await clockInCollection.findOne({ ID: id })
  const clockInDetails = employeeData.ClockInDetails.filter(entry => entry.currentDate === todayDate);
  res.send(clockInDetails[0])
})

// --------------------------dailyWorkingBaseProject----------------------------------
app.get('/avalableProjectForEmployee', async (req, res) => {
  const result = await dailyRunningProject.find();
  res.send(result);
})

app.get('/managerCheckIn', async (req, res) => {
  const managerID = parseInt(req.query.managerId);
  const result = await dailyRunningProject.findOne({ 'managerInfo.ID': managerID })
  if (result) {
    return res.send(result);
  }
  else {
    res.send({ message: 'project not found' });
  }
})

app.post('/managerCheckOut', async (req, res) => {
  const managerID = parseInt(req.query.managerId);
  const dateObj = new Date();
  const dateString = dateObj.toISOString();
  const todayDate = dateString.substring(0, 10);
  const currentTime = dateString.substring(11, 16);

  const project = await dailyRunningProject.findOne({ 'managerInfo.ID': managerID })
  if (project) {
    const insert = await managerCheckInCollection.create({ projectData: project, checkOutDate: todayDate, checkOutTime: currentTime });
    const remove = await dailyRunningProject.deleteOne({ 'managerInfo.ID': managerID });
    console.log(remove)
    return res.send(remove);
  }
  else {
    res.send({ message: 'project not found' });
  }
})

// -------------------------------userCheckOut-----------------------------------
app.post('/employeeCheckOut', async (req, res) => {
  const employeeId = parseInt(req.query.employeeId);
  const dateObj = new Date();
  const dateString = dateObj.toISOString();
  const todayDate = dateString.substring(0, 10);
  const currentTime = dateString.substring(11, 16);

  const result = await clockInCollection.findOneAndUpdate(
    { "ID": employeeId },
    {
      $set: {
        'ClockInDetails.$[element].clockOutTime': currentTime,
      },
    },
    {
      arrayFilters: [{ 'element.currentDate': todayDate }],
      new: true,
    });
  console.log(result);
  res.send(result)
})

// -------------------------------------------------------checkIn-----------------------------------------------
app.post('/checkIn', async (req, res) => {
  const projectIdInt = parseInt(req.query.projectId);
  const userIdInt = parseInt(req.query.userId);
  const managerId = parseInt(req.query.managerId);
  const role = req.query.role;
  const dateObj = new Date();
  const dateString = dateObj.toISOString();
  const todayDate = dateString.substring(0, 10);
  const currentTime = dateString.substring(11, 16);

  const project = await projectCollection.findOne({ Project_id: projectIdInt }, { Project_id: 1, Project_Name: 1, Awarding_Body: 1, Client: 1, _id: 0, Project: 1, cover_image_url: 1, latitude: 1, longitude: 1 });
  const dailyRunningPRoject = await dailyRunningProject.findOne({ 'project.Project_id': projectIdInt }, { managerInfo: 1 })
  const newWeatherInfo = await axios.get(`https://api.weatherapi.com/v1/current.json?q=${project.latitude},${project.longitude}&key=${process.env.SECRETKEY}`);
  const newWeather = { ...newWeatherInfo.data.location, ...newWeatherInfo.data.current };

  if (role === 'manager') {
    const manager = await adminCollection.findOne({ ID: userIdInt }, { ID: 1, Employee_First_Name: 1, Employee_Last_Name_and_Suffix: 1, Role: 1, _id: 0 });
    console.log(manager)

    const isExist = await dailyRunningProject.findOne({ 'project.Project_id': projectIdInt });
    if (isExist) {
      return res.send({ massege: 'this project already listed in running project collection' })
    }
    else {
      const result = await dailyRunningProject.create({
        project, checkInDate: todayDate, checkInTime: currentTime, isCheckIn: true, managerInfo: manager, weather_condition: newWeather, manpower: {
          employee: 10,
          hours: 180,
          injured: 3,
        }
      });
      return res.send(result)
    }
  }
  else if (role === 'user') {
    const employee = await userCollection.findOne({ ID: userIdInt }, { ID: 1, First_Name: 1, Last_Name_and_Suffix: 1, Role: 1, _id: 0 });
    const isExists = await clockInCollection.findOne({ ID: userIdInt });

    if (!isExists) {
      const result = await clockInCollection.create({ ID: employee.ID, Name: employee.First_Name + ' ' + employee.Last_Name_and_Suffix, ClockInDetails: [{ currentDate: todayDate, managerId, projectInfo: { project, weather_condition: newWeather }, ClockInTime: currentTime, clockOutTime: 'on the way', managerInfo: dailyRunningPRoject.managerInfo }] })
      return res.send(result)
    } else {
      const isCheckedIn = await clockInCollection.findOne({ ID: userIdInt, ClockInDetails: { $elemMatch: { currentDate: todayDate } } })
      console.log(isCheckedIn)
      if (isCheckedIn) {
        return res.send({ message: 'user already check in today' })
      } else {
        const update = await clockInCollection.updateOne(
          { ID: userIdInt },
          {
            $push: { ClockInDetails: { currentDate: todayDate, managerId, projectInfo: { project, weather_condition: newWeather }, ClockInTime: currentTime, clockOutTime: 'on the way', managerInfo: dailyRunningPRoject.managerInfo } },
          },
        );
        return res.send(update);
      }
    }
  }
  res.send({ message: 'error! required query: "projectId" , "userId" , "role" ["role" should be "manager" or "user"]' })
})

// ------------------------------dailyReport---------------------------------------
app.post('/dailyReport', async (req, res) => {
  const userId = parseInt(req.query.userId);
  const projectId = parseInt(req.query.projectId);
  const role = req.query.role;
  const { activity, rental, workingUnderManagerId, isInjury } = req.query;
  // const { activity, rental, isInjury, date, workingUnderManagerId, employee, hours, injured } = req.body;
  const dateObj = new Date();
  const dateString = dateObj.toISOString();
  const todayDate = dateString.substring(0, 10);

  const project = await projectCollection.findOne({ Project_id: projectId }, { Project_id: 1, Project_Name: 1, _id: 0, latitude: 1, longitude: 1 });
  const newWeatherInfo = await axios.get(`https://api.weatherapi.com/v1/current.json?q=${project.latitude},${project.longitude}&key=${process.env.SECRETKEY}`);
  const newWeather = { ...newWeatherInfo.data.location, ...newWeatherInfo.data.current };


  upload(req, res, async (err) => {
    if (err) {
      console.error('Error uploading to S3:', err);
      return res.status(500).json({ error: 'Failed to upload to S3' });
    }

    const uploadPromises = [];

    // Loop through each field name and upload the corresponding file
    ['imagePath1', 'imagePath2', 'imagePath3'].forEach((fieldName) => {
      const file = req.files[fieldName][0];

      const params = {
        Bucket: 'loamic-media',
        Key: Date.now().toString() + '-' + file.originalname,
        Body: file.buffer,
        ACL: 'public-read',
        ContentType: file.mimetype,
      };

      uploadPromises.push(
        new Promise((resolve, reject) => {
          s3.upload(params, (err, data) => {
            if (err) {
              reject({ error: `Failed to upload ${fieldName} to S3` });
            } else {
              resolve({ message: `Image ${fieldName} uploaded successfully`, url: data.Location });
            }
          });
        })
      );
    });

    try {
      const results = await Promise.all(uploadPromises);

      console.log();

      if (role === 'user') {
        const user = await userCollection.findOne({ ID: userId }, { First_Name: 1, Last_Name_and_Suffix: 1, Role: 1, ID: 1, _id: 0 });
        console.log(user);
       
        const dailyReport = {
          job_name: project.Project_Name,
          job_id: project.Project_id,
          // clockInTime: clockInfo
          employee_name: user.First_Name + ' ' + user.Last_Name_and_Suffix,
          workingUnderManagerId: workingUnderManagerId,
          date: new Date,
          weaitherCondition: newWeather,
          activity: activity,
          rental: rental,
          isInjury: isInjury,
          injury_img: results[0].url,
          progress_img: results[1].url,
          eod_img: results[2].url,
        };

        const todayCollection = await dailyReportCollection.findOne({ Date: todayDate });

        if (todayCollection) {
          const update = await dailyReportCollection.updateOne(
            { Date: todayDate },
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
        const manager = await adminCollection.findOne({ ID: userId });
        const clockInfo = await managerCheckInCollection.findOne({
          $and: [
            { 'projectData.managerInfo.ID': userId },
            { checkOutDate: todayDate }
          ]
        });

        const dailyReportForManager = {
          job_name: project.Project_Name,
          job_id: project.Project_id,
          employee_name: manager.Employee_First_Name + ' ' + manager.Employee_Last_Name_and_Suffix,
          date: new Date,
          weaitherCondition: newWeather,
          clockInAt: clockInfo.projectData.checkInTime,
          ClockOutAt: clockInfo.checkOutTime,
          email: manager.email_address,
          activity: activity,
          manpower: {
            employee: "employee",
            hours: "hours",
            injured: "injured",
          },
          rental: rental,
          isInjury: false,
          injury_img: results[0].url,
          progress_img: results[1].url,
          eod_img: results[2].url,
        };

        const isDailyReportExists = await managerDailyReportCollection.findOne({
          $and: [
            { Date: todayDate },
            { dailyReport: { $elemMatch: { email: manager.email_address } } }
          ]
        });
        console.log(isDailyReportExists);

        if (!isDailyReportExists) {
          const todayCollection = await managerDailyReportCollection.findOne({ Date: todayDate });

          if (todayCollection) {
            const update = await managerDailyReportCollection.updateOne(
              { Date: todayDate },
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
        } else {
          const employee_name = manager.Employee_First_Name + ' ' + manager.Employee_Last_Name_and_Suffix;
          return res.send({ massege: `${employee_name} alreday submit his daily report today` });
        }

      }
    } catch (error) {
      res.status(500).json(error);
    }
  });
})

app.get('/users', async (req, res) => {
  const result = await userCollection.find();
  res.send(result);
})
app.get('/getManagerDailyReport', async (req, res) => {
  const result = await managerDailyReportCollection.find();
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

app.post('/addProject', async (req, res) => {
  const project = req.body;
  const result = await projectCollection.create(project);
  res.send(result);
})

app.post('/updateProject', async (req, res) => {
  const projectID = parseInt(req.query.projectId);
  const { Project_id, status, Project_Name, Awarding_Body, Client, Project, Street, City, County, State, Zip, Contract_value, Project_Intro, Project_Duration, Project_Start_Date, Project_Complete_Date, Project_Category, Project_Type, cover_image_url, img_1_url, img_2_url, img_3_url, img_4_url, img_5_url, img_6_url, img_7_url, img_8_url, video_1_url, video_2_url } = req.body;

  const result = await projectCollection.updateOne(
    { Project_id: projectID },
    { $set: { Project_id: Project_id, status: status, Project_Name: Project_Name, Awarding_Body: Awarding_Body, Client: Client, Project: Project, Street: Street, City: City, County: County, State: State, Zip: Zip, Contract_value: Contract_value, Project_Intro: Project_Intro, Project_Duration: Project_Duration, Project_Start_Date: Project_Start_Date, Project_Complete_Date: Project_Complete_Date, Project_Category: Project_Category, Project_Type: Project_Type, cover_image_url: cover_image_url, img_1_url: img_1_url, img_2_url: img_2_url, img_3_url: img_3_url, img_4_url: img_4_url, img_5_url: img_5_url, img_6_url: img_6_url, img_7_url: img_7_url, img_8_url: img_8_url, video_1_url: video_1_url, video_2_url: video_2_url } },
  );
  res.send(result);
})

// ----------------------------------employeeSection--------------------------------------
app.post('/addEmployee', async (req, res) => {
  const employee = req.body;
  const result = await adminCollection.create(employee);
  res.send(result);
})

app.post('/updateEmployee', async (req, res) => {
  const employeeID = parseInt(req.query.employeeId);
  const { Employee_Last_Name_and_Suffix, Employee_First_Name, Employee_Status, Role, email_address, password } = req.body;
  console.log(req.body);

  const result = await adminCollection.updateOne(
    { ID: employeeID },
    { $set: { Employee_Last_Name_and_Suffix: Employee_Last_Name_and_Suffix, Employee_First_Name: Employee_First_Name, Employee_Status: Employee_Status, Role: Role, email_address: email_address, password: password } },
  );
  res.send(result);
})

// -------------------------------------ContractPage---------------------------------------------
app.post('/addContract', async (req, res) => {
  const contract = req.body;
  const result = await contractCollection.create(contract);
  res.send(result);
})

app.post('/updateContract', async (req, res) => {
  const contractID = parseInt(req.query.contractId);
  const { Project_id, Name, Title, email, Company, Phone_number } = req.body;

  const result = await contractCollection.updateOne(
    { _id: new Object(contractID) },
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