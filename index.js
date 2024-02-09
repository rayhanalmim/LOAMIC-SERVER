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
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const pdf = require('html-pdf');

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
  { name: 'imagePath1', maxCount: 20 },
  { name: 'imagePath2', maxCount: 20 },
  { name: 'imagePath3', maxCount: 20 },
]);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // Your SMTP server host
  port: 587, // Your SMTP port
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'rayhanalmim1@gmail.com', // Your SMTP email address
    pass: 'zqazfffzddgcgbuz' // Your SMTP email password
  }
});

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

const dateObj = new Date();
const dateString = dateObj.toISOString();
const todayDate = dateString.substring(0, 10);
const currentTime = dateString.substring(11, 16);


app.get('/activeEmployee', async (req, res) => {
  const managerId = parseInt(req.query.managerId);

  const activeEmployee = await clockInCollection.aggregate([
    {
      $match: {
        'ClockInDetails.managerId': managerId,
        'ClockInDetails.currentDate': todayDate,
        'ClockInDetails.clockOutTime': "on the way"
      }
    },
    {
      $project: {
        ClockInDetails: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$ClockInDetails',
                as: 'detail',
                cond: {
                  $and: [
                    { $eq: ['$$detail.currentDate', todayDate] },
                    { $eq: ['$$detail.clockOutTime', "on the way"] }
                  ]
                }
              }
            },
            0
          ]
        }
      }
    }
  ]);

  res.send(activeEmployee);
});

// -------------------------------getPdf---

app.get('/test', async (req, res) => {
  const managerId = parseInt(req.query.managerId);
  const manager = await adminCollection.findOne({ ID: managerId })
  const activeEmployee = await clockInCollection.aggregate([
    {
      $match: {
        'ClockInDetails.managerId': managerId,
        'ClockInDetails.currentDate': todayDate,
      }
    },
    {
      $project: {
        ClockInDetails: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$ClockInDetails',
                as: 'detail',
                cond: {
                  $and: [
                    { $eq: ['$$detail.currentDate', todayDate] },
                  ]
                }
              }
            },
            0
          ]
        }
      }
    }
  ]);
  console.log(activeEmployee, manager);
  res.send(activeEmployee);
})

// ---------------------------newPdfForEmployee-------

app.get('/employeeActivitySend', async (req, res) => {
  const managerId = parseInt(req.query.managerId);
  const manager = await adminCollection.findOne({ ID: managerId })
  const activeEmployee = await clockInCollection.aggregate([
    {
      $match: {
        'ClockInDetails.managerId': managerId,
        'ClockInDetails.currentDate': todayDate,
      }
    },
    {
      $project: {
        ClockInDetails: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$ClockInDetails',
                as: 'detail',
                cond: {
                  $and: [
                    { $eq: ['$$detail.currentDate', todayDate] },
                  ]
                }
              }
            },
            0
          ]
        }
      }
    }
  ]);
  console.log(activeEmployee, manager);

  try {
    // Fetch image URL from the database
    const imageUrl = "https://loamic-media.s3.us-east-2.amazonaws.com/1706962846030-IMG-20240203-WA0000__1_-removebg.png";

    // Create a PDF
    const doc = new PDFDocument();

    // Use a writable stream to capture the PDF content
    const pdfBuffer = [];
    const pdfFilename = `${manager.Employee_First_Name}_${Date.now()}.pdf`;

    doc.on('data', chunk => pdfBuffer.push(chunk));
    doc.on('end', async () => {
      // Create a transporter for sending emails
      try {

        // Upload the PDF buffer to S3
        const params = {
          Bucket: 'loamic-media',
          Key: pdfFilename,
          Body: Buffer.concat(pdfBuffer),
          ContentType: 'application/pdf',
        };

        await s3.upload(params).promise();

        // Generate a pre-signed URL for the uploaded PDF
        const signedUrl = await s3.getSignedUrlPromise('getObject', {
          Bucket: 'loamic-media',
          Key: pdfFilename,
          Expires: 60 * 6000, // Link expires in 5 minutes
        });

        // Send email with the generated PDF link
        const emailOptions = {
          from: 'rayhanalmim1@gmail.com',
          to: 'Laith@loamicbuilders.com', // recipient email address
          subject: 'Employee Activity',
          html: `<!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Employee Daily Activity</title>
            <style>
              body {
                font-family: Arial, sans-serif;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                border: 1px solid #ccc;
              }
              .logo img {
                max-width: 100px;
                height: auto;
              }
              .report-info {
                margin-top: 20px;
              }
              .info p {
                margin: 5px 0;
              }
              .info p strong {
                font-weight: bold;
              }
              .info p a {
                color: blue;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <img src="https://loamic-media.s3.us-east-2.amazonaws.com/1706962846030-IMG-20240203-WA0000__1_-removebg.png" alt="Loamic Builders Logo">
              </div>
              <div class="report-info">
                <h2>Employee Daily Activity</h2>
                <div class="info">
                  <p><strong>Manager Name:</strong> ${manager.Employee_First_Name + ' ' + manager.Employee_Last_Name_and_Suffix}</p>
                  <p><strong>Date:</strong> ${todayDate}</p>
                  <p><strong>Employee Daily Activity PDF:</strong> <a href="${signedUrl}">Download PDF</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
          `,
        };

        transporter.sendMail(emailOptions, (err, info) => {
          if (err) {
            console.error('Error sending email:', err);
            res.status(500).send('Error sending email');
          } else {
            console.log('Email sent successfully:', info);
            // Send the pre-signed URL in JSON format as a response
            res.json({ downloadUrl: signedUrl, message: 'Email sent successfully' });
          }
        });
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    // Function to draw a border on the page
    function drawBorder() {
      const distanceMargin = 18;
      doc.fillAndStroke('#0e8cc3')
        .lineWidth(20)
        .lineJoin('round')
        .rect(
          distanceMargin,
          distanceMargin,
          doc.page.width - distanceMargin * 2,
          doc.page.height - distanceMargin * 2,
        )
        .stroke();
    }
    drawBorder();

    // Event handler to draw border on each new page
    doc.on('pageAdded', () => {
      drawBorder();
    });


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

    doc.font('Times-Roman').fontSize(20).fill('#C2272F').text('Employees Daily Activity', { align: 'center' });
    doc.moveDown();

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Job Informations', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Job Name: ${activeEmployee[0].ClockInDetails.projectInfo.project.Project_Name}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Superintendent Name: ${manager.Employee_First_Name + ' ' + manager.Employee_Last_Name_and_Suffix}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Date: ${todayDate}`, { indent: 14 });

    doc.moveDown(); // Move down to create space between sections

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Weather Informations', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Weather Condition: ${activeEmployee[0].ClockInDetails.projectInfo.weather_condition.condition.text}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Temperature (F): ${activeEmployee[0].ClockInDetails.projectInfo.weather_condition.temp_f}`, { indent: 14 });

    doc.moveDown();


    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Checking Information:', { align: 'center', underline: true });

    doc.moveDown();
    // Iterate over data array
    activeEmployee.forEach(entry => {
      const { Name, ClockInTime, clockOutTime, activity } = entry.ClockInDetails;

      doc.font('Times-Bold').fontSize(14).fill('#021c27').text(`Name: ${Name}`, { indent: 14 });
      doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock In At: ${ClockInTime} UTC+0`, { indent: 14 });
      doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock Out At: ${clockOutTime} UTC+0`, { indent: 14 });
      doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Activity: ${activity}`, { indent: 14 });

      // Add spacing between entries
      doc.moveDown();
      doc.moveDown();
    });

    doc.moveDown();

    doc.moveDown();

    doc.end();


  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }

})

// --------------------------daynamic_Pdf_Create------------------------

app.get('/downloadEmployeeDailyReport', async (req, res) => {
  const employeeId = parseInt(req.query.employeeId);

  const dailyReportCol = await dailyReportCollection.findOne({
    $and: [
      { Date: todayDate },
      { dailyReport: { $elemMatch: { employeeId: employeeId } } }
    ]
  });

  if (!dailyReportCol) {
    return res.send({ message: 'No daily report found for this manager on this date' });
  }

  const employeeDataArray = dailyReportCol.dailyReport.filter(entry => entry.employeeId === employeeId);
  const employeeData = employeeDataArray[0];

  try {
    // Fetch image URL from the database
    const imageUrl = "https://loamic-media.s3.us-east-2.amazonaws.com/1706962846030-IMG-20240203-WA0000__1_-removebg.png";

    // Create a PDF
    const doc = new PDFDocument();

    // Use a writable stream to capture the PDF content
    const pdfBuffer = [];
    const pdfFilename = `invoice_${employeeData.currentDate}_${Date.now()}.pdf`;

    doc.on('data', chunk => pdfBuffer.push(chunk));
    doc.on('end', async () => {
      // Create a transporter for sending emails
      try {
        // Fetch data from the database using Mongoose
        const dataFromDatabase = 'rayhan';

        // Upload the PDF buffer to S3
        const params = {
          Bucket: 'loamic-media',
          Key: pdfFilename,
          Body: Buffer.concat(pdfBuffer),
          ContentType: 'application/pdf',
        };

        await s3.upload(params).promise();

        // Generate a pre-signed URL for the uploaded PDF
        const signedUrl = await s3.getSignedUrlPromise('getObject', {
          Bucket: 'loamic-media',
          Key: pdfFilename,
          Expires: 60 * 6000, // Link expires in 5 minutes
        });

        // Send email with the generated PDF link
        const emailOptions = {
          from: 'rayhanalmim1@gmail.com',
          to: 'mehedihasanrooman@gmail.com', // recipient email address
          subject: 'Daily Report PDF',
          html: `<!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Employee Daily Report</title>
            <style>
              body {
                font-family: Arial, sans-serif;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                border: 1px solid #ccc;
              }
              .logo img {
                max-width: 100px;
                height: auto;
              }
              .report-info {
                margin-top: 20px;
              }
              .info p {
                margin: 5px 0;
              }
              .info p strong {
                font-weight: bold;
              }
              .info p a {
                color: blue;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <img src="https://loamic-media.s3.us-east-2.amazonaws.com/1706962846030-IMG-20240203-WA0000__1_-removebg.png" alt="Loamic Builders Logo">
              </div>
              <div class="report-info">
                <h2>Manager Daily Report</h2>
                <div class="info">
                  <p><strong>Employee Name:</strong> ${employeeData.employee_name}</p>
                  <p><strong>Date:</strong> ${todayDate}</p>
                  <p><strong>Daily Report PDF:</strong> <a href="${signedUrl}">Download PDF</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
          `,
        };

        transporter.sendMail(emailOptions, (err, info) => {
          if (err) {
            console.error('Error sending email:', err);
            res.status(500).send('Error sending email');
          } else {
            console.log('Email sent successfully:', info);
            // Send the pre-signed URL in JSON format as a response
            res.json({ downloadUrl: signedUrl, message: 'Email sent successfully' });
          }
        });
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    // PDF content creation...
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

    doc.font('Times-Roman').fontSize(20).fill('#C2272F').text('Daily Report For Employee', { align: 'center' });
    doc.moveDown();

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Job Informations', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Job Name: ${employeeData.job_name}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Superintendent Name: ${employeeData.workingUnderManagerId}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Date: ${todayDate}`, { indent: 14 });

    doc.moveDown(); // Move down to create space between sections

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Weather Informations', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Weather Condition: ${employeeData.weaitherCondition.condition.text}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Temperature (F): ${employeeData.weaitherCondition.temp_f}`, { indent: 14 });

    doc.moveDown();
    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Checking Information', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock In At: '04:45' UTC+0`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock Out At: '05:00' UTC+0`, { indent: 14 });

    doc.moveDown();

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Image', { align: 'center', underline: true });

    // Function to add images with titles directly to the PDF
    async function addImagesWithTitles(imageData) {
      // Group image URLs by file name
      const groupedImages = imageData.reduce((acc, { fieldName, url }) => {
        if (!acc[fieldName]) {
          acc[fieldName] = [];
        }
        acc[fieldName].push(url);
        return acc;
      }, {});

      // Iterate over each file name and its associated image URLs
      for (const [fieldName, urls] of Object.entries(groupedImages)) {
        // Add file name as title
        if (fieldName === 'imagePath1') {
          doc.font('Times-Roman').fontSize(14).fill('#021c27').text("Progress Image ", { indent: 14 });
        }
        else if (fieldName === 'imagePath2') {
          doc.font('Times-Roman').fontSize(14).fill('#021c27').text("EOD Image: ", { indent: 14 });
        }
        else if (fieldName === 'imagePath3') {
          doc.font('Times-Roman').fontSize(14).fill('#021c27').text("Receipt: ", { indent: 14 });
        }


        // Add images
        for (const imageUrl of urls) {
          try {
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);
            if (doc.y > doc.page.height - 250) {
              doc.addPage(); // Add a new page if the remaining space is insufficient
            }
            doc.image(
              imageBuffer,
              doc.page.width / 2 - 190 / 2,
              doc.y + 50, // Adjust Y position according to your needs
              {
                fit: [190, 100],
                align: 'center',
              }
            );
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
          } catch (error) {
            console.error('Error downloading image:', error);
            // Handle error, you may want to use a default image in case of failure
          }
        }
      }
    }

    // Example usage
    const allImageUrls = employeeData.allImage;

    await addImagesWithTitles(allImageUrls);

    doc.moveDown(); // Move down after adding all images



    doc.moveDown();

    doc.end();


  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/downloadManagerDailyReport', async (req, res) => {
  const managerEmail = req.query.managerEmail;

  const dailyReportCol = await managerDailyReportCollection.findOne({
    $and: [
      { Date: todayDate },
      { dailyReport: { $elemMatch: { email: managerEmail } } }
    ]
  });

  if (!dailyReportCol) {
    return res.send({ message: 'No daily report found for this manager on this date' });
  }

  const managerDataArray = dailyReportCol.dailyReport.filter(entry => entry.email === managerEmail);
  const managerData = managerDataArray[0];

  try {
    // Fetch image URL from the database
    const imageUrl = "https://loamic-media.s3.us-east-2.amazonaws.com/1706962846030-IMG-20240203-WA0000__1_-removebg.png";

    // Create a PDF
    const doc = new PDFDocument();

    // Use a writable stream to capture the PDF content
    const pdfBuffer = [];
    const pdfFilename = `${managerEmail}_${Date.now()}.pdf`;

    doc.on('data', chunk => pdfBuffer.push(chunk));
    doc.on('end', async () => {
      try {
        // Upload the PDF buffer to S3
        const params = {
          Bucket: 'loamic-media',
          Key: pdfFilename,
          Body: Buffer.concat(pdfBuffer),
          ContentType: 'application/pdf',
        };

        await s3.upload(params).promise();

        // Generate a pre-signed URL for the uploaded PDF
        const signedUrl = await s3.getSignedUrlPromise('getObject', {
          Bucket: 'loamic-media',
          Key: pdfFilename,
          Expires: 60 * 600, // Link expires in 5 minutes
        });

        // Send email with the generated PDF link
        const emailOptions = {
          from: 'accounting@loamicbuilders.com',
          to: 'Laith@loamicbuilders.com',
          subject: 'Daily Report PDF',
          html: `<!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Manager Daily Report</title>
            <style>
              body {
                font-family: Arial, sans-serif;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                border: 1px solid #ccc;
              }
              .logo img {
                max-width: 100px;
                height: auto;
              }
              .report-info {
                margin-top: 20px;
              }
              .info p {
                margin: 5px 0;
              }
              .info p strong {
                font-weight: bold;
              }
              .info p a {
                color: blue;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <img src="https://loamic-media.s3.us-east-2.amazonaws.com/1706962846030-IMG-20240203-WA0000__1_-removebg.png" alt="Loamic Builders Logo">
              </div>
              <div class="report-info">
                <h2>Manager Daily Report</h2>
                <div class="info">
                  <p><strong>Manager Name:</strong> ${managerData.employee_name}</p>
                  <p><strong>Date:</strong> ${todayDate}</p>
                  <p><strong>Daily Report PDF:</strong> <a href="${signedUrl}">Download PDF</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
          `,
        };

        transporter.sendMail(emailOptions, (err, info) => {
          if (err) {
            console.error('Error sending email:', err);
            res.status(500).send('Error sending email');
          } else {
            console.log('Email sent successfully:', info);
            // Send the pre-signed URL in JSON format as a response
            res.json({ downloadUrl: signedUrl, message: 'Email sent successfully' });
          }
        });
      } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading PDF to S3');
      }
    });

    // Function to draw a border on the page
    function drawBorder() {
      const distanceMargin = 18;
      doc.fillAndStroke('#0e8cc3')
        .lineWidth(20)
        .lineJoin('round')
        .rect(
          distanceMargin,
          distanceMargin,
          doc.page.width - distanceMargin * 2,
          doc.page.height - distanceMargin * 2,
        )
        .stroke();
    }
    drawBorder();

    // Event handler to draw border on each new page
    doc.on('pageAdded', () => {
      drawBorder();
    });

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

    doc.font('Times-Roman').fontSize(20).fill('#C2272F').text('Daily Report For Manager', { align: 'center' });
    doc.moveDown();

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Job Informations', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Job Name: ${managerData.job_name}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Manager Name: ${managerData.employee_name}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Date: ${todayDate}`, { indent: 14 });

    doc.moveDown(); // Move down to create space between sections

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Weather Informations', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Weather Condition: ${managerData.weaitherCondition.condition.text}`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Temperature (°F): ${managerData.weaitherCondition.temp_f}`, { indent: 14 });

    doc.moveDown();
    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Checking Information', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock In At: ${managerData.clockInAt} UTC+0`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Clock Out At: ${managerData.ClockOutAt} UTC+0`, { indent: 14 });

    doc.moveDown();

    doc.font('Times-Roman').fontSize(16).fill('#020617').text('Manpower', { align: 'center', underline: true });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Total workers: Comming Soon`, { indent: 14 });
    doc.font('Times-Roman').fontSize(14).fill('#021c27').text(`Total Injured: Comming Soon`, { indent: 14 });
    doc.moveDown();

    doc.font('Times-Roman').fontSize(17).fill('#020617').text('Image', { align: 'center', underline: true });

    async function addImagesWithTitles(imageData) {
      // Group image URLs by file name
      const groupedImages = imageData.reduce((acc, { fieldName, url }) => {
        if (!acc[fieldName]) {
          acc[fieldName] = [];
        }
        acc[fieldName].push(url);
        return acc;
      }, {});

      // Iterate over each file name and its associated image URLs
      for (const [fieldName, urls] of Object.entries(groupedImages)) {
        // Add file name as title
        if (fieldName === 'imagePath1') {
          doc.font('Times-Bold').fontSize(14).fill('#021c27').text("Progress Image: ", { indent: 14 });
        }
        else if (fieldName === 'imagePath2') {
          doc.font('Times-Bold').fontSize(14).fill('#021c27').text("EOD Image: ", { indent: 14 });
        }
        else if (fieldName === 'imagePath3') {
          doc.font('Times-Bold').fontSize(14).fill('#021c27').text("Receipt: ", { indent: 14 });
        }
        // Add images
        for (const imageUrl of urls) {
          try {
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);
            if (doc.y > doc.page.height - 250) {
              doc.addPage(); // Add a new page if the remaining space is insufficient
            }
            doc.image(
              imageBuffer,
              doc.page.width / 2 - 190 / 2,
              doc.y + 50, // Adjust Y position according to your needs
              {
                fit: [190, 100],
                align: 'center',
              }
            );
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
            doc.moveDown(); // Move down after printing each image
          } catch (error) {
            console.error('Error downloading image:', error);
            // Handle error, you may want to use a default image in case of failure
          }
        }
      }
    }

    // Example usage
    const allImageUrls = managerData.allImage;

    await addImagesWithTitles(allImageUrls);



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
  const { activity } = req.body;

  const result = await clockInCollection.findOneAndUpdate(
    { "ID": employeeId },
    {
      $set: {
        'ClockInDetails.$[element].clockOutTime': currentTime,
        'ClockInDetails.$[element].activity': activity,
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
      const result = await clockInCollection.create({ ID: employee.ID, Name: employee.First_Name + ' ' + employee.Last_Name_and_Suffix, ClockInDetails: [{ currentDate: todayDate, Name: employee.First_Name + ' ' + employee.Last_Name_and_Suffix, employeeId: employee.ID, managerId, projectInfo: { project, weather_condition: newWeather }, ClockInTime: currentTime, clockOutTime: 'on the way', activity: "added soon", managerInfo: dailyRunningPRoject.managerInfo }] })
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
            $push: { ClockInDetails: { currentDate: todayDate, Name: employee.First_Name + ' ' + employee.Last_Name_and_Suffix, employeeId: employee.ID, managerId, projectInfo: { project, weather_condition: newWeather }, ClockInTime: currentTime, clockOutTime: 'on the way', activity: "added soon", managerInfo: dailyRunningPRoject.managerInfo } },
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
  const workingUnderManagerId = parseInt(req.query.workingUnderManagerId);
  const role = req.query.role;
  const { activity, rental, isInjury } = req.query;

  const project = await projectCollection.findOne({ Project_id: projectId }, { Project_id: 1, Project_Name: 1, _id: 0, latitude: 1, longitude: 1 });
  const newWeatherInfo = await axios.get(`https://api.weatherapi.com/v1/current.json?q=${project.latitude},${project.longitude}&key=${process.env.SECRETKEY}`);
  const newWeather = { ...newWeatherInfo.data.location, ...newWeatherInfo.data.current };


  upload(req, res, async (err) => {
    if (err) {
      console.error('Error uploading to S3:', err);
      return res.status(500).json({ error: 'Failed to upload to S3' });
    }

    const uploadPromises = [];

    ['imagePath1', 'imagePath2', 'imagePath3'].forEach((fieldName) => {
      const files = req.files[fieldName];

      files.forEach((file) => {
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
                resolve({ fieldName: fieldName, url: data.Location }); // Include fieldName in the result
              }
            });
          })
        );
      });
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
          employeeId: userId,
          date: todayDate,
          weaitherCondition: newWeather,
          activity: activity,
          rental: rental,
          isInjury: isInjury,
          injury_img: results[0].url,
          progress_img: results[1].url,
          eod_img: results[2].url,
          allImage: results,
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
          allImage: results,
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

// --------------------------------------localApi-------------------------------------------

app.get('/', (req, res) => {
  res.send('Loamic server running');
});

app.listen(port, () => {
  console.log(`Loamic Server is running on port ${port}`);
});