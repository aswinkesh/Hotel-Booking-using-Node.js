const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
var useragent = require('express-useragent');

const admin= require('./routes/v1/admin/admin');
const enduser = require('./routes/v1/enduser/user');


const app=express();




var port = 3000;
app.use(bodyParser.urlencoded({
    extended: true,
    limit: '150mb'
}));
app.use(bodyParser.json({ limit: '150mb' }));

// CORS SETUP
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

//SECURITY SETUP

app.use(cors());
app.use(helmet({crossOriginResourcePolicy:false})); 
//CONSOLES THE USER INFORMATION AND API CALLS INTO THE SERVER ENVIRONMENT
app.use(useragent.express());
app.use((req, res, next) => {
var fullUrl = req.protocol + '://' + req.get('host') +
req.originalUrl;
console.log(fullUrl)
next();
})

mongoose.connect('mongodb+srv://aswinkesh07:aswin@cluster0.cvxcxtz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',).then(() => {
    console.log('DATABASE CONNECTED SUCCESSFULLY');
}).catch((err) => {
    console.log('Error connecting to database');
    console.log(err);
});

app.use(admin);
app.use(enduser);

const server = app.listen(port, function() {
    console.log("SERVER RUNNING ON PORT : " +port);
}); 