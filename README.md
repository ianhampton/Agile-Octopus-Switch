# Agile Octopus Switch
Built to control an eWeLink/Sonoff switch that controls my immersion heater. The aim was to improve on the basic on/off at a fixed price control that IFTTT offers by calculating if the current price is the best price in the near future.

I initially started writing a script to take a view on the entire day and calculate the best timeslots within that, before realising that was overly complicated and all I really needed for hot water (which gets used or cools down regularly) is to check if the current price is the best price within the next few hours. Price changes tend to roll in and out of peaks and troughs so this should avoid heating our water tank before the lowest price within a price dip has arrived.

I already had a Pi running a cron job every 30 minutes to [update an eInk display](https://github.com/pufferfish-tech/octopus-agile-pi-prices), so creating a script that could be run at the same time to trigger my Sonoff switch seemed like the easiest option.

---
## What does it do?
The default behaviour (rates, times etc. are configurable in config.json)...

* Pull the current rate, and the next 3 hours of rates from the Octopus API.
* If the current price is the lowest within that batch, and below the maximum price (3p/kWh) then switch on.
* If there's a cheaper price in the next 3 hours remain off, unless the difference is minimal (10%), then favour switching on sooner.
* If it's between 3 and 5am only look at the rates 1hr ahead so that the switch is more likely to turn on before peak hot water usage (morning showers).
* Switch off when the current price exceeds the maximum price.

---
## Installation
Install globally:

`npm install https://github.com/ianhampton/Agile-Octopus-Switch.git -g`

Update `config.json` within `node_modules/octopus-switch` to include your eWeLink username/password and device ID. The device ID can be found under the device settings within the eWeLink app. Update the Octopus settings where required, the region relates to your [DNO region](https://en.wikipedia.org/wiki/Distribution_network_operator).

Once installed invoke it by calling `octoswitch` within your system command line. You'll probably want to run **crontab -e** and add something like:

`*/30 * * * * sleep 20; octoswitch > /home/pi/cron.log`

---
## Notes

My immersion heater is controlled by a non-Sonoff switch that happens to also use the eWeLink platform, specifically a KingArt N1 running the v3 firmware. I struggled to find an existing implementation of the eWeLink API that would work with this combination. I'm using the [ewelink-api Node module by skydiver](https://github.com/skydiver/ewelink-api) but found that the current release (v3.0.0) returned an API error when attempting to control the switch. I had some success with the recently added `3.1.0-ws` branch so that's included as a dependency for this package.

I can't find a working function to read the current device state, so I'm setting the state to on or off each time. I couldn't control my KingArt switch through LAN mode, but could control another Sonoff device that I had running locally. It would have been nice to remove the dependency on the eWeLink servers. 
