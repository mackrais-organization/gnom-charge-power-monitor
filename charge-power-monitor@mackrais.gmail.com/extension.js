/*
 * Charge Power Monitor
 * Author: Oleh Boiko
 * Contact: developer@mackrais.com
 */
/* exported init */

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
const TEXT_DECODER = new TextDecoder();

// The kernel exposes the charge limit under different names depending on the
// battery driver. The first readable file in each list wins.
const CHARGE_END_THRESHOLD_FILES = [
    'charge_control_end_threshold',
    'charge_stop_threshold',
];
// Read only, for display. The extension writes the end threshold; the driver
// moves the start threshold on its own to keep it below the end value.
const CHARGE_START_THRESHOLD_FILES = [
    'charge_control_start_threshold',
    'charge_start_threshold',
];
// Some drivers publish the exact values the embedded controller accepts.
const CHARGE_END_OPTION_FILES = [
    'charge_control_end_available_thresholds',
];
// Fallback list for drivers that do not publish an explicit set of values.
const CHARGE_LIMIT_FALLBACK_VALUES = [100, 90, 80, 70, 60, 50];
// Short guidance shown next to each selectable value.
const CHARGE_LIMIT_HINTS = {
    100: 'No limit · full runtime, most wear',
    95: 'Almost no limit',
    90: 'Light protection',
    85: 'Light protection',
    80: 'Recommended when mostly plugged in',
    75: 'Longer battery life',
    70: 'Longer battery life',
    65: 'Long battery life',
    60: 'Maximum battery life · always plugged in',
    50: 'Storage level',
    40: 'Storage level',
};
const CHARGE_LIMIT_INFO =
    'Caps how full the battery charges. Staying below 100% reduces ' +
    'lithium-ion wear from sitting at a full charge; above the cap the ' +
    'laptop runs on AC power.\n' +
    'A lower cap only takes effect once the battery drains below the resume ' +
    'level - the controller does not discharge a battery that is already ' +
    'fuller than the cap.';

