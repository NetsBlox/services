/*
 * Author: Miklos Maroti <mmaroti@gmail.com>
 *
 * Robot to server messages:
 *  mac_addr[6] time[4] 'I': identification, sent every second
 *  mac_addr[6] time[4] 'S' left[2] right[2]: driving speed response
 *  mac_addr[6] time[4] 'B' msec[2] tone[2]: beep response
 *  mac_addr[6] time[4] 'W' bits[1]: whiskers status
 *  mac_addr[6] time[4] 'R' dist[2]: ultrasound ranging response
 *  mac_addr[6] time[4] 'T' left[4] right[4]: wheel ticks
 *  mac_addr[6] time[4] 'D' left[2] right[2]: drive distance
 *  mac_addr[6] time[4] 'P' status[1]: button pressed
 *  mac_addr[6] time[4] 'L' led[1] cmd[1]: LED state change
 *  mac_addr[6] time[4] 'F' bits[1]: infra red detection event
 *  mac_addr[6] time[4] 'G' msec[2] pwr[1]: send infra red light
 *
 * Server to robot messages:
 *  'S' left[2] right[2]: set driving speed
 *  'B' msec[2] tone[2]: beep
 *  'R': ultrasound ranging
 *  'T': get wheel ticks
 *  'D' left[2] right[2]: drive certain distance
 *  'L' led[1] state[1]: change LED state
 *  'G' msec[2] pwr[1]: send infra red light
 *
 * Environment variables:
 *  ROBOSCAPE_PORT: set it to the UDP port (1973) to enable this module
 *  ROBOSCAPE_MODE: sets the NetsBlox interface type, can be "security",
 *      "native" or "both" (default)
 *
 */

/**
 * @service
 * @category Devices
 * @category GLOBAL
 */
'use strict';

const logger = require('../utils/logger')('roboscape');
const Robot = require('./robot');
const acl = require('./accessControl');
var dgram = require('dgram'),
    server = dgram.createSocket('udp4'),
    ROBOSCAPE_MODE = process.env.ROBOSCAPE_MODE || 'both';

/*
 * RoboScape - This constructor is called on the first
 * request to an RPC from a given room.
 * @constructor
 * @return {undefined}
 */
var RoboScape = function () {
    this._state = {
        registered: {}
    };
};

RoboScape.serviceName = 'RoboScape';
// keeps a dictionary of robot objects keyed by mac_addr
RoboScape.prototype._robots = {};

RoboScape.prototype._ensureLoggedIn = function() {
    if (this.caller.username !== undefined)
        throw new Error('Login required.');
};

RoboScape.prototype._ensureAuthorized = async function(robotId) {
    await acl.ensureAuthorized(this.caller.username, robotId);
};

// fetch the robot and updates its address. creates one if necessary
RoboScape.prototype._getOrCreateRobot = function (mac_addr, ip4_addr, ip4_port) {
    var robot = this._robots[mac_addr];
    if (!robot) {
        logger.log('discovering ' + mac_addr + ' at ' + ip4_addr + ':' + ip4_port);
        robot = new Robot(mac_addr, ip4_addr, ip4_port, server);
        this._robots[mac_addr] = robot;
    } else {
        robot.updateAddress(ip4_addr, ip4_port);
    }
    return robot;
};

// find the robot object based on the partial id or returns undefined
RoboScape.prototype._getRobot = async function (robotId) {
    robotId = '' + robotId;
    let robot;

    if(robotId.length < 4 || robotId.length > 12) return undefined;

    // autocomplete the robotId and find the robot object
    if (robotId.length === 12) {
        robot = this._robots[robotId];
    } else { // try to guess the rest of the id
        for (var mac_addr in this._robots) { // pick the first match
            if (mac_addr.endsWith(robotId)) {
                robotId = mac_addr;
                robot = this._robots[robotId];
            }
        }
    }

    // if couldn't find a live robot
    if (!robot) return undefined;

    await this._ensureAuthorized(robotId);
    return robot;
};

RoboScape.prototype._heartbeat = function () {
    for (var mac_addr in RoboScape.prototype._robots) {
        var robot = RoboScape.prototype._robots[mac_addr];
        if (!robot.heartbeat()) {
            logger.log('forgetting ' + mac_addr);
            delete RoboScape.prototype._robots[mac_addr];
        }
    }
    setTimeout(RoboScape.prototype._heartbeat, 1000);
};

