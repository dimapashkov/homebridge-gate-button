"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteGatewayHomebridgePlatform = void 0;
const axios_1 = __importDefault(require("axios"));
const settings_1 = require("./settings");
const GateServiceAccessory_1 = require("./accessories/GateServiceAccessory");
const SwitchServiceAccessory_1 = require("./accessories/SwitchServiceAccessory");
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
class RemoteGatewayHomebridgePlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        // this is used to track restored cached accessories
        this.accessories = [];
        this.log.debug('Finished initializing platform:', this.config.name);
        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on('didFinishLaunching', () => {
            log.debug('Executed didFinishLaunching callback');
            // run the method to discover / register your devices as accessories
            this.discoverDevices();
        });
    }
    cmdPublish(url, reqType, message) {
        if (reqType === 'POST') {
            axios_1.default.post(url, message).then(res => {
                console.info(res.data);
            }).catch(e => {
                console.error(e);
            });
        }
        else {
            axios_1.default.get(url).then(res => {
                console.info(res.data);
            }).catch(e => {
                console.error(e);
            });
        }
        return true;
    }
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }
    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    discoverDevices() {
        const devices = this.config.devices || [];
        const uuids = devices.map(d => this.api.hap.uuid.generate(d.key));
        // remove old other
        for (const accessory of this.accessories) {
            if (uuids.indexOf(accessory.UUID) === -1) {
                this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
            }
        }
        // loop over the discovered devices and register each one if it has not already been registered
        let devIndex = 0;
        for (const device of devices) {
            devIndex++;
            // generate a unique id for the accessory this should be generated from
            // something globally unique, but constant, for example, the device serial
            // number or MAC address
            const uuid = this.api.hap.uuid.generate(device.key);
            // see if an accessory with the same uuid has already been registered and restored from
            // the cached devices we stored in the `configureAccessory` method above
            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
            if (existingAccessory) {
                // the accessory already exists
                this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
                // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
                // existingAccessory.context.device = device;
                // this.api.updatePlatformAccessories([existingAccessory]);
                // create the accessory handler for the restored accessory
                // this is imported from `platformAccessory.ts`
                this.initAccessory(device, existingAccessory);
            }
            else {
                // the accessory does not yet exist, so we need to create it
                this.log.info('Adding new accessory:', device.displayName);
                // create a new accessory
                const accessory = new this.api.platformAccessory(device.displayName, uuid);
                // store a copy of the device object in the `accessory.context`
                // the `context` property can be used to store any data about the accessory you may need
                accessory.context.device = device;
                // create the accessory handler for the newly create accessory
                // this is imported from `platformAccessory.ts`
                this.initAccessory(device, accessory);
                // link the accessory to your platform
                this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
            }
            // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
            // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
    }
    initAccessory(device, accessory) {
        switch (device.type) {
            case 'gate':
                new GateServiceAccessory_1.GateServiceAccessory(this, this.log, this.config, this.api, accessory);
                break;
            case 'switch':
                new SwitchServiceAccessory_1.SwitchServiceAccessory(this, this.log, this.config, this.api, accessory);
                break;
        }
    }
}
exports.RemoteGatewayHomebridgePlatform = RemoteGatewayHomebridgePlatform;
//# sourceMappingURL=platform.js.map