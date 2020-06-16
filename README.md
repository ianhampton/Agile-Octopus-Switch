# Agile Octopus Switch
Built to control an eWeLink/Sonoff switch that controls my immersion heater. The aim was to improve on the basic on/off at a fixed price control that IFTTT offers by calculating if the current price is the best price in the near future.

I initially started writing a script to take a view on the entire day and calculate the best timeslots within that, before realising that was overly complicated and all I really needed for hot water (which gets used or cools down regularly) is to check if the current price is the best price within the next few hours. Price changes tend to roll in and out of peaks and troughs so this should avoid heating our water tank before the lowest price within a price dip has arrived.

The default behaviour (rates, times etc. are configurable in config.json)...

* Pull the current rate, and the next 3 hours of rates from the Octopus API.
* If the current price is the lowest within that batch, and below the maximum price (3p/kWh) then switch on.
* If there's a cheaper price in the next 3 hours remain off, unless the difference is minimal (10%), then favour switching on sooner.
* If it's between 3 and 5am only look at the rates 1hr ahead so that the switch is more likely to turn on before peak hot water usage (morning showers).
* Switch off when the current price exceeds the maximum price.
