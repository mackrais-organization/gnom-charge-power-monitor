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
const REFRESH_INTERVAL_SECONDS = 1;

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

class Extension {
    constructor() {
        this._indicator = null;
        this._label = null;
        this._detailsItem = null;
        this._timeoutId = null;
    }

    enable() {
        this._indicator = new PanelMenu.Button(0.0, 'Charge Power Monitor', false);
        this._label = new St.Label({
            text: '...',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._detailsItem = new PopupMenu.PopupMenuItem('Loading...', {
            reactive: false,
            can_focus: false,
        });

        this._indicator.add_child(this._label);
        this._indicator.menu.addMenuItem(this._detailsItem);
        Main.panel.addToStatusArea('charge-power-monitor', this._indicator, 0, 'right');

        this._sync();
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            REFRESH_INTERVAL_SECONDS,
            () => {
                this._sync();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    disable() {
        if (this._timeoutId !== null) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._indicator !== null) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._label = null;
        this._detailsItem = null;
    }

    _sync() {
        const reading = readPowerTelemetry();
        this._label.text = reading.text;
        this._detailsItem.label.text = reading.details;
    }
}

function init() {
    return new Extension();
}
