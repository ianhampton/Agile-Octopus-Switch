#!/usr/bin/env node

const ewelink = require('ewelink-api');
const axios = require("axios");
const config = require('./config.json');

/* --- Configuration - Moved to config.json --- */
const api_url = config.octo_api_url;
const product_code = config.octo_product_code;
const region_code = config.octo_region_code;
const tariff_code = "E-1R-" + product_code + "-" + region_code;

const device_id = config.test.ewel_device_id; // Test switch
//const device_id = config.prod.ewel_device_id; // Hot water switch

const price_threshold = config.octo_price_threshold; // Max price to switch off at
var segments_ahead = config.octo_segments_ahead; // How far ahead should we look for a cheaper price? 6 = 3hrs
const diff_percentage = config.octo_diff_percentage; // Percentage cheaper threshold (e.g. ignore if only 5% cheaper in 2hrs)

const ewelink_connection = new ewelink({
    email: config.ewel_email,
    password: config.ewel_password,
    region: config.ewel_region,
    APP_ID: config.ewel_app_id,
    APP_SECRET: config.ewel_app_secret,
});
/* --- End configuration --- */

var date = new Date();
var now = date.toISOString();
var hour = date.getHours();

// Alter how far ahead we look if it's the morning
if ((hour >= config.octo_morning_start) && (hour <= config.octo_morning_end)) {
    var segments_ahead = config.octo_segments_ahead_morning;
}

var unit = (segments_ahead <= 2) ? "hr" : "hrs";

const url = api_url + "products/" + product_code + "/electricity-tariffs/" + tariff_code + "/standard-unit-rates/?period_from=" + now;

async function controlSwitch(state) {
    if (state == "log") {
        const devices = await ewelink_connection.getDevices();
        console.log(devices);
    } else if (state == "status") {
        // This function doesn't appear to be working currently (API response error)
        // My intention was to check the device state before altering it
        const status = await ewelink_connection.getDevicePowerState(device_id);
        console.log(status);
    } else {
        await ewelink_connection.setWSDevicePowerState(device_id, state);
        console.log(`[ewelink] Device ID: ${device_id} - Set power state: ${state}`);
    }
}

console.log(`[octopus] Checking the rates over the next ${(segments_ahead / 2)}${unit}...`);

axios.get(url, {
    headers: {
        Accept: "application/json"
    }
}).then(res => {
    if (res.data.count > segments_ahead) {
        rates = res.data.results.reverse();
        let current_rates = [];
        rates.slice(0, segments_ahead).forEach(function(rate) {
            current_rates.push(rate.value_inc_vat);
        });

        if (current_rates.length > 0) {
            let cheapest_rate = true;
            let current_rate = current_rates[0];
            current_rates.forEach(function(rate) {
                if (rate < current_rate) {
                    if (((current_rate - rate) / rate * 100) < diff_percentage) {
                        console.log(`[octopus] Currently: ${current_rate}p/kWh - Cheaper rate coming up: ${rate}p/kWh - Less than ${diff_percentage}% difference so ignored`);
                    } else {
                        console.log(`[octopus] Currently: ${current_rate}p/kWh - Cheaper rate coming up: ${rate}p/kWh`);
                        cheapest_rate = false;
                    }
                }
            });
            if (cheapest_rate) {
                console.log(`[octopus] Currently the cheapest rate (${current_rate}p/kWh) for the next ${(segments_ahead / 2)}${unit}`);
                if (current_rate < price_threshold) {
                    console.log(`[octopus] Price is below ${price_threshold}p/kWh threshold - Switch on!`);
                    controlSwitch("on");
                } else {
                    console.log(`[octopus] Price is above ${price_threshold}p/kWh threshold - Not turning switch on.`);
                }
            }
            if (current_rate > price_threshold) {
                console.log(`[octopus] Price is above ${price_threshold}p/kWh threshold - Switch off!`);
                controlSwitch("off");
            }
        }
    }
});