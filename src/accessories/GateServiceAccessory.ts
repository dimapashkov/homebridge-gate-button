import {
  Service,
  PlatformAccessory,
  API, Logger, PlatformConfig
} from 'homebridge';
import bind from 'bind-decorator';
import { RemoteGatewayConfig, RemoteGatewayHomebridgePlatform } from '../platform';
import { DeviceSchema } from '../device.schema';

export interface GateServiceAccessoryInterface extends DeviceSchema {
  switchUrl?: string;
  switchReqType?: string;
  switchMessage?: string;
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class GateServiceAccessory {
  gateOptions: GateServiceAccessoryInterface;
  private lastPosition: number;
  private targetState: 'open' | 'closed';
  private currentState: 'open' | 'closed' | 'opening' | 'closing';
  private stateTimeout;
  private obstructionDetected: boolean;

  private gateService: Service;

  constructor(
    private readonly platform: RemoteGatewayHomebridgePlatform,
    private readonly log: Logger,
    private readonly config: RemoteGatewayConfig,
    private readonly api: API,
    private readonly accessory: PlatformAccessory
  ) {
    this.gateOptions = accessory.context.device;
    // this.log.info(JSON.stringify(this.gateOptions));

    this.lastPosition = 0;
    this.currentState = 'closed';
    this.targetState = 'closed';
    this.obstructionDetected = false;

    this.gateService = this.accessory.getService(this.platform.Service.GarageDoorOpener) || this.accessory.addService(this.platform.Service.GarageDoorOpener);

    // set HomeKit accessory name
    this.gateService.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    const Characteristic = this.api.hap.Characteristic;

    // create handlers for required characteristics
    this.gateService.getCharacteristic(Characteristic.CurrentDoorState)
      .on('get', this.handleCurrentDoorStateGet.bind(this));

    this.gateService.getCharacteristic(Characteristic.TargetDoorState)
      .on('get', this.handleTargetDoorStateGet.bind(this))
      .on('set', this.handleTargetDoorStateSet.bind(this));

    this.gateService.getCharacteristic(Characteristic.ObstructionDetected)
      .on('get', this.handleObstructionDetectedGet.bind(this));

    if(this.gateOptions.key){
      // this.platform.mqttSubscribe(this.gateOptions.key, msg => {
      //   this.sendGateSwitchSignal();
      // });
    }

  }

  @bind
  handleGatePosition(message: string) {
    const currentPosition = parseInt(message.toString(), 10);
    if(this.stateTimeout) clearTimeout(this.stateTimeout);

    if(currentPosition < this.lastPosition){
      // opening
      this.handleGateState('opening');
    } else {
      if(this.currentState === 'opening'){
        this.obstructionDetected = true;
        setTimeout(() => {
          this.obstructionDetected = false;
        }, 3000);
      }
      // closing
      this.handleGateState('closing');
    }

    this.log.info(`${this.lastPosition} -> ${currentPosition} = ${this.currentState}`);

    this.stateTimeout = setTimeout(() => {
      this.log.info(`stateTimeout ${this.lastPosition} -> ${currentPosition}`);
      // change state to open
      if(this.currentState === 'opening'){
        this.handleGateState('open');
      } else {
        this.handleGateState('closed');
      }
      this.obstructionDetected = false;
    }, 2000);
    this.lastPosition = currentPosition;
  }

  handleGateState(state: 'open' | 'closed' | 'opening' | 'closing') {
    if(this.currentState !== state){
      this.log.info('Handle Gate State', state);
      this.currentState = state;
    }
  }

  sendGateSwitchSignal(){
    this.log.info('Switch '+ this.gateOptions.displayName +' State');
    if(this.gateOptions.switchUrl){
      this.platform.cmdPublish(this.gateOptions.switchUrl, this.gateOptions.switchReqType, this.gateOptions.switchMessage);
    }
  }

  /**
   * Handle requests to get the current value of the "Current Door State" characteristic
   */
  handleCurrentDoorStateGet(callback) {
    // this.log.info('Triggered GET Current Gate State', this.currentState);
    switch (this.currentState) {
      case 'open': // OPEN	Characteristic.CurrentDoorState.OPEN	0
        this.targetState = 'open';
        callback(null, 0);
        break;
      case 'closed': // CLOSED	Characteristic.CurrentDoorState.CLOSED	1
        this.targetState = 'closed';
        callback(null, 1);
        break;
      case 'opening': // OPENING	Characteristic.CurrentDoorState.OPENING	2
        this.targetState = 'open';
        callback(null, 2);
        break;
      case 'closing': // CLOSING	Characteristic.CurrentDoorState.CLOSING	3
        this.targetState = 'closed';
        callback(null, 3);
        break;
    }
  }

  /**
   * Handle requests to get the current value of the "Target Door State" characteristic
   */
  handleTargetDoorStateGet(callback) {
    // this.log.info('Triggered GET TargetDoorState');

    // OPEN	Characteristic.TargetDoorState.OPEN	0
    // CLOSED	Characteristic.TargetDoorState.CLOSED	1
    this.log.info('Triggered GET Target Gate State:', this.targetState);

    callback(null, this.targetState === 'open' ? 0 : 1);
  }

  /**
   * Handle requests to set the "Target Door State" characteristic
   */
  handleTargetDoorStateSet(value, callback) {
    // OPEN	Characteristic.TargetDoorState.OPEN	0
    // CLOSED	Characteristic.TargetDoorState.CLOSED	1

    // this.sendGateSwitchSignal();

    const targetState: 'open' | 'closed' = (value === 0) ? 'open' : 'closed';
    this.log.info('Triggered SET Target Gate State:', targetState);

    if(targetState !== this.targetState){
      this.targetState = targetState;

      if(this.targetState === 'closed'){
        if(this.currentState === 'open'){
          // 1 time switch
          this.sendGateSwitchSignal();
        } else if(this.currentState === 'opening') {
          // 2 time switch
          this.sendGateSwitchSignal();
          setTimeout(() => this.sendGateSwitchSignal(), 1500);
        }
      } else { // targetState === 'open'
        if(this.currentState === 'closed'){
          // 1 time switch
          this.sendGateSwitchSignal();
        } else if(this.currentState === 'closing') {
          // 2 time switch
          this.sendGateSwitchSignal();
          setTimeout(() => this.sendGateSwitchSignal(), 1500);
        }
      }
    }

    callback(null);
  }

  /**
   * Handle requests to get the current value of the "Obstruction Detected" characteristic
   */
  handleObstructionDetectedGet(callback) {
    // this.log.info('Triggered GET ObstructionDetected');
    callback(null, this.obstructionDetected);
  }
}