/**
 * Returns the MAC addresses of the registered robots for this client.
 * @returns {array} the list of registered robots
 */
RoboScape.prototype._getRegistered = function () {
    var state = this._state,
        robots = [];
    for (var mac_addr in state.registered) {
        if (this._robots[mac_addr].isMostlyAlive()) {
            robots.push(mac_addr);
        } else {
            delete state.registered[mac_addr];
        }
    }
    return robots;
};

/**
 * Registers for receiving messages from the given robots.
 * @param {Union<Array<String>,String>} robots one or a list of robots
 * @deprecated
 */
RoboScape.prototype.eavesdrop = function (robots) {
    return this.listen(robots);
};

/**
 * Registers for receiving messages from the given robots.
 * @param {Union<Array<String>,String>} robots one or a list of robots
 */
RoboScape.prototype.listen = async function (robots) {
    var state = this._state;

    for (var mac_addr in state.registered) {
        if (this._robots[mac_addr]) {
            this._robots[mac_addr].removeClientSocket(this.socket);
        }
    }
    state.registered = {};

    if (!Array.isArray(robots)) {
        robots = ('' + robots).split(/[, ]/);
    }

    var ok = true;
    for (var i = 0; i < robots.length; i++) {
        var robot = await this._getRobot(robots[i]);
        if (robot) {
            state.registered[robot.mac_addr] = robot;
            robot.addClientSocket(this.socket);
        } else {
            ok = false;
        }
    }
    return ok;
};

/**
 * Returns the MAC addresses of all authorized robots.
 * @returns {Array<String>}
 */
RoboScape.prototype.getRobots = async function () {
    const availableRobots = Object.keys(this._robots);
    let robots = await acl.authorizedRobots(this.caller.username, availableRobots);
    return robots;
};


//
/**
 * Performs the pre-checks and maps the incoming call to a robot action.
 * @param {String} fnName name of the method/function to call on the robot object
 * @param {Array} args array of arguments
 */
RoboScape.prototype._passToRobot = async function (fnName, args) {
    args = Array.from(args);
    let robotId = args.shift();
    const robot = await this._getRobot(robotId);
    if (robot && robot.accepts(this.caller.clientId)) {
        let rv = robot[fnName].apply(robot, args);
        if (rv === undefined) rv = true;
        return rv;
    }
    return false;
};

if (ROBOSCAPE_MODE === 'native' || ROBOSCAPE_MODE === 'both') {
    /* eslint-disable no-unused-vars */
    /**
     * Returns true if the given robot is alive, sent messages in the
     * last two seconds.
     * @param {String} robot name of the robot (matches at the end)
     * @returns {Boolean} ``true`` if the robot is alive
     */
    RoboScape.prototype.isAlive = function (robot) {
        return this._passToRobot('isAlive', arguments);
    };

    /**
     * Sets the wheel speed of the given robots.
     * @param {String} robot name of the robot (matches at the end)
     * @param {Number} left speed of the left wheel in ``[-128, 128]``
     * @param {Number} right speed of the right wheel in ``[-128, 128]``
     * @returns {Boolean} ``true`` if the robot was found
     */
    RoboScape.prototype.setSpeed = function (robot, left, right) {
        return this._passToRobot('setSpeed', arguments);
    };

    /**
     * Sets one of the LEDs of the given robots.
     * @param {String} robot name of the robot (matches at the end)
     * @param {Number} led the number of the LED (0 or 1)
     * @param {Number} command false/off/0, true/on/1, or toggle/2
     * @returns {Boolean} ``true`` if the robot was found
     */
    RoboScape.prototype.setLed = function (robot, led, command) {
        return this._passToRobot('setLed', arguments);
    };

    /**
     * Beeps with the speaker.
     * @param {String} robot name of the robot (matches at the end)
     * @param {Number} msec duration in milliseconds
     * @param {Number} tone frequency of the beep in Hz
     * @returns {Boolean} ``true`` if the robot was found
     */
    RoboScape.prototype.beep = function (robot, msec, tone) {
        return this._passToRobot('beep', arguments);
    };

    /**
     * Turns on the infra red LED.
     * @param {String} robot name of the robot (matches at the end)
     * @param {BoundedNumber<0,1000>} msec duration in milliseconds
     * @param {BoundedNumber<0,100>} pwr power level
     * @returns {Boolean} ``true`` if the robot was found
     */
    RoboScape.prototype.infraLight = function (robot, msec, pwr) {
        return this._passToRobot('infraLight', arguments);
    };

    /**
     * Ranges with the ultrasound sensor
     * @param {String} robot name of the robot (matches at the end)
     * @returns {Number} range in centimeters
     */
    RoboScape.prototype.getRange = function (robot) {
        return this._passToRobot('getRange', arguments);
    };

    /**
     * Returns the current number of wheel ticks (1/64th rotations)
     * @param {String} robot name of the robot (matches at the end)
     * @returns {Array<Integer>} the number of ticks for the left and right wheels
     */
    RoboScape.prototype.getTicks = function (robot) {
        return this._passToRobot('getTicks', arguments);
    };

    /**
     * Drives the whiles for the specified ticks.
     * @param {String} robot name of the robot (matches at the end)
     * @param {Number} left distance for left wheel in ticks
     * @param {Number} right distance for right wheel in ticks
     * @returns {Boolean} ``true`` if the robot was found
     */
    RoboScape.prototype.drive = function (robot, left, right) {
        return this._passToRobot('drive', arguments);
    };

    /**
     * Sets the total message limit for the given robot.
     * @param {String} robot name of the robot (matches at the end)
     * @param {Number} rate number of messages per seconds
     * @returns {Boolean} ``true`` if the robot was found
     */
    RoboScape.prototype.setTotalRate = function (robot, rate) {
        return this._passToRobot('setTotalRate', arguments);
    };

    /**
     * Sets the client message limit and penalty for the given robot.
     * @param {String} robot name of the robot (matches at the end)
     * @param {Number} rate number of messages per seconds
     * @param {Number} penalty number seconds of penalty if rate is violated
     * @returns {Boolean} ``true`` if the robot was found
     */
    RoboScape.prototype.setClientRate = function (robot, rate, penalty) {
        return this._passToRobot('setClientRate', arguments);
    };
    /* eslint-enable no-unused-vars */
}

