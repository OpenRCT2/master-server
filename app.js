var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cloudflare = require('cloudflare-express');
var autoIncrement = require('mongoose-auto-increment');

var mongoose = require('mongoose');
var dbConnectionString = process.env.MONGOLAB_URI || process.env.MONGODB_URI || 'mongodb://localhost/orctmaster';

var options = {
  server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } },
  replset: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } }
};

mongoose.connect(dbConnectionString, options, function(err) {
    if(err) {
        console.log('database connection error', err);
    } else {
        console.log('database connection successful, will store OpenRCT2 server data');
    }
});

// make sure we intialized MAI
var connection = mongoose.createConnection(dbConnectionString);
autoIncrement.initialize(connection);

var routes = require('./routes/index');

var returnType = function returnType(req, res, next) {
  req.returnJSON = false;
  if (!req.accepts('html') && req.accepts('json')) {
    req.returnJSON = true; 
  }
  next();
}

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon(path.join(__dirname, 'public', 'favico.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cloudflare.restore());
app.enable('trust proxy');

app.get('*',returnType);
app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
