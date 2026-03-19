/*
 * Charge Power Monitor
 * Author: Oleh Boiko
 * Contact: developer@mackrais.com
 */

const { Clutter, Gio, GLib, St } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const POWER_SUPPLY_PATH = '/sys/class/power_supply';
const BLUEZ_SERVICE = 'org.bluez';
const BLUEZ_OBJECT_MANAGER_PATH = '/';
const REFRESH_INTERVAL_SECONDS = 1;
const DEVICE_REFRESH_INTERVAL_SECONDS = 30;
const SUPPORTED_PERIPHERAL_TYPES = new Set([
    'mouse',
    'keyboard',
    'headset',
    'headphones',
    'audio-headset',
    'audio-headphones',
    'phone',
    'tablet',
    'pda',
    'touchpad',
    'joystick',
    'gaming-input',
]);

function execCommunicate(argv) {
    const proc = Gio.Subprocess.new(
        argv,
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
    );

    return new Promise((resolve, reject) => {
        proc.communicate_utf8_async(null, null, (subprocess, result) => {
            try {
                const [, stdout, stderr] = subprocess.communicate_utf8_finish(result);
                const status = subprocess.get_exit_status();

                if (status !== 0) {
                    reject(new Error((stderr || '').trim() || `Command failed with exit status ${status}`));
                    return;
                }

                resolve(stdout.trim());
            } catch (error) {
                reject(error);
            }
        });
    });
}

function readTrimmedFile(path) {
    try {
        const [, contents] = GLib.file_get_contents(path);
        return imports.byteArray.toString(contents).trim();
    } catch (error) {
        return null;
    }
}

function readInteger(path) {
    const value = readTrimmedFile(path);
    if (value === null)
        return null;

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function findBatteryPath() {
    try {
        const directory = Gio.File.new_for_path(POWER_SUPPLY_PATH);
        const enumerator = directory.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            if (info.get_file_type() !== Gio.FileType.DIRECTORY)
                continue;

            const name = info.get_name();
            const candidatePath = `${POWER_SUPPLY_PATH}/${name}`;
            const type = readTrimmedFile(`${candidatePath}/type`);

            if (type === 'Battery')
                return candidatePath;
        }
    } catch (error) {
        return null;
    }

    return null;
}

function readPowerTelemetry() {
    const batteryPath = findBatteryPath();
    if (batteryPath === null) {
        return {
            text: 'n/a',
            details: 'No battery detected',
        };
    }

    const status = readTrimmedFile(`${batteryPath}/status`) ?? 'Unknown';
    const capacity = readInteger(`${batteryPath}/capacity`);
    const powerMicroWatts = readInteger(`${batteryPath}/power_now`);

    let watts = null;
    if (powerMicroWatts !== null) {
        watts = powerMicroWatts / 1e6;
    } else {
        const voltageMicroVolts = readInteger(`${batteryPath}/voltage_now`);
        const currentMicroAmps = readInteger(`${batteryPath}/current_now`);

        if (voltageMicroVolts !== null && currentMicroAmps !== null)
            watts = (voltageMicroVolts * currentMicroAmps) / 1e12;
    }

    if (watts === null) {
        return {
            text: 'n/a',
            details: `${status} • battery telemetry unavailable`,
        };
    }

    let prefix = '';
    if (status === 'Charging')
        prefix = '+';
    else if (status === 'Discharging')
        prefix = '-';

    const capacityText = capacity === null ? 'n/a' : `${capacity}%`;

    return {
        text: `${prefix}${watts.toFixed(1)} W`,
        details: `${status} • ${capacityText}`,
    };
}

function getPropertyValue(line) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1)
        return null;

    return line.slice(separatorIndex + 1).trim();
}

function normalizeDeviceType(value) {
    if (value === null)
        return null;

    const normalized = value.toLowerCase();
    const aliases = {
        bluetooth_mouse: 'mouse',
        bluetooth_keyboard: 'keyboard',
        gaming_input: 'input',
    };

    return aliases[normalized] ?? normalized;
}

function parseDeviceBlock(block) {
    const lines = block
        .split('\n')
        .map(line => line.trimEnd())
        .filter(line => line.trim() !== '');

    if (lines.length === 0)
        return null;

    const device = {
        model: null,
        type: null,
        percentage: null,
        state: null,
        rechargeable: null,
    };

    for (const line of lines) {
        const trimmed = line.trim();
        const value = getPropertyValue(trimmed);

        if (['mouse', 'keyboard', 'headset', 'headphones', 'phone', 'tablet', 'touchpad', 'joystick'].includes(trimmed)) {
            device.type = normalizeDeviceType(trimmed);
            continue;
        }

        if (trimmed.startsWith('model:')) {
            device.model = value;
        } else if (trimmed.startsWith('type:')) {
            device.type = normalizeDeviceType(value);
        } else if (trimmed.startsWith('percentage:')) {
            device.percentage = value;
        } else if (trimmed.startsWith('state:')) {
            device.state = value;
        } else if (trimmed.startsWith('rechargeable:')) {
            device.rechargeable = value === 'yes';
        }
    }

    if (device.percentage === null)
        return null;

    if (device.type === 'battery' || device.type === 'line-power')
        return null;

    return device;
}

function isPeripheralDevice(device) {
    if (device === null)
        return false;

    return SUPPORTED_PERIPHERAL_TYPES.has(device.type) || device.type === 'input';
}

function formatDeviceLabel(device) {
    const parts = [];
    const title = device.model ?? device.type ?? 'Device';
    parts.push(title);

    if (device.percentage !== null)
        parts.push(device.percentage);

    if (device.state !== null && device.state !== 'unknown')
        parts.push(device.state);

    return parts.join(' • ');
}

async function readPeripheralDevices() {
    const output = await execCommunicate(['upower', '-d']);
    const blocks = output.split(/\n{2,}/);

    return blocks
        .map(parseDeviceBlock)
        .filter(device => isPeripheralDevice(device));
}

function parseBluezPercentage(value) {
    if (value === null || value === undefined)
        return null;

    if (typeof value === 'number')
        return `${value}%`;

    const parsed = Number.parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : `${parsed}%`;
}

function mapBluezIconToType(iconName) {
    if (iconName === null || iconName === undefined)
        return 'input';

    const normalized = String(iconName).toLowerCase();
    const aliases = {
        'audio-card': 'audio-headphones',
        'audio-headset': 'audio-headset',
        'audio-headphones': 'audio-headphones',
        'input-mouse': 'mouse',
        'input-keyboard': 'keyboard',
        'phone': 'phone',
    };

    return aliases[normalized] ?? normalizeDeviceType(normalized);
}

async function callSystemBus(methodName, parameters, replyType) {
    return new Promise((resolve, reject) => {
        Gio.DBus.system.call(
            BLUEZ_SERVICE,
            BLUEZ_OBJECT_MANAGER_PATH,
            'org.freedesktop.DBus.ObjectManager',
            methodName,
            parameters,
            replyType,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, result) => {
                try {
                    resolve(connection.call_finish(result));
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}

function parseBluezDevice(objectPath, interfaces) {
    const deviceInfo = interfaces['org.bluez.Device1'];
    const batteryInfo = interfaces['org.bluez.Battery1'];
    if (!deviceInfo || !batteryInfo)
        return null;

    const alias = deviceInfo.Alias ?? deviceInfo.Name ?? null;
    const iconName = deviceInfo.Icon ?? null;
    const connected = deviceInfo.Connected ?? false;
    const percentage = parseBluezPercentage(batteryInfo.Percentage);
    const type = mapBluezIconToType(iconName);

    if (!connected || percentage === null)
        return null;

    const device = {
        id: objectPath,
        model: alias,
        type: normalizeDeviceType(type),
        percentage: percentage,
        state: 'connected',
        rechargeable: true,
    };

    return isPeripheralDevice(device) ? device : null;
}

async function readBluezPeripheralDevices() {
    let response;

    try {
        response = await callSystemBus(
            'GetManagedObjects',
            null,
            new GLib.VariantType('(a{oa{sa{sv}}})')
        );
    } catch (error) {
        return [];
    }

    const [managedObjects] = response.deepUnpack();
    const devices = [];

    for (const [objectPath, interfaces] of Object.entries(managedObjects)) {
        const device = parseBluezDevice(objectPath, interfaces);
        if (device !== null)
            devices.push(device);
    }

    return devices;
}

function buildDeviceKey(device) {
    if (device.id !== undefined)
        return device.id;

    return `${device.model ?? ''}|${device.type ?? ''}`;
}

function mergePeripheralDevices(devices) {
    const merged = new Map();

    for (const device of devices) {
        const key = buildDeviceKey(device);
        const existing = merged.get(key);

        if (existing === undefined) {
            merged.set(key, device);
            continue;
        }

        merged.set(key, {
            ...existing,
            ...device,
            model: device.model ?? existing.model,
            percentage: device.percentage ?? existing.percentage,
            state: device.state ?? existing.state,
            type: device.type ?? existing.type,
        });
    }

    return Array.from(merged.values()).sort((left, right) => {
        const leftName = left.model ?? left.type ?? '';
        const rightName = right.model ?? right.type ?? '';
        return leftName.localeCompare(rightName);
    });
}

async function getPeripheralDevices() {
    const results = await Promise.allSettled([
        readPeripheralDevices(),
        readBluezPeripheralDevices(),
    ]);

    const devices = [];
    for (const result of results) {
        if (result.status === 'fulfilled')
            devices.push(...result.value);
    }

    return mergePeripheralDevices(devices);
}

class Extension {
    constructor() {
        this._indicator = null;
        this._label = null;
        this._detailsItem = null;
        this._devicesSection = null;
        this._deviceItems = [];
        this._timeoutId = null;
        this._deviceTimeoutId = null;
        this._isEnabled = false;
        this._deviceRefreshToken = 0;
    }

    enable() {
        this._isEnabled = true;
        this._indicator = new PanelMenu.Button(0.0, 'Charge Power Monitor', false);
        this._label = new St.Label({
            text: '...',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._detailsItem = new PopupMenu.PopupMenuItem('Loading...', {
            reactive: false,
            can_focus: false,
        });
        this._devicesSection = new PopupMenu.PopupMenuSection();

        this._indicator.add_child(this._label);
        this._indicator.menu.addMenuItem(this._detailsItem);
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addMenuItem(this._devicesSection);
        Main.panel.addToStatusArea('charge-power-monitor', this._indicator, 0, 'right');

        this._sync();
        this._refreshDevices();
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            REFRESH_INTERVAL_SECONDS,
            () => {
                this._sync();
                return GLib.SOURCE_CONTINUE;
            }
        );
        this._deviceTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            DEVICE_REFRESH_INTERVAL_SECONDS,
            () => {
                this._refreshDevices();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    disable() {
        this._isEnabled = false;

        if (this._timeoutId !== null) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._deviceTimeoutId !== null) {
            GLib.source_remove(this._deviceTimeoutId);
            this._deviceTimeoutId = null;
        }

        if (this._indicator !== null) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._label = null;
        this._detailsItem = null;
        this._devicesSection = null;
        this._deviceItems = [];
    }

    _sync() {
        if (this._label === null || this._detailsItem === null)
            return;

        const reading = readPowerTelemetry();
        this._label.text = reading.text;
        this._detailsItem.label.text = reading.details;
    }

    async _refreshDevices() {
        const refreshToken = ++this._deviceRefreshToken;

        try {
            const devices = await getPeripheralDevices();

            if (!this._isEnabled || refreshToken !== this._deviceRefreshToken)
                return;

            this._renderDevices(devices);
        } catch (error) {
            if (!this._isEnabled || refreshToken !== this._deviceRefreshToken)
                return;

            this._renderDevices([]);
        }
    }

    _renderDevices(devices) {
        if (this._devicesSection === null)
            return;

        for (const item of this._deviceItems)
            item.destroy();

        this._deviceItems = [];

        const titleItem = new PopupMenu.PopupMenuItem('Peripheral batteries', {
            reactive: false,
            can_focus: false,
        });
        this._devicesSection.addMenuItem(titleItem);
        this._deviceItems.push(titleItem);

        if (devices.length === 0) {
            const emptyItem = new PopupMenu.PopupMenuItem('No supported devices detected', {
                reactive: false,
                can_focus: false,
            });
            this._devicesSection.addMenuItem(emptyItem);
            this._deviceItems.push(emptyItem);
            return;
        }

        for (const device of devices) {
            const item = new PopupMenu.PopupMenuItem(formatDeviceLabel(device), {
                reactive: false,
                can_focus: false,
            });
            this._devicesSection.addMenuItem(item);
            this._deviceItems.push(item);
        }
    }
}

function init() {
    return new Extension();
}
