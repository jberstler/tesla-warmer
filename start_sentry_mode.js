const teslaCommon = require('./tesla_common');

var vehicle;

return teslaCommon.loginToVehicle()
    .then((authenticatedVehicle) => {
        vehicle = authenticatedVehicle;
        return teslaCommon.controlSentryMode(vehicle, true);
    })
    .catch(err => {
        teslaCommon.logger.error(err);
    })
    .finally(() => {
        teslaCommon.logger.debug('--------- Logging out ---------');
        return tjs.logoutAsync(vehicle);
    });
