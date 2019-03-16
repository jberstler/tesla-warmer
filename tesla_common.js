/**** START USER CONFIG VARIABLES ****/
// minimum battery level (as a percent) required to start the climate
// this prevents us from doing things on a low battery
const MIN_BATTERY_LEVEL = 20;
const DEBUG_MODE = false;

var logfile; // set this if you want to log output to a file e.g. '/Users/starman/start_climate.log'
var loglevel = 'debug'; // one of 'fatal' 'error' 'warn' 'debug' or 'trace'
/**** END USER CONFIG VARIABLES ****/


const tjs = require('teslajs');

const username = "TESLA_USERNAME";
const password = "TESLA_PASSWORD";

// singleton logger instance created with a self-executing function
var logger = (function() {
    if (!logger) {
        if (DEBUG_MODE) {
            logfile = undefined;
            loglevel = 'debug';
        }

        logger = require('simple-node-logger').createSimpleLogger({
            logFilePath: logfile,
            level: loglevel,
            timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
        });
    }

    return logger;
})();

function loginToVehicle() {
    let options;

    return tjs.loginAsync(username, password)
        .then(result => {
            if (result.error) {
                logger.fatal(JSON.stringify(result.error));
                process.exit(1);
            } else {
                let token = result.authToken;
                logger.debug(`You've got an auth token!`);

                options = {
                    authToken: token
                };

                return tjs.vehicleAsync(options);
            }
        })
        .then(vehicle => {
            logger.trace(JSON.stringify(vehicle, null, '\t'));

            options.vehicleId = vehicle.vehicle_id;

            return options;
        });
}

function _checkAllConditions(vehicle, ...conditions) {
    logger.debug("Fetching vehicle data");
    return tjs.vehicleDataAsync(vehicle)
        .then(vehicleData => {
            for (var i = 0; i < conditions.length; i++) {
                let condition = conditions[i];
                // TODO at the moment, conditions just throw when they are not met
                // that's a little weird, no?
                condition(vehicleData);
            }
        });
}

function _userPresentCondition(userPresent) {
    let assertUserPresence = function(vehicleData) {
        if (userPresent != vehicleData.vehicle_state.is_user_present) {
            let message = `User is present: ${vehicleData.vehicle_state.is_user_present} Bailing out!`;
            logger.warn(message);
            throw message;
        } else {
            logger.debug(`User is present: ${vehicleData.vehicle_state.is_user_present} Proceeding.`);
        }
    };

    return assertUserPresence;
}

function _batteryMinimumCondition(minBatteryLevel) {
    let assertBatteryLevel = function(vehicleData) {
        if (minBatteryLevel && vehicleData.charge_state.battery_level < minBatteryLevel) {
            let message = `Battery level ${vehicleData.charge_state.battery_level}% is below minimum required ${minBatteryLevel}%. Bailing out!`;
            logger.warn(message);
            throw message;
        } else {
            logger.debug(`Battery is at ${vehicleData.charge_state.battery_level}%. Proceeding.`);
        }
    };

    return assertBatteryLevel;
}

function controlSentryMode(vehicle, start) {
    return _attemptToWakeUpTheCar(vehicle)
        .then(() => {
            logger.debug("Checking required conditions");
            return _checkAllConditions(vehicle,
                _batteryMinimumCondition(MIN_BATTERY_LEVEL),
                _userPresentCondition(false));
        })
        .then(() => {
            logger.debug('Starting sentry mode');
            if (DEBUG_MODE) {
                return tjs.flashLightsAsync(vehicle);
            } else {
                return tjs.setSentryModeAsync(vehicle, start);
            }
        });
}

/*
 * Turns the climate either on or off. Only turns the climate on if the battery
 * is above the level configured above, and if nobody is in the car. The only
 * condition required when turning the climate off is that nobody is in the car.
 */
function controlClimate(vehicle, start) {
    let requiredMinBatteryLevel = start ? MIN_BATTERY_LEVEL : null;

    return _attemptToWakeUpTheCar(vehicle)
        .then(() => {
            logger.debug("Checking required conditions");
            return _checkAllConditions(vehicle,
                _batteryMinimumCondition(requiredMinBatteryLevel),
                _userPresentCondition(false));
        })
        .then(() => {
            if (start) {
                logger.debug('starting climate');

                if (!DEBUG_MODE) {
                    return tjs.climateStartAsync(vehicle);
                } else {
                    return tjs.flashLightsAsync(vehicle);
                }
            } else {
                logger.debug('stopping climate');

                if (!DEBUG_MODE) {
                    return tjs.climateStopAsync(vehicle);
                } else {
                    return tjs.flashLightsAsync(vehicle);
                }
            }
        });
}

// if you don't try to wake up the car first, you'll probably get a 408 response
// when attempting to turn the climate on/off.
// If anyone has any good ideas on how to make this retry loop more readable
// (not more clever or concise) I'd be interested to hear it.
function _attemptToWakeUpTheCar(vehicle) {
    let interval_seconds = 15;

    let attempt = 1;
    const MAX_ATTEMPTS = 4; // it makes me sad that this needs to be so high

    let promise = new Promise((resolve, reject) => {
        var wakeUpLoop = function() {
            logger.debug(`Attempt ${attempt} of ${MAX_ATTEMPTS} to wake up the car.`);

            tjs.wakeUpAsync(vehicle)
                .then(response => {
                    if (response.state === "online") {
                        logger.debug('Car is now online!');

                        resolve(response);
                    } else {
                        // if at first you don't succeed...
                        retry(response);
                    }
                })
                .catch((err) => {
                    logger.warn(`I got an error trying to wake up the car.`);
                    retry(err);
                });
        };

        var retry = function(resolution) {
            attempt += 1;

            if (attempt > MAX_ATTEMPTS) {
                logger.debug(`I tried ${MAX_ATTEMPTS} times to wake up the car, but it is still not online. Giving up.`);

                // resolve anyway and let the caller worry about it
                resolve(resolution);
            } else {
                logger.debug(`Waiting ${interval_seconds} seconds before trying again.`);
                setTimeout(wakeUpLoop, interval_seconds * 1000);
            }
        }

        wakeUpLoop();
    });

    return promise;
}

module.exports = {
    controlClimate: controlClimate,
    loginToVehicle: loginToVehicle,
    logger: logger,
    controlSentryMode: controlSentryMode,
};
