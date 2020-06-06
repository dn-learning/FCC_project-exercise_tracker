const dotenv = require('dotenv');
dotenv.config();
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.DB_URI, {useNewUrlParser: true, useUnifiedTopology: true});

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
});

// Mongo Schemas
const Schema = mongoose.Schema;

const exerciseSchema = new Schema({
    "description": String,
    "duration": Number,
    "date": { type: Date, default: Date.now }
});

const userSchema = new Schema({
    username: String,
    count: { type: Number, default: 0 },
    log: [exerciseSchema]
});

//Mongo Models
const User = mongoose.model('User', userSchema);

// New endpoints
app.post('/api/exercise/new-user', (req, res, next) => {
let user = new User({
    username: req.body.username
});

user.save(function (err, user) {
    if (err) next(err);

    return res.json({
        "username": user.username,
        "_id": user._id
        });
    });
});

app.get('/api/exercise/users', (req, res, next) => {
    let query =  User.find();

    query.select('_id username');
    query.exec(function(err, users){
        if (err) next(err);

        return res.json(users);
    });
});

app.post('/api/exercise/add', (req, res, next) => {
    const { userId, description, duration, date } = req.body;
    if (userId.length == 0 || description.length == 0 || duration.length == 0 ) {
        // throw new Error('Please input userId, description, duration');
        return next({status: 400, message: 'Please input userId, description, duration'})
    }

    let exerciseDate = new Date(date);
    if (!exerciseDate.getMonth()) { exerciseDate = new Date(); }

    User.findById(userId, function(err, user){
        if (err || !user) {
            return next();
        }
        let count = user.count;
        user.count = count+1;
        user.log.push({
            "description": description,
            "duration": duration,
            "date": exerciseDate
        });

        user.save(function(err, user){
            if (err) return next(err);
            return res.json({
                "_id": user._id,
                "username": user.username,
                "count": user.count,
                "log": {
                    "description": description,
                    "duration": duration,
                    "date": exerciseDate
                }
            });
        });
    });
});

app.get('/api/exercise/log', (req, res, next) => {
    let userId = req.query.userId;
    let from = req.query.from;
    let to = req.query.to;
    let limit = req.query.limit;

    if (!userId || userId.length == 0) {
        return next({"message": "Unknown userId"});
    }
    let query = User.find({_id: userId});

    if (from && from.length == 10) {
        query.where('log.date').gte(from);
    }

    if (to && to.length == 10) {
        query.where('log.date').lte(to);
    }

    if (limit && limit.length > 0) {
        query.slice('log', parseInt(limit));
    }
    query.exec(function(err, user){
        if (err) next(err);

        return res.json(user);
    });
});

// Not found middleware
app.use((req, res, next) => {
    return next({status: 404, message: 'not found'})
});

// Error Handling middleware
app.use((err, req, res, next) => {
    let errCode, errMessage

    if (err.errors) {
        // mongoose validation error
        errCode = 400 // bad request
        const keys = Object.keys(err.errors)
        // report the first validation error
        errMessage = err.errors[keys[0]].message
    } else {
        // generic or custom error
        errCode = err.status || 500
        errMessage = err.message || 'Internal Server Error'
    }
    res.status(errCode).type('txt')
    .send(errMessage)
});

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
});
