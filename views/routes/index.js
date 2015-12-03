var express = require('express');
var router = express.Router();
var net = require('net');
var Server = require('../models/Server');
var ipaddr = require('ipaddr.js');

var requestGameInfo = function requestGameInfo(req, res, address, port, key) {
  var netComGI = new Buffer([0, 4, 0, 0, 0, 9]);
  var socket = new net.Socket();
  var hasErrors = false;
  var errors;
  var data = {};
  socket.setTimeout(5500, function () {
    errors = {};
    errors.code = 'TIMEOUT';
    errors.message = 'Socket timeout'; 
    hasErrors = true;
    socket.destroy();
  })
  socket.connect(port, address, function() {
    socket.write(netComGI);
  });
  
  socket.on('data', function (bdata) {
    var buffData = bdata.toJSON().data;
    if (buffData.length > 0) {
      var size = ((buffData[0] << 8) | buffData[1]);
      var packetType = ((buffData[2] << 24) | (buffData[3] << 16) | (buffData[4] << 8) | (buffData[5])); 
      if (packetType == 9) {
        data = JSON.parse(bdata.toString('utf8', 6, 6 + size - 5));
        socket.destroy();
      }
    }
    
  });
  
  socket.on('close', function() {
    if (hasErrors) {
      if (errors.code == 'ECONNREFUSED' || errors.code == 'EHOSTUNREACH' || errors.code == 'TIMEOUT') {
        console.error(errors);
        res.json({status: 404, message: 'Unable to reach game server, make sure your ports are open.'});
      } else {
        console.error(errors);
        res.json({status: 500, message: 'An unknown error has occured. If this state persists, please contact the developers.'}); 
      }
    } else {
      updateServer(req, res, address, port, key, data);
    }
  });
  
  socket.on('error', function (err) {
    errors = err;
    console.error(err);
    hasErrors = true;
  })
}

// update server list and display it
router.get('/', function(req, res, next) {
  removeOldServers(req, res);
});

// register a new server
router.post('/', function(req, res, next) {
  var body = req.body;
  var address = req.cf_ip;
  var port = body.port;
  var key = body.key;
  register(req, res, key, address, port);
});

// update a server as a result of a heartbeat
router.put('/', function(req, res, next) {
  var body = req.body;
  var players = body.players;
  var token = body.token;
  var gameInfo = body.gameInfo;
  heartbeat(req, res, token, players, gameInfo);
});

var daysInMonth = [31, 30, 31, 30, 31, 31, 30, 31];
var months = ['March', 'April', 'May', 'June', 'July', 'August', 'September', 'October']

var daySuffix = function daySuffix(day) {
    var j = day % 10,
        k = day % 100;
    if (j == 1 && k != 11) {
        return day + "st";
    }
    if (j == 2 && k != 12) {
        return day + "nd";
    }
    if (j == 3 && k != 13) {
        return day + "rd";
    }
    return day + "th";
}

var formatNumVals = function formatNumVals(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

router.get('/:id', function(req, res, next) {
  var id = parseInt(req.params.id,10);
  if (id) {
    Server.findOne({serverId: id}, function (err, server) {
      if (!err) {
        if (server) {             
          var customGI = {}
          var monthNum = Math.floor(server.gameInfo.month % 8);
          customGI.month = months[monthNum];
          var dayNum = Math.floor((server.gameInfo.day / 0x10000) * daysInMonth[monthNum]) + 1;
          customGI.day = daySuffix(dayNum);
          customGI.year = Math.floor(server.gameInfo.month / 8) + 1;
          if (server.gameInfo.cash) { 
            customGI.cash = formatNumVals(Math.floor(server.gameInfo.cash/10));
          }
          if (server.gameInfo.parkValue) { 
            customGI.parkValue = formatNumVals(Math.floor(server.gameInfo.parkValue/10));
          }
          if (server.gameInfo.guests) { 
            customGI.guests = formatNumVals(server.gameInfo.guests);
          }     
          if (req.returnJSON) {
            var serverResponse = {
              name: server.name,
              description: server.description,
              requiresPassword: server.requiresPassword,
              players: server.players,
              maxPlayers: server.maxPlayers,
              dedicated: server.dedicated,
              gameInfo: server.gameInfo,
              customGI: customGI,
              provider: server.provider
            }
            res.json({status: 200, server: serverResponse});
          } else {
            server.customGI = customGI;
            res.render('server', {server: server});
          }
        } else {
          var msg = 'Server with the specified ID was not found';        
          if (req.returnJSON) {
            res.json({status: 500, message: msg});
          } else {
            res.render('server', {error: true, message: msg});
          }
        }
      } else {
        var msg = 'Unable to retreive server information from the database';        
        if (req.returnJSON) {
          res.json({status: 500, message: msg});
        } else {
          res.render('server', {error: true, message: msg});
        }
      }
    }); 
  } else {
    var msg = 'The requested ID is not in the accepted format. Make sure the ID is a numeric value.';
    if (req.returnJSON) {
      res.json({status: 400, message: msg});
    } else {
      res.render('server', {error: true, message: msg});
    }
  }
});

var heartbeat = function heartbeat(req, res, token, players, gameInfo) {
  Server.findById(token, function (err, server) {
    if (!err) {
      if (server) {
        server.players = players;
        server.gameInfo = gameInfo;
        server.updated_at = new Date();
        server.save(function (err, serverSave) {
          if (!err) {
            res.json({status: 200});
          } else {
            console.error(err);
            res.json({status: 500, message: 'Could not save the server entry'});
          }
        });
      } else {
        res.json({status: 401, message: 'Invalid token'});
      }
    } else {
      console.error(err);
      res.json({status: 500, message: 'Database failiure'});
    }
  });
}

var register = function register(req, res, key, address, port) {
  Server.findOne({key: key}, function (err, server) {
    if (!err) {
      if (server) {
        if (ipaddr.IPv4.isValid(address)) {
          server.ip.v4.push(address);
          server.supportsIPv4 = true;
        } else if (ipaddr.IPv6.isValid(address)) {
          server.ip.v6.push(address);
          server.supportsIPv6 = true;          
        }
        server.save(function (saveErr) {
          if (!saveErr) {
            res.json({status: 200, token: server._id});
          } else {
            console.error(saveErr);
            res.json({status: 500, message: 'Save failed'});
          }
        });
      } else {
        requestGameInfo(req, res, address, port, key);  
      }
    } else {
      console.error(err);
      res.json({status: 500, message: 'Database failiure'});
    } 
  });
}


var updateServer = function updateServer(req, res, address, port, key, data) {
  var server = {
    key: key,
    ip : {
      v4: [],
      v6: []
    },
    port: port,
    name: data.name,
    requiresPassword: data.requiresPassword,
    description: data.description,
    version: data.version,
    players: data.players,
    maxPlayers: data.maxPlayers,
    supportsIPv4: false,
    supportsIPv6: false,
    provider: data.provider
  }
  if (ipaddr.IPv4.isValid(address)) {
    server.ip.v4.push(address);
    server.supportsIPv4 = true;
  } else if (ipaddr.IPv6.isValid(address)) {
    server.ip.v6.push(address);
    server.supportsIPv6 = true;          
  }
  Server.create(server, function (err, newServer) {
    if (!err) {
      res.json({status: 200, token: newServer._id});    
    } else {
      console.error(err);
      res.json({status: 500, message: "An error ocured while updating the server record"});
    }
  });
}

var listServers = function listServers(req, res) {
  Server.find().exec(function (err, data) {
    if (!err) {
      var responseData = []
      data.forEach( function (server) {
        var customGI = {}
        var monthNum = Math.floor(server.gameInfo.month % 8);
        customGI.month = months[monthNum];
        var dayNum = Math.floor((server.gameInfo.day / 0x10000) * daysInMonth[monthNum]) + 1;
        customGI.day = daySuffix(dayNum);
        customGI.year = Math.floor(server.gameInfo.month / 8) + 1; 
        if (server.gameInfo.cash) { 
          customGI.cash = formatNumVals(Math.floor(server.gameInfo.cash/10));
        }
        if (server.gameInfo.parkValue) { 
          customGI.parkValue = formatNumVals(Math.floor(server.gameInfo.parkValue/10));
        }
        if (server.gameInfo.guests) { 
          customGI.guests = formatNumVals(server.gameInfo.guests);
        }  
        var serverData = {
          name: server.name,
          description: server.description,
          version: server.version,
          players: server.players,
          maxPlayers: server.maxPlayers,
          port: server.port,
          dedicated: server.dedicated,
          ip: server.ip,
          requiresPassword: server.requiresPassword,
          supportsIPv4: server.supportsIPv4,
          supportsIPv6: server.supportsIPv6,
          serverId: server.serverId,
          gameInfo: server.gameInfo,
          customGI: customGI,
          provider: server.provider
        }
        responseData.push(serverData);
      });
      if (req.returnJSON) {
        res.json({status: 200, servers: responseData});
      } else {
        res.render('index', {data:responseData, title: "OpenRCT2 Master Server"});
      }
    } else {
      console.error(err);
      var msg = 'Error fetching the server list. If this error persists, please contact the developers.';
      if (req.returnJSON) {
        res.json({status: 500, message: msg});
      } else {
        res.render('index', {error: true, message: msg, title: "OpenRCT2 Master Server | Error"});
      }      
    }
  });
}

var removeOldServers = function removeOldServers(req, res) {
  Server.find().where('updated_at').lt(new Date(new Date() - 1000 * 70)).remove().exec(function(err, data) {
    if (req) {
      if (!err) {
          listServers(req, res);
      } else {
        console.error(err);
        var msg = 'Error cleaning up the server list. If this error persists, please contact the developers.';
        if (req.returnJSON) {
          res.json({status: 500, message: msg});
        } else {
          res.render('index', {error: true, message: msg, title: "OpenRCT2 Master Server | Error"})
        }
      }
    } else {
      if (!err) {
        console.log("Database refreshed on load");
      } else {
        console.error(err);
      }
    }
  });
}

removeOldServers();

module.exports = router;
