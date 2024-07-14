import { Service, PlatformAccessory } from 'homebridge';
import { DreoPlatform } from './platform';

export class FanAccessory {
  private service: Service;
  private lightService?: Service;
  private temperatureService?: Service;

  // Cached copy of latest fan states
  private fanState = {
    On: false,
    Speed: 1,
    Swing: false,
    SwingMethod: 'shakehorizon',
    MaxSpeed: 12,
    Temperature: 0,
    LightOn: false, // Add light state
    Brightness: 100, // Add light brightness state
  };

  constructor(
    private readonly platform: DreoPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly state,
    private readonly ws,
  ) {
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        accessory.context.device.brand,
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        accessory.context.device.model,
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        accessory.context.device.sn,
      );

    // initialize fan values
    this.platform.log.debug('chung wu:', accessory.context.device.controlsConf);

    this.fanState.MaxSpeed =
      accessory.context.device.controlsConf.control[1].items[1].text;
    this.platform.log.debug('Setting MaxSpeed:', this.fanState.MaxSpeed);

    this.fanState.On = state.fanon.state;
    this.fanState.Speed =
      (state.windlevel.state * 100) / this.fanState.MaxSpeed;
    this.fanState.LightOn = state.lighton.state;
    this.fanState.Brightness = state.brightness.state;

