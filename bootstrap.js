const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;

Cu.import('resource://gre/modules/ctypes.jsm');
Cu.import('resource://gre/modules/osfile.jsm'); // this gives the `OS` variable which is very useful for constants like `OS.System`, `OS.Constants.libc`, `OS.Constants.Win`. Constants missing from `.libc` and `.Win` you can define in the `CONSTS` object in the respective ostypes module
Cu.import('resource://gre/modules/Services.jsm');

var core = {
    addon: {
        name: 'ostypes_playground',
        id: 'ostypes_playground@jetpack',
        path: {
            content: 'chrome://ostypes_playground/content/',
            modules: 'chrome://ostypes_playground/content/modules/'
        }
    },
    os: {
        name: OS.Constants.Sys.Name.toLowerCase(), // possible values are here - https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/OS_TARGET
        toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
        xpcomabi: Services.appinfo.XPCOMABI
    },
    firefox: {
        pid: Services.appinfo.processID,
        version: Services.appinfo.version
    }
};
core.os.mname = core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name; // mname stands for modified-name // this will treat solaris, linux, unix, *bsd systems as the same. as they are all gtk based

var BOOTSTRAP = this;

function initOstypes() {
	Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/cutils.jsm', BOOTSTRAP); // need to load cutils first as ostypes_mac uses it for HollowStructure
	Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/ctypes_math.jsm', BOOTSTRAP);
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			console.log('loading:', core.addon.path.modules + 'ostypes/ostypes_win.jsm');
			Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/ostypes_win.jsm', BOOTSTRAP);
			break
		case 'gtk':
			Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/ostypes_x11.jsm', BOOTSTRAP);
			break;
		case 'darwin':
			Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/ostypes_mac.jsm', BOOTSTRAP);
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}
}

var OSStuff = {};
function main() {

    // https://developer.gnome.org/gio/stable/GFileMonitor.html#g-file-monitor-emit-event
    var dirwatcher_handler = function(monitor, file, other_file, event_type, user_data) {
        /* https://developer.gnome.org/gio/stable/GFileMonitor.html#GFileMonitor-changed
         * Emitted when file has been changed.
         * If using G_FILE_MONITOR_WATCH_RENAMES on a directory monitor, and the information is available (and if supported by the backend), event_type may be G_FILE_MONITOR_EVENT_RENAMED, G_FILE_MONITOR_EVENT_MOVED_IN or G_FILE_MONITOR_EVENT_MOVED_OUT.
         * In all cases file will be a child of the monitored directory. For renames, file will be the old name and other_file is the new name. For "moved in" events, file is the name of the file that appeared and other_file is the old name that it was moved from (in another directory). For "moved out" events, file is the name of the file that used to be in this directory and other_file is the name of the file at its new location.
         * It makes sense to treat G_FILE_MONITOR_EVENT_MOVED_IN as equivalent to G_FILE_MONITOR_EVENT_CREATED and G_FILE_MONITOR_EVENT_MOVED_OUT as equivalent to G_FILE_MONITOR_EVENT_DELETED, with extra information. G_FILE_MONITOR_EVENT_RENAMED is equivalent to a delete/create pair. This is exactly how the events will be reported in the case that the G_FILE_MONITOR_WATCH_RENAMES flag is not in use.
         * If using the deprecated flag G_FILE_MONITOR_SEND_MOVED flag and event_type is G_FILE_MONITOR_EVENT_MOVED, file will be set to a GFile containing the old path, and other_file will be set to a GFile containing the new path.
         * In all the other cases, other_file will be set to NULL.
        */
        console.log('in dirwatcher_handler', 'monitor:', monitor, 'file:', file, 'other_file:', other_file, 'event_type:', event_type, 'user_data:', user_data);
    };

    OSStuff.dirwatcher_handler_c = ostypes.TYPE.GFileMonitor_changed_signal(dirwatcher_handler);

	var path = OS.Constants.Path.desktopDir;
    console.log('ok done main');

    var gfile = ostypes.API('g_file_new_for_path')(path);
    console.log('gfile:', gfile, gfile.toString());

    if (gfile.isNull()) {
        console.error('failed to create gfile for path:', path);
        throw new Error('failed to create gfile for path: ' + path);
    }

    var mon = ostypes.API('g_file_monitor_directory')(gfile, ostypes.CONST.G_FILE_MONITOR_WATCH_MOVES, null, null);
    console.log('mon:', mon, mon.toString());

    ostypes.API('g_object_unref')(gfile);
    if (mon.isNull()) {
        console.error('failed to create dirwatcher for path:', path);
        throw new Error('failed to create dirwatcher for path: ' + path);
    }

    // var id = ostypes.API('g_signal_connect_data')(mon, 'dirwatcher::triggered', OSStuff.dirwatcher_handler_c, null, null, ostypes.CONST.G_CONNECT_AFTER);
    var id = ostypes.API('g_signal_connect_data')(mon, 'changed', OSStuff.dirwatcher_handler_c, null, null, 0);
    console.log('id:', id, id.toString());

    xpcomSetTimeout(null, 20000, function() {
        console.log('stopping dirwatcher');
        ostypes.API('g_signal_handler_disconnect')(mon, id);
        ostypes.API('g_object_unref')(mon);

        console.log('dirwatcher stopped');
    });
}

function unmain() {

}

function install() {}
function uninstall() {}

function startup(aData, aReason) {

	initOstypes();
	main();

}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }

	unmain();
}

// start - common helper functions
var gTempTimers = {}; // hold temporary timers, when first arg is not set for xpcomSetTimeout
function xpcomSetTimeout(aNsiTimer, aDelayTimerMS, aTimerCallback) {
    var timer;
    if (!aNsiTimer) {
        var timerid = Date.now();
        gTempTimers[timerid] = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
        timer = gTempTimers[timerid];
    } else {
        timer = aNsiTimer;
    }

	timer.initWithCallback({
		notify: function() {
			aTimerCallback();
            if (!aNsiTimer) {
                delete gTempTimers[timerid];
            }
		}
	}, aDelayTimerMS, Ci.nsITimer.TYPE_ONE_SHOT);
}

// end - common helper functions
