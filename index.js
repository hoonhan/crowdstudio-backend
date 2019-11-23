// DEPENDENCIES
const mongoose = require('mongoose');
const express = require('express');
var cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('morgan');
const path = require('path')

// MODULES
const socketHandler = require('./socketHandler')

const dbRoute = "mongodb+srv://admin:139752648@colseq-kzukw.mongodb.net/crowdstudio?retryWrites=true&w=majority"

// SET UP
const API_PORT = 3001;
const app = express();
app.use(cors());
const router = express.Router();

// DATABASE SET UP AND CONNECT
mongoose.connect(dbRoute, { useNewUrlParser: true });
let db = mongoose.connection;
db.once('open', () => console.log('connected to the database'));
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// PARSING + LOGGING
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(logger('dev'));


router.get('/', (req, res) => {
  return res.sendFile(path.join(__dirname + "/index.html"))
})


// UTILIZE
app.use('/', router);

// START SERVER
const server = app.listen(API_PORT, "0.0.0.0", () => console.log(`LISTENING ON PORT ${API_PORT}`));

// SOCKET HANDLER
socketHandler(server)