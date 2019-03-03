/*
 * cron this, say, for weekdays at 10 minutes prior to leaving the house to
 * have your car all nice and comfy when you get in!
 */

/**** START USER CONFIG VARIABLES ****/
// debug mode only flashes the lights, as well as sets some logging options
const DEBUG_MODE = false;

var username = "TESLA_USERNAME";
var password = "TESLA_PASSWORD";

// number of minutes to wait after turning climate on to turn it back off again
// in the case that there is (still) no user in the car.
const CLIMATE_ON_MINUTES = 10;

// minimum battery level (as a percent) required to start the climate
// this prevents us from firing up the climate on a low battery
const MIN_BATTERY_LEVEL = 20;

// logging options
var logfile; // set this if you want to log output to a file e.g. '/Users/starman/start_climate.log'
var loglevel = 'debug'; // one of 'fatal' 'error' 'warn' 'debug' or 'trace'
/**** END USER CONFIG VARIABLES ****/


var tjs = require('teslajs');

if(DEBUG_MODE) {
    logfile = undefined;
    loglevel = 'debug';
}

const log = require('simple-node-logger').createSimpleLogger({
        logFilePath: logfile,
        level: loglevel,
        timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS'
    });

// Truly, this is a dumb variable name, but that's just what teslajs calls it.
// It gets initialized with the authToken and vehicleId and is then passed
// to all the teslajs functions.
var options;

return loginToVehicle()
    .then(() => {
        return controlClimate(true);
    })
    .then(() => {
        // wait 10 minutes, if user is not present, shutdown the climate
        const timeout = CLIMATE_ON_MINUTES * 60 * 1000;

        log.debug(`Waiting ${CLIMATE_ON_MINUTES} minute(s) before proceeding`);
        var promise = new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(controlClimate(false));
            }, timeout);
        });

        return promise;
    })
    .catch(err => {
        log.error(err);
    })
    .finally(() => {
        log.debug('--------- Logging out ---------');
        return tjs.logoutAsync(options);
    });

/*
 * Turns the climate either on or off. Only turns the climate on if the battery
 * is above the level configured above, and if nobody is in the car. The only
 * condition required when turning the climate off is that nobody is in the car.
 */
function controlClimate(start) {
    let requiredMinBatteryLevel = start ? MIN_BATTERY_LEVEL : null;

    return attemptToWakeUpTheCar()
        .then(() => {
            return ensureSafeToProceed(requiredMinBatteryLevel);
        })
        .then(() => {
            if(start) {
                log.debug('starting climate');

                if(!DEBUG_MODE) {
                    return tjs.climateStartAsync(options);
                } else {
                    return tjs.flashLightsAsync(options);
                }
            } else {
                log.debug('stopping climate');

                if(!DEBUG_MODE) {
                    return tjs.climateStopAsync(options);
                } else {
                    return tjs.flashLightsAsync(options);
                }
            }
        });
}

// do some checks to make sure it is safe to switch the climate
function ensureSafeToProceed(minBatteryLevel = 0) {
    return tjs.vehicleDataAsync(options)
        .then(result => {
            log.trace(JSON.stringify(result, null, '\t'));
            if(result.vehicle_state.is_user_present) {
                let message = 'User is present! Bailing out!';
                log.debug(message);
                throw message;
            } else {
                log.debug('User is not present');
            }

            if(minBatteryLevel && result.charge_state.battery_level < minBatteryLevel) {
                let message = `Battery level ${result.charge_state.battery_level}% is below minimum required ${minBatteryLevel}%. Bailing out!`;
                log.debug(message);
                throw message;
            } else {
                log.debug(`Battery is at ${result.charge_state.battery_level}%. Proceeding.`);
            }
        });
}

// if you don't try to wake up the car first, you'll probably get a 408 response
// when attempting to turn the climate on/off.
// If anyone has any good ideas on how to make this retry loop more readable
// (not more clever or concise) I'd be interested to hear it.
function attemptToWakeUpTheCar() {
    let interval_seconds = 15;

    let attempt = 1;
    const MAX_ATTEMPTS = 4; // it makes me sad that this needs to be so high

    let promise = new Promise((resolve, reject) => {
        var wakeUpLoop = function() {
            log.debug(`Attempt ${attempt} of ${MAX_ATTEMPTS} to wake up the car.`);

            tjs.wakeUpAsync(options)
                .then(response => {
                    if(response.state === "online") {
                        log.debug('Car is now online!');

                        resolve(response);
                    } else {
                        // if at first you don't succeed...
                        retry(response);
                    }
                })
                .catch((err) => {
                    log.warn(`I got an error trying to wake up the car.`);
                    retry(err);
                });
        };

        var retry = function(resolution) {
            attempt += 1;

            if(attempt > MAX_ATTEMPTS) {
                log.debug(`I tried ${MAX_ATTEMPTS} times to wake up the car, but it is still not online. Giving up.`);

                // resolve anyway and let the caller worry about it
                resolve(resolution);
            } else {
                log.debug(`Waiting ${interval_seconds} seconds before trying again.`);
                setTimeout(wakeUpLoop, interval_seconds * 1000);
            }
        }

        wakeUpLoop();
    });

    return promise;
}

// login and set a global options object containing the correct authToken and vehicleId
// assumes, ahem, you only have one Tesla ;)
function loginToVehicle() {
    return tjs.loginAsync(username, password)
        .then(result => {
            if(result.error) {
                log.fatal(JSON.stringify(result.error));
                process.exit(1);
            } else {
                let token = result.authToken;
                log.debug(`You've got an auth token!`);

                options = {
                    authToken: token
                };

                return tjs.vehicleAsync(options);
            }
        })
        .then(vehicle => {
            log.trace(JSON.stringify(vehicle, null, '\t'));

            options.vehicleId = vehicle.vehicle_id;
        });
}
