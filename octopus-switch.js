#!/usr/bin/env node

const ewelink = require('ewelink-api');
const axios = require("axios");
const config = require('./config.json');

/* --- Configuration - Moved to config.json --- */
const api_url = config.octo_api_url;
const product_code = config.octo_product_code;
const region_code = config.octo_region_code;
const tariff_code = `E-1R-${product_code}-${region_code}`;

//const device_id = config.test.ewel_device_id; // Test light
const device_id = config.prod.ewel_device_id; // Hot water

const price_threshold = config.octo_price_threshold; // Max price to switch off at
let segments_ahead = config.octo_segments_ahead; // How far ahead should we look for a cheaper price? 6 = 3hrs
const price_round = config.octo_price_round; // Round prices to a number of decimal places before comparing

const ewelink_connection = new ewelink({
    email: config.ewel_email,
    password: config.ewel_password,
    region: config.ewel_region,
    APP_ID: config.ewel_app_id,
    APP_SECRET: config.ewel_app_secret,
});
/* --- End configuration --- */

const date = new Date();
const now = date.toISOString();
const hour = date.getHours();
const minutes = (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();
const ts = `[${hour}:${minutes}]`;

// Alter how far ahead we look if it's the morning
if ((hour >= config.octo_morning_start) && (hour <= config.octo_morning_end)) {
    segments_ahead = config.octo_segments_ahead_morning;
}

const unit = (segments_ahead <= 2) ? "hr" : "hrs";
const url = `${api_url}products/${product_code}/electricity-tariffs/${tariff_code}/standard-unit-rates/?period_from=${now}`;

async function controlSwitch(state) {
    const count = 0;
    const retry = 5;
    while (true) {
        try {
            if (state == "log") {
                const devices = await ewelink_connection.getDevices();
                console.log(devices);
                break;
            } else if (state == "status") {
                // This function doesn't appear to be working currently (API response error) my intention was to check the state before altering it
                const status = await ewelink_connection.getWSDevicePowerState(device_id, {
                    shared: false
                });
                console.log(status);
                break;

            } else {
                // Non-Sonoff devices use WebSocket connection:
                //await ewelink_connection.setWSDevicePowerState(device_id, state);
                // Sonoff devices:
                await ewelink_connection.setDevicePowerState(device_id, state);
                console.log(`[ewelink] ${ts} Device ID: ${device_id} - Set power state: ${state}`);
                break;
            }
        } catch (e) {
            console.log(`[ewelink] ${ts} [error] [attempt ${count+1}/${retry}] eWeLink API error: ${e}`);
            if (++count == retry) break;
        }
    }
}

console.log(`[octopus] ${ts} Checking the rates over the next ${(segments_ahead / 2)}${unit}...`);

axios.get(url, {
    headers: {
        Accept: "application/json"
    }
}).then(res => {
    if (res.data.count > segments_ahead) {
        let rates = res.data.results.reverse();
        let current_rates = [];
        rates.slice(0, segments_ahead).forEach(function(rate) {
            current_rates.push(rate.value_inc_vat);
        });

        if (current_rates.length > 0) {
            let cheapest_rate = true;
            let current_rate = current_rates[0];
            let current_rate_rounded = parseFloat(current_rates[0].toFixed(price_round));
            current_rates.forEach(function(rate) {
                let rate_rounded = parseFloat(rate.toFixed(price_round));
                if (rate_rounded < current_rate_rounded) {
                    console.log(`[octopus] ${ts} Currently: ${current_rate}p/kWh - Cheaper rate coming up: ${rate}p/kWh`);
                    cheapest_rate = false;
                }
            });
            if (cheapest_rate) {
                console.log(`[octopus] ${ts} Currently the cheapest rate (${current_rate}p/kWh) for the next ${(segments_ahead / 2)}${unit}`);
                if (current_rate < price_threshold) {
                    console.log(`[octopus] ${ts} Price is below ${price_threshold}p/kWh threshold - Switch on!`);
                    controlSwitch("on");
                } else {
                    console.log(`[octopus] ${ts} Price is above ${price_threshold}p/kWh threshold - Not turning switch on`);
                }
            }
            if (current_rate > price_threshold) {
                console.log(`[octopus] ${ts} Price is above ${price_threshold}p/kWh threshold - Switch off!`);
                controlSwitch("off");
            } else if (current_rate < price_threshold && !cheapest_rate) {
                console.log(`[octopus] ${ts} Price is below ${price_threshold}p/kWh threshold, but isn't the cheapest rate - Switch off!`);
                controlSwitch("off");
            }
        }
    }
}).catch(error => {
    console.log(`[octopus] ${ts} [error] Octopus API error: ${error.response.status}`);
});