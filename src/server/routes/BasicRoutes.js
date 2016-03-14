'use strict';
var R = require('ramda'),
    Utils = require('../ServerUtils.js'),
    UserAPI = require('./Users'),
    TableAPI = require('./Tables'),
    ProjectAPI = require('./Projects'),
    EXTERNAL_API = R.map(R.partial(R.omit,['Handler']), UserAPI.concat(ProjectAPI).concat(TableAPI)),
    GameTypes = require('../GameTypes'),

    debug = require('debug'),
    _ = require('lodash'),
    log = debug('NetsBlox:API:log'),
    hash = require('../../common/sha512').hex_sha512,
    randomString = require('just.randomstring'),
    fs = require('fs'),
    path = require('path'),
    EXAMPLES = require('../examples'),

    // PATHS
    PATHS = [
        'Costumes',
        'Sounds',
        'libraries',
        'Backgrounds'
    ],
    CLIENT_ROOT = path.join(__dirname, '..', '..', 'client', 'Snap--Build-Your-Own-Blocks');

var createIndexFor = function(name, list) {
        return list
        .filter(item => item.toUpperCase() !== name.toUpperCase())
        .map(function(item) {
            return [item, item, item].join('\t');
        }).join('\n');
    };


// Create the paths
var resourcePaths = PATHS.map(function(name) {
    var resPath = path.join(CLIENT_ROOT, name);

    return { 
        Method: 'get', 
        URL: name + '/:filename',
        Handler: function(req, res) {
            if (req.params.filename === name.toUpperCase()) {  // index
                // Load the costumes and create rough HTML content...
                fs.readdir(resPath, function(err, resources) {
                    if (err) {
                        return res.send(err);
                    }

                    var result = createIndexFor(name, resources);
                    return res.send(result);
                });
            } else {  // retrieve a file
                res.sendFile(path.join(resPath, req.params.filename));
            }
        }
    };
});

// Add importing tools to the resource paths
var toolRoute = { 
    Method: 'get', 
    URL: 'tools.xml',
    Handler: function(req, res) {
        // Load the costumes and create rough HTML content...
        res.sendFile(path.join(CLIENT_ROOT, 'tools.xml'));
    }
};
resourcePaths.push(toolRoute);

// Add importing rpcs to the resource paths
var rpcRoute = { 
    Method: 'get', 
    URL: 'rpc/:filename',
    Handler: function(req, res) {
        var RPC_ROOT = path.join(__dirname, '..', 'rpc', 'libs');
        if (req.params.filename === 'RPC') {
            fs.readdir(RPC_ROOT, function(err, resources) {
                if (err) {
                    return res.send(err);
                }

                // Only xml files
                resources = resources.filter(res => res.indexOf('.xml') > -1);
                var result = createIndexFor('rpc', resources);
                return res.send(result);
            });
        } else {  // Send RPC file
            res.sendFile(path.join(RPC_ROOT, req.params.filename));
        }
    }
};
resourcePaths.push(rpcRoute);



module.exports = [
    { 
        Method: 'get', 
        URL: 'ResetPW',
        Handler: function(req, res) {
            log('password reset request:', req.query.Username);
            var self = this,
                username = req.query.Username;

            // Look up the email
            self.storage.users.get(username, function(e, user) {
                if (e) {
                    log('Server error when looking for user: "'+username+'". Error:', e);
                    return res.serverError(e);
                }

                if (user) {
                    delete user.hash;  // force tmp password creation
                    user.save();
                    return res.sendStatus(200);
                } else {
                    log('Could not find user to reset password (user "'+username+'")');
                    return res.status(400).send('ERROR: could not find user "'+username+'"');
                }
            });
        }
    },
    { 
        Method: 'get', 
        URL: 'SignUp',
        Handler: function(req, res) {
            log('Sign up request:', req.query.Username, req.query.Email);
            var self = this,
                uname = req.query.Username,
                email = req.query.Email;

            // Must have an email and username
            if (!email || !uname) {
                log('Invalid request to /SignUp');
                return res.status(400).send('ERROR: need both username and email!');
            }

            self.storage.users.get(uname, function(e, user) {
                if (!user) {
                    var newUser = self.storage.users.new(uname, email);
                    newUser.save();
                    return res.send('User Created!');
                }
                log('User "'+uname+'" already exists. Could not make new user.');
                return res.status(401).send('ERROR: user exists');
            });
        }
    },
    { 
        Method: 'post', 
        URL: '',  // login/SignUp method
        Handler: function(req, res) {
            var hash = req.body.__h,
                socket;

            this.storage.users.get(req.body.__u, (e, user) => {
                if (e) {
                    log('Could not find user "'+req.body.__u+'": ' +e);
                    return res.serverError(e);
                }
                if (user && user.hash === hash) {  // Sign in 
                    req.session.username = req.body.__u;
                    log('"'+req.session.username+'" has logged in.');
                    // Associate the websocket with the username
                    socket = this.sockets[req.body.__sId];
                    if (!!socket) {  // websocket has already connected
                        socket.onLogin(req.body.__u);
                    }
                    return res.send(Utils.serializeArray(EXTERNAL_API));
                }
                log('Could not find user "'+req.body.__u+'"');

                return res.sendStatus(403);
            });
        }
    },
    // Add game types query
    { 
        Method: 'get', 
        URL: 'GameTypes',
        Handler: function(req, res) {
            return res.status(200).json(GameTypes);
        }
    },
    // index
    {
        Method: 'get',
        URL: 'Examples/EXAMPLES',
        Handler: function(req, res) {
            // if no name requested, get index
            console.log('Object.keys(EXAMPLES)',Object.keys(EXAMPLES));
            var result = Object.keys(EXAMPLES)
                .map(name => `${name}\t${name}\t  `)
                .join('\n');
            return res.send(result);
        }
    },
    // individual example
    {
        Method: 'get',
        URL: 'Examples/:name',
        Handler: function(req, res) {
            var name = req.params.name,
                uuid = req.query.sId,
                isPreview = req.query.preview,
                socket,
                example;

            if (!uuid) {
                return res.status(400).send('ERROR: No socket id provided');
            }

            if (!EXAMPLES.hasOwnProperty(name)) {
                this._logger.warn(`ERROR: Could not find example "${name}`);
                return res.status(500).send('ERROR: Could not find example.');
            }

            // This needs to...
            //  + create the table for the socket
            example = _.cloneDeep(EXAMPLES[name]);
            socket = this.sockets[uuid];
            var seat = example.primarySeat,
                table,
                result;

            if (!isPreview) {
                table = this.createTable(socket, name);
                // Check the table in 10 seconds
                setTimeout(this.checkTable.bind(this, table), 10000);
            } else {
                table = example;
                table.owner = socket;
            }
            //  + customize and return the table for the socket
            table = _.extend(table, example);

            result = {
                src: table.cachedProjects[seat],
                tableName: table.tableName,
                ownerId: table.owner.username,
                primarySeat: table.primarySeat
            }
            return res.json(result);
        }
    }
].concat(resourcePaths);
