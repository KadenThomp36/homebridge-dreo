Forked from [homebridge-dreo](https://github.com/zyonse/homebridge-dreo) from [zyonse](https://github.com/zyonse), please install for all other fans.

# Homebridge Dreo Plugin

[![NPM Version](https://img.shields.io/npm/v/@kadenthomp36/homebridge-dreo-ceiling-fan.svg)](https://www.npmjs.com/package/@kadenthomp36/homebridge-dreo-ceiling-fan)
[![npm](https://img.shields.io/npm/dt/@kadenthomp36/homebridge-dreo-ceiling-fan)](https://www.npmjs.com/package/@kadenthomp36/homebridge-dreo-ceiling-fan)

## Compatability

- CLF521S

Please open an issue if you have another model that works or doesn't work. This plugin is intended for only ceiling fan support.

## Features

- **Temperature Sensor Display:** Display the temperature sensor detected within your devices (for supported devices, check your devices capabilities). Because the Dreo devices temperature sensors are not entirely accurate, you can also set a specific temperature offset for your devices.

## Installation

```
npm install -g @kadenthomp36/homebridge-dreo-ceiling-fan
```

(Or install through the Homebridge UI)

## Configuration

Provide your Dreo app login credentials

```json
"platforms": [
  {
    "options": {
      "email": "email@example.com",
      "password": "00000000"
    },
    "name": "Dreo Platform",
    "platform": "DreoPlatform"
  }
]
```

## Contributing

If you'd like to add support for a new device type, you might find this writeup from [@JeffSteinbok](https://github.com/JeffSteinbok) (HomeAssistant plugin maintainer) useful for tracing the Dreo App:

https://github.com/JeffSteinbok/hass-dreo/blob/main/contributing.md
