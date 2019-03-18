/*
 * cron this, say, for weekdays at 10 minutes prior to leaving the house to
 * have your car all nice and comfy when you get in!
 */

/**** START USER CONFIG VARIABLES ****/
// number of minutes to wait after turning climate on to turn it back off again
// in the case that there is (still) no user in the car.
const CLIMATE_ON_MINUTES = 10;
/**** END USER CONFIG VARIABLES ****/


const teslaCommon = require('./lib/tesla_common');

var vehicle;

return teslaCommon.loginToVehicle()
    .then((authenticatedVehicle) => {
        vehicle = authenticatedVehicle;
        return teslaCommon.controlClimate(vehicle, true);
    })
    .then(() => {
        // wait 10 minutes, if user is not present, shutdown the climate
        const timeout = CLIMATE_ON_MINUTES * 60 * 1000;

        teslaCommon.logger.debug(`Waiting ${CLIMATE_ON_MINUTES} minute(s) before proceeding`);
        var promise = new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(teslaCommon.controlClimate(vehicle, false));
            }, timeout);
        });

        return promise;
    })
    .catch(err => {
        teslaCommon.logger.error(err);
    })
    .finally(() => {
        teslaCommon.logger.debug('--------- Logging out ---------');
        return tjs.logoutAsync(vehicle);
    });
