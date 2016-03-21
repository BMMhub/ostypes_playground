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

Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/cutils.jsm', BOOTSTRAP);
Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/ctypes_math.jsm', BOOTSTRAP);

var OSStuff = {};
function main() {
		
	var jsCallback = function(lpParameter, TimerOrWaitFired) {
	  console.log('lpParameter:', lpParameter, 'TimerOrWaitFired:', TimerOrWaitFired);
	  return undefined;
	}

	OSStuff.cCallback = ostypes.TYPE.WAITORTIMERCALLBACK.ptr(jsCallback);
	
	var hNewTimer = ostypes.TYPE.HANDLE();
	OSStuff.hNewTimer = hNewTimer;
	var ret = ostypes.API('CreateTimerQueueTimer')(
	  hNewTimer.address(),
	  null,
	  OSStuff.cCallback,
	  null,
	  2000,
	  0,
	  ostypes.CONST.WT_EXECUTEDEFAULT
	);
	
	console.log('ret:', ret, 'winLastError:', ctypes.winLastError);
	
	OSStuff.xpcomTimer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
	
	var cleanup = function() {
		var rez_del = ostypes.API('DeleteTimerQueueTimer')(null, OSStuff.hNewTimer, null);
		delete OSStuff.hNewTimer;
		delete OSStuff.cCallback;
		delete OSStuff.xpcomTimer;
	};
	
	xpcomSetTimeout(OSStuff.xpcomTimer, 10000, cleanup);
	
}

function install() {}
function uninstall() {}

function startup(aData, aReason) {
	
	// main();
	
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }

	// if (OSStuff.xpcomTimer) {
		// OSStuff.xpcomTimer.cancel();
		// delete OSStuff.xpcomTimer;
	// }
}

// start - common helper functions
function xpcomSetTimeout(aNsiTimer, aDelayTimerMS, aTimerCallback) {
	aNsiTimer.initWithCallback({
		notify: function() {
			aTimerCallback();
		}
	}, aDelayTimerMS, Ci.nsITimer.TYPE_ONE_SHOT);
}
// end - common helper functions