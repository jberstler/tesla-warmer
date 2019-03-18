# tesla-funhouse
This is a small set of simple Node.js scripts that will control your Tesla vehice. At the moment, the aptly-named `start_climate.js` will start your climate and then, after some time passes, turn it back off again. I have this script cron'ed to run each day just before I leave for work, and then again just before I typically go home from work. This way, my car is automatically nice and cozy in time for my commute. Additionally, there is `start_sentry_mode.js` which will start Sentry Mode and leave it on. I have this one cron'ed to run after the time I typically arrive at work.

# Neat Features
The script has a number of features that mostly try to keep it from doing crazy things:
- YOU run the script on your own trusted hardware/host. This means you don't need to fork over your Tesla API credentials to some third party service.
- Scripts to control the climate, as well as start Sentry Mode.
- You can configure the minimal battery charge that is allowed to start power hungry features (climate, and Sentry Mode). This way, you don't kick automatically on the heater in the dead of winter with a low battery.
- It will not turn features either on or off if any of the doors are open or the driver is present.
- Logging. Optionally, you can have the script log to a file so you can see what's going on. Kinda nerdy, I guess, but since you're interested in automatically warming up your Tesla with a cron'ed Node.js script, I suspect you might be into logging as well.

# Setting it up
- Install Node.js on a machine that has some sort of cron service.
- Clone this repository, run `npm install` in the root folder.
- Edit the config params at the top of the script(s) to your liking. At a minimum, you need to enter your Tesla username and password in the `TESLA_USERNAME` and `TESLA_PASSWORD` constants, respectively in `lib/tesla_common.js`. Each additional script in the root of the project may also have configuration variables at the top.
- Schedule the script to run when you need it. For me, that looks something like:
```
25 7,17 * * 1-5	. $HOME/.profile && node /Users/starman/tesla-warmer/start_climate.js
```
Or, to start Sentry Mode, use the `start_sentry_mode.js` script instead of `start_climate.js`,

Note: I use NVM to manage my Node installations, so I needed to source my `.profile` in order to have the node binary on the path when this runs. You might need this too.

# Changelog
- 0.0.2 `start_sentry_mode.js` introduced
- 0.0.1 `start_climate.js` turns on the climate then, after some time passes, turns it off again.

# What's Next?
I don't know... you tell me. This works fine for me, but I suppose somebody might want it to:
- Have a proper CLI where you can pass in config as arguments
- Use an API token instead of your Tesla username and password
- Cleanup that weird retry loop code when waking up the car (JavaScript, you so crazy!)