    // Initialize Fanv2 service
    this.service =
      this.accessory.getService(this.platform.Service.Fanv2) ||
      this.accessory.addService(this.platform.Service.Fanv2);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.deviceName,
    );

    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.handleActiveSet.bind(this))
      .onGet(this.handleActiveGet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({
        minStep: 100 / this.fanState.MaxSpeed,
      })
      .onSet(this.setRotationSpeed.bind(this))
      .onGet(this.getRotationSpeed.bind(this));

    // Initialize Lightbulb service
    this.lightService =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    this.lightService.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.deviceName + ' Light',
    );

    this.lightService
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setLightOn.bind(this))
      .onGet(this.getLightOn.bind(this));

    this.lightService
      .getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))
      .onGet(this.getBrightness.bind(this));

    const shouldHideTemperatureSensor =
      this.platform.config.hideTemperatureSensor || false;

    ws.addEventListener('message', (message) => {
      const data = JSON.parse(message.data);

      if (data.devicesn === accessory.context.device.sn) {
        platform.log.debug('Incoming %s', message.data);

        if (
          data.method === 'control-report' ||
          data.method === 'control-reply' ||
          data.method === 'report'
        ) {
          switch (Object.keys(data.reported)[0]) {
            case 'fanon':
              this.fanState.On = data.reported.fanon;
              this.service
                .getCharacteristic(this.platform.Characteristic.Active)
                .updateValue(this.fanState.On);
              this.platform.log.debug('Fan power:', data.reported.fanon);
              break;
            case 'windlevel':
              this.fanState.Speed =
                (data.reported.windlevel * 100) / this.fanState.MaxSpeed;
              this.service
                .getCharacteristic(this.platform.Characteristic.RotationSpeed)
                .updateValue(this.fanState.Speed);
              this.platform.log.debug('Fan speed:', data.reported.windlevel);
              break;
            case 'shakehorizon':
              this.fanState.Swing = data.reported.shakehorizon;
              this.service
                .getCharacteristic(this.platform.Characteristic.SwingMode)
                .updateValue(this.fanState.Swing);
              this.platform.log.debug(
                'Oscillation mode:',
                data.reported.shakehorizon,
              );
              break;
            case 'hoscon':
              this.fanState.Swing = data.reported.hoscon;
              this.service
                .getCharacteristic(this.platform.Characteristic.SwingMode)
                .updateValue(this.fanState.Swing);
              this.platform.log.debug(
                'Oscillation mode:',
                data.reported.hoscon,
              );
              break;
            case 'temperature':
              if (
                this.temperatureService !== undefined &&
                !shouldHideTemperatureSensor
              ) {
                this.fanState.Temperature = this.correctedTemperature(
                  data.reported.temperature,
                );
                this.temperatureService
                  .getCharacteristic(
                    this.platform.Characteristic.CurrentTemperature,
                  )
                  .updateValue(this.fanState.Temperature);
              }
              this.platform.log.debug(
                'Temperature:',
                data.reported.temperature,
              );
              break;
            case 'lighton':
              this.fanState.LightOn = data.reported.lighton;
              this.lightService
                ?.getCharacteristic(this.platform.Characteristic.On)
                .updateValue(this.fanState.LightOn);
              this.platform.log.debug('Light on:', data.reported.lighton);
              break;
            case 'brightness':
              this.fanState.Brightness = data.reported.brightness;
              this.lightService
                ?.getCharacteristic(this.platform.Characteristic.Brightness)
                .updateValue(this.fanState.Brightness);
              this.platform.log.debug('Brightness:', data.reported.brightness);
              break;
            default:
              platform.log.debug(
                'Unknown command received:',
                Object.keys(data.reported)[0],
              );
          }
        }
      }
    });
  }

  handleActiveSet(value) {
    this.platform.log.debug('Triggered SET Active:', value);
    if (this.fanState.On !== Boolean(value)) {
      this.ws.send(
        JSON.stringify({
          devicesn: this.accessory.context.device.sn,
          method: 'control',
          params: { fanon: Boolean(value) },
          timestamp: Date.now(),
        }),
      );
    }
  }

  handleActiveGet() {
    return this.fanState.On;
  }

  async setRotationSpeed(value) {
    this.platform.log.debug('Received rotation speed value:', value);

    // Ensure value is a number
    const rotationSpeed = parseFloat(value);
    if (isNaN(rotationSpeed)) {
      this.platform.log.error('Invalid rotation speed value:', value);
      return;
    }

    // Ensure MaxSpeed is defined and a number
    const maxSpeed = this.fanState.MaxSpeed;
    if (isNaN(maxSpeed)) {
      this.platform.log.error(
        'Invalid max speed value:',
        this.fanState.MaxSpeed,
      );
      return;
    }

    // Convert value
    const converted = Math.round((rotationSpeed * maxSpeed) / 100);
    this.platform.log.debug('Converted fan speed:', converted);

    // Check if the converted speed is valid
    if (isNaN(converted)) {
      this.platform.log.error('Converted fan speed is NaN');
      return;
    }

    // Handle non-zero speed
    if (converted !== 0) {
      this.platform.log.debug('Setting fan speed:', converted);
      this.ws.send(
        JSON.stringify({
          devicesn: this.accessory.context.device.sn,
          method: 'control',
          params: {
            fanon: true,
            windlevel: converted,
          },
          timestamp: Date.now(),
        }),
      );
    } else {
      this.platform.log.debug('Fan speed is zero, not sending command.');
    }
  }

  async getRotationSpeed() {
    return this.fanState.Speed;
  }

  async setSwingMode(value) {
    this.ws.send(
      JSON.stringify({
        devicesn: this.accessory.context.device.sn,
        method: 'control',
        params: { [this.fanState.SwingMethod]: Boolean(value) },
        timestamp: Date.now(),
      }),
    );
  }

  async getSwingMode() {
    return this.fanState.Swing;
  }

  async getTemperature() {
    return this.fanState.Temperature;
  }

  correctedTemperature(temperatureFromDreo) {
    const offset = this.platform.config.temperatureOffset || 0;
    return ((temperatureFromDreo + offset - 32) * 5) / 9;
  }

  async setLightOn(value) {
    this.platform.log.debug('Triggered SET Light On:', value);
    this.ws.send(
      JSON.stringify({
        devicesn: this.accessory.context.device.sn,
        method: 'control',
        params: { lighton: Boolean(value) },
        timestamp: Date.now(),
      }),
    );
  }

  async getLightOn() {
    return this.fanState.LightOn;
  }

  async setBrightness(value) {
    this.platform.log.debug('Triggered SET Brightness:', value);
    this.ws.send(
      JSON.stringify({
        devicesn: this.accessory.context.device.sn,
        method: 'control',
        params: { brightness: value },
        timestamp: Date.now(),
      }),
    );
  }

  async getBrightness() {
    return this.fanState.Brightness;
  }
}