function execCommunicate(argv, stdin = null) {
    let flags = Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE;
    if (stdin !== null)
        flags |= Gio.SubprocessFlags.STDIN_PIPE;

    const proc = Gio.Subprocess.new(argv, flags);

    return new Promise((resolve, reject) => {
        proc.communicate_utf8_async(stdin, null, (subprocess, result) => {
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

async function readTrimmedFile(path) {
    try {
        const file = Gio.File.new_for_path(path);
        const [, contents] = await new Promise((resolve, reject) => {
            file.load_contents_async(null, (source, result) => {
                try {
                    resolve(source.load_contents_finish(result));
                } catch (error) {
                    reject(error);
                }
            });
        });
        return TEXT_DECODER.decode(contents).trim();
    } catch (error) {
        return null;
    }
}

async function readInteger(path) {
    const value = await readTrimmedFile(path);
    if (value === null)
        return null;

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

async function findBatteryPath() {
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
            const type = await readTrimmedFile(`${candidatePath}/type`);

            if (type === 'Battery')
                return candidatePath;
        }
    } catch (error) {
        return null;
    }

    return null;
}

async function readPowerTelemetry() {
    const batteryPath = await findBatteryPath();
    if (batteryPath === null) {
        return {
            text: 'n/a',
            details: 'No battery detected',
        };
    }

    const status = await readTrimmedFile(`${batteryPath}/status`) ?? 'Unknown';
    const capacity = await readInteger(`${batteryPath}/capacity`);
    const powerMicroWatts = await readInteger(`${batteryPath}/power_now`);

    let watts = null;
    if (powerMicroWatts !== null) {
        watts = powerMicroWatts / 1e6;
    } else {
        const voltageMicroVolts = await readInteger(`${batteryPath}/voltage_now`);
        const currentMicroAmps = await readInteger(`${batteryPath}/current_now`);

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

async function findExistingBatteryFile(batteryPath, candidates) {
    for (const name of candidates) {
        const value = await readTrimmedFile(`${batteryPath}/${name}`);
        if (value !== null)
            return `${batteryPath}/${name}`;
    }

    return null;
}

function parseThresholdOptions(raw) {
    if (raw === null)
        return null;

    const values = raw
        .split(/\s+/)
        .map(token => Number.parseInt(token, 10))
        .filter(value => !Number.isNaN(value) && value >= 0 && value <= 100);

    if (values.length === 0)
        return null;

    const unique = Array.from(new Set(values)).sort((left, right) => left - right);
    return unique;
}

async function readChargeLimitInfo() {
    const unsupported = {
        supported: false,
        endPath: null,
        endThreshold: null,
        startThreshold: null,
        endOptions: null,
        capacity: null,
    };

    const batteryPath = await findBatteryPath();
    if (batteryPath === null)
        return unsupported;

    const endPath = await findExistingBatteryFile(batteryPath, CHARGE_END_THRESHOLD_FILES);
    if (endPath === null)
        return unsupported;

    const startPath = await findExistingBatteryFile(batteryPath, CHARGE_START_THRESHOLD_FILES);
    const endOptionPath = await findExistingBatteryFile(batteryPath, CHARGE_END_OPTION_FILES);

    return {
        supported: true,
        endPath,
        endThreshold: await readInteger(endPath),
        startThreshold: startPath === null ? null : await readInteger(startPath),
        endOptions: endOptionPath === null
            ? null
            : parseThresholdOptions(await readTrimmedFile(endOptionPath)),
        capacity: await readInteger(`${batteryPath}/capacity`),
    };
}

// Build the list of end-threshold values offered in the menu. Prefer the exact
// set the controller publishes; otherwise fall back to a sensible spread.
function chargeLimitChoices(info) {
    const options = info.endOptions;

    if (options !== null && options.length >= 3)
        return options.slice().reverse();

    let values = CHARGE_LIMIT_FALLBACK_VALUES;
    if (options !== null && options.length > 0) {
        const min = options[0];
        const max = options[options.length - 1];
        values = values.filter(value => value >= min && value <= max);
    }

    return values;
}

// Fixed privileged command. No shell is involved: `pkexec` runs the coreutils
// `tee` binary, which copies its standard input into the one file it is given.
// `endPath` is always the kernel's own charge_control_end_threshold (or the
// legacy charge_stop_threshold) attribute under /sys/class/power_supply/<battery>/
// (see CHARGE_END_THRESHOLD_FILES), and the value written is a plain integer
// passed on stdin. Only the end threshold is written; the driver keeps the
// start threshold below it on its own.
const CHARGE_LIMIT_COMMAND = ['pkexec', '/usr/bin/tee', '--'];

function writeEndThresholdCommand(endPath) {
    return [...CHARGE_LIMIT_COMMAND, endPath];
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
        this._chargeSection = null;
        this._chargeLimitState = null;
        this._chargeLimitBusy = false;
        this._timeoutId = null;
        this._deviceTimeoutId = null;
        this._isEnabled = false;
        this._deviceRefreshToken = 0;
        this._telemetryRefreshToken = 0;
        this._chargeRefreshToken = 0;
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
        this._chargeSection = new PopupMenu.PopupMenuSection();

        this._indicator.add_child(this._label);
        this._indicator.menu.addMenuItem(this._detailsItem);
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addMenuItem(this._devicesSection);
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addMenuItem(this._chargeSection);
        Main.panel.addToStatusArea('charge-power-monitor', this._indicator, 0, 'right');

        this._sync();
        this._refreshDevices();
        this._refreshChargeLimit();
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
                this._refreshChargeLimit();
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

        this._clearDeviceItems();

        if (this._chargeSection !== null) {
            this._chargeSection.destroy();
            this._chargeSection = null;
        }

        this._chargeLimitState = null;

        if (this._devicesSection !== null) {
            this._devicesSection.destroy();
            this._devicesSection = null;
        }

        if (this._detailsItem !== null) {
            this._detailsItem.destroy();
            this._detailsItem = null;
        }

        if (this._label !== null) {
            this._label.destroy();
            this._label = null;
        }

        if (this._indicator !== null) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._deviceItems = [];
    }

    async _sync() {
        const refreshToken = ++this._telemetryRefreshToken;

        if (this._label === null || this._detailsItem === null)
            return;

        const reading = await readPowerTelemetry();

        if (!this._isEnabled || refreshToken !== this._telemetryRefreshToken)
            return;

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

        this._clearDeviceItems();

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

    _clearDeviceItems() {
        for (const item of this._deviceItems)
            item.destroy();

        this._deviceItems = [];
    }

    async _refreshChargeLimit() {
        const refreshToken = ++this._chargeRefreshToken;

        if (this._chargeSection === null || this._chargeLimitBusy)
            return;

        let info;
        try {
            info = await readChargeLimitInfo();
        } catch (error) {
            return;
        }

        if (!this._isEnabled || refreshToken !== this._chargeRefreshToken)
            return;
        if (this._chargeSection === null)
            return;

        const signature = info.supported
            ? `on:${info.endThreshold}:${info.startThreshold}:${info.capacity}`
            : 'off';
        if (this._chargeLimitState === signature)
            return;

        this._chargeLimitState = signature;
        this._renderChargeLimit(info);
    }

    _renderChargeLimit(info) {
        if (this._chargeSection === null)
            return;

        this._chargeSection.removeAll();

        if (!info.supported) {
            const unsupported = new PopupMenu.PopupMenuItem(
                'Battery charge limit: not supported by this laptop',
                { reactive: false, can_focus: false }
            );
            this._chargeSection.addMenuItem(unsupported);
            return;
        }

        const title = info.endThreshold === null
            ? 'Battery charge limit'
            : `Battery charge limit — ${info.endThreshold}%`;
        const submenu = new PopupMenu.PopupSubMenuMenuItem(title);
        this._chargeSection.addMenuItem(submenu);

        this._addChargeLimitText(submenu.menu, CHARGE_LIMIT_INFO);

        const statusText = this._chargeLimitStatusText(info);
        if (statusText !== null)
            this._addChargeLimitText(submenu.menu, statusText);

        submenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        for (const endThreshold of chargeLimitChoices(info)) {
            const hint = CHARGE_LIMIT_HINTS[endThreshold];
            const label = hint === undefined
                ? `${endThreshold}%`
                : `${endThreshold}%  ·  ${hint}`;
            const item = new PopupMenu.PopupMenuItem(label);
            if (endThreshold === info.endThreshold)
                item.setOrnament(PopupMenu.Ornament.DOT);

            item.connect('activate', () => {
                this._applyChargeLimit(info, endThreshold);
            });
            submenu.menu.addMenuItem(item);
        }
    }

    _addChargeLimitText(menu, text) {
        const item = new PopupMenu.PopupMenuItem(text, {
            reactive: false,
            can_focus: false,
        });
        item.label.clutter_text.line_wrap = true;
        item.label.style = 'max-width: 320px;';
        menu.addMenuItem(item);
    }

    _chargeLimitStatusText(info) {
        if (info.endThreshold === null)
            return null;

        const resumeAt = info.startThreshold ?? info.endThreshold;

        if (info.capacity !== null && info.capacity > info.endThreshold) {
            return `Battery is at ${info.capacity}%. The ${info.endThreshold}% ` +
                `cap starts holding once it drops below ${resumeAt}%.`;
        }

        if (info.startThreshold !== null) {
            return `Charging stops at ${info.endThreshold}% and resumes ` +
                `below ${info.startThreshold}%.`;
        }

        return `Charging stops at ${info.endThreshold}%.`;
    }

    async _applyChargeLimit(info, endThreshold) {
        if (this._chargeLimitBusy)
            return;

        this._chargeLimitBusy = true;

        try {
            // One fixed `pkexec /usr/bin/tee -- <end attribute>` call; the
            // system authentication dialog shows once. The value is a plain
            // integer written on stdin.
            await execCommunicate(
                writeEndThresholdCommand(info.endPath),
                `${endThreshold}\n`
            );
        } catch (error) {
            // Authentication was dismissed or the write failed; the refresh
            // below repaints the menu with the value the battery actually has.
        } finally {
            this._chargeLimitBusy = false;
        }

        this._chargeLimitState = null;
        this._refreshChargeLimit();
    }
}

function init() {
    return new Extension();
}
