// Bestand: bluetooth.js
// Bevat logica voor Bluetooth Low Energy (BLE) connectiviteit en dataverwerking.

export class RRIntervalProcessor {
    constructor(options = {}) {
        this.setOptions(options);
        this.reset();
    }
    setOptions(options = {}) {
        const defaults = { artifactThreshold: 1.4, replacementStrategy: 'replaceWithLastGood' };
        this.options = { ...defaults, ...options };
        this.isFilteringDisabled = false;
    }
    reset() {
        this.filteredIntervals = [];
        this.lastGoodInterval = null;
    }
    addInterval(newInterval) {
        if (this.isFilteringDisabled) {
            this.filteredIntervals.push(newInterval);
            return;
        }
        if (!this.lastGoodInterval) {
            this.lastGoodInterval = newInterval;
            this.filteredIntervals.push(newInterval);
            return;
        }
        const ratio = newInterval / this.lastGoodInterval;
        if (ratio > this.options.artifactThreshold || ratio < (1 / this.options.artifactThreshold)) {
            this._handleArtifact(newInterval);
        } else {
            this.lastGoodInterval = newInterval;
            this.filteredIntervals.push(newInterval);
        }
    }
    _handleArtifact(artifactInterval) {
        if (this.options.replacementStrategy === 'replaceWithLastGood') {
            this.filteredIntervals.push(this.lastGoodInterval);
        }
    }
}

export const bleDataParser = {
    parseHr(value) {
        const flags = value.getUint8(0);
        const hrFormat = (flags & 0x01);
        return (hrFormat === 1) ? value.getUint16(1, true) : value.getUint8(1);
    },
    parseRr(value) {
        const flags = value.getUint8(0);
        const rrPresent = (flags & 0x10);
        if (!rrPresent) return [];

        const intervals = [];
        const hrFormat = (flags & 0x01);
        let startIndex = (hrFormat === 1) ? 3 : 2;

        for (let i = startIndex; i + 1 < value.byteLength; i += 2) {
            intervals.push((value.getUint16(i, true) / 1024) * 1000);
        }
        return intervals;
    }
};

export class BluetoothController {
    constructor() {
        this.device = null;
        this.state = 'IDLE';
        this.rrProcessor = new RRIntervalProcessor();
        this.onStateChange = () => {};
        this.onData = () => {};
    }

    _setState(newState, deviceName = '') {
        this.state = newState;
        this.onStateChange(this.state, deviceName);
        console.log(`[BT] State changed to: ${this.state}`);
    }

    setPreset(presetName) {
        this.rrProcessor.isFilteringDisabled = (presetName === 'raw');
        let threshold = 1.4;
        switch (presetName) {
            case 'high_fidelity': threshold = 1.2; break;
            case 'resting': threshold = 1.3; break;
            case 'live_workout': threshold = 1.5; break;
        }
        this.rrProcessor.setOptions({ ...this.rrProcessor.options, artifactThreshold: threshold });
    }

    async connect() {
        if (!navigator.bluetooth) {
            this._setState('ERROR');
            alert('Web Bluetooth wordt niet ondersteund in deze browser.');
            return;
        }
        try {
            this._setState('SEARCHING');
            const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
            this.device = device;
            device.addEventListener('gattserverdisconnected', () => this._handleDisconnect());

            this._setState('CONNECTING');
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('heart_rate');
            const characteristic = await service.getCharacteristic('heart_rate_measurement');

            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', (event) => this._handleData(event));
            this._setState('STREAMING', device.name);
        } catch (error) {
            console.error("Bluetooth connection failed:", error);
            this._setState('ERROR');
        }
    }

    _handleData(event) {
        const value = event.target.value;
        const heartRate = bleDataParser.parseHr(value);
        const rrIntervals = bleDataParser.parseRr(value);

        const dataPacket = {
            heartRate: heartRate,
            rawRrIntervals: rrIntervals,
            filteredRrIntervals: []
        };

        if (rrIntervals.length > 0) {
            this.rrProcessor.reset();
            rrIntervals.forEach(rr => this.rrProcessor.addInterval(rr));
            dataPacket.filteredRrIntervals = this.rrProcessor.filteredIntervals;
        }
        this.onData(dataPacket);
    }

    _handleDisconnect() {
        this._setState('STOPPED');
        this.rrProcessor.reset();
    }

    async disconnect() {
        if (this.device && this.device.gatt.connected) {
            await this.device.gatt.disconnect();
        } else {
            this._handleDisconnect();
        }
    }

    isConnected() {
        return this.device && this.device.gatt.connected;
    }
}