if (ROBOSCAPE_MODE === 'security' || ROBOSCAPE_MODE === 'both') {
    /**
     * Sends a textual command to the robot
     * @param {String} robot name of the robot (matches at the end)
     * @param {String} command textual command
     * @returns {String} textual response
     */
    RoboScape.prototype.send = async function (robot, command) {
        robot = await this._getRobot(robot);

        if (!robot || typeof command !== 'string') return false;

        // figure out the raw command after processing special methods, encryption, seq and client rate
        if (command.match(/^backdoor[, ](.*)$/)) { // if it is a backdoor directly set the command
            command = RegExp.$1;
            logger.log('executing ' + command);
        } else { // if not a backdoor handle seq number and encryption
            // for replay attacks
            robot.commandToClient(command);

            if (robot._hasValidEncryptionSet()) // if encryption is set
                command = robot.decrypt(command);

            var seqNum = -1;
            if (command.match(/^(\d+)[, ](.*)$/)) {
                seqNum = +RegExp.$1;
                command = RegExp.$2;
            }
            if (!robot.accepts(this.caller.clientId, seqNum)) {
                return false;
            }
            robot.setSeqNum(seqNum);
        }

        return robot.onCommand(command);
    };
}

server.on('listening', function () {
    var local = server.address();
    logger.log('listening on ' + local.address + ':' + local.port);
});

server.on('message', function (message, remote) {
    if (message.length < 6) {
        logger.log('invalid message ' + remote.address + ':' +
            remote.port + ' ' + message.toString('hex'));
    } else {
        var mac_addr = message.toString('hex', 0, 6); // pull out the mac address
        var robot = RoboScape.prototype._getOrCreateRobot(
            mac_addr, remote.address, remote.port);
        robot.onMessage(message);
    }
});

/* eslint no-console: off */
RoboScape.initialize = function () {
    console.log('ROBOSCAPE_PORT is ' + process.env.ROBOSCAPE_PORT);
    server.bind(process.env.ROBOSCAPE_PORT || 1973);

    setTimeout(RoboScape.prototype._heartbeat, 1000);
};

RoboScape.isSupported = function () {
    if (!process.env.ROBOSCAPE_PORT) {
        console.log('ROBOSCAPE_PORT is not set (to 1973), RoboScape is disabled');
    }
    return !!process.env.ROBOSCAPE_PORT;
};

module.exports = RoboScape;
