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
		
	var eventType = ostypes.TYPE.EventTypeSpec();
	eventType.eventClass = ostypes.CONST.kEventClassKeyboard;
	eventType.eventKind = ostypes.CONST.kEventHotKeyPressed;
	
	ostypes.HELPER.convertLongOSStatus(0x6B657962);
	
	console.log('pre install eventType:', eventType.toString(), 'eventType.eventClass:', eventType.eventClass.toString(), 'eventType.eventKind:', eventType.eventKind.toString());
	
	var rez_appTarget = ostypes.API('GetApplicationEventTarget')();
	// console.log('rez_appTarget GetApplicationEventTarget:', rez_appTarget.toString());
	OSStuff.cHotKeyHandler = ostypes.TYPE.EventHandlerUPP(macHotKeyHandler);
	console.log('OSStuff.cHotKeyHandler:', OSStuff.cHotKeyHandler.toString());
	var rez_install = ostypes.API('InstallEventHandler')(rez_appTarget, OSStuff.cHotKeyHandler, 1, eventType.address(), null, null);
	console.log('rez_install:', rez_install.toString());
	console.log('OSStuff.cHotKeyHandler:', OSStuff.cHotKeyHandler.toString());
	// console.log('post install eventType:', eventType.toString(), 'eventType.eventClass:', eventType.eventClass.toString(), 'eventType.eventKind:', eventType.eventKind.toString());
	
	var gMyHotKeyRef = ostypes.TYPE.EventHotKeyRef();
	var gMyHotKeyID = ostypes.TYPE.EventHotKeyID();
	gMyHotKeyID.signature = 1752460081; // has to be a four char code. MACS is http://stackoverflow.com/a/27913951/1828637 0x4d414353 so i just used htk1 as in the example here http://dbachrach.com/blog/2005/11/program-global-hotkeys-in-cocoa-easily/ i just stuck into python what the stackoverflow topic told me and got it struct.unpack(">L", "htk1")[0]
	gMyHotKeyID.id = 1876;
	
	var rez_appTarget2 = ostypes.API('GetApplicationEventTarget')();
	console.log('rez_appTarget2 GetApplicationEventTarget:', rez_appTarget2.toString());
	
	console.log('gMyHotKeyID:', gMyHotKeyID.toString());
	console.log('gMyHotKeyID.address():', gMyHotKeyID.address().toString());
	
	console.log('ostypes.CONST.shiftKey + ostypes.CONST.cmdKey:', ostypes.CONST.shiftKey + ostypes.CONST.cmdKey);
	console.log('gMyHotKeyRef.address():', gMyHotKeyRef.address().toString());
	
	var rez_reg = ostypes.API('RegisterEventHotKey')(49, ostypes.CONST.shiftKey + ostypes.CONST.cmdKey, gMyHotKeyID, rez_appTarget2, 0, gMyHotKeyRef.address());
	console.log('rez_reg:', rez_reg.toString());
	ostypes.HELPER.convertLongOSStatus(rez_reg);
	
}

function macHotKeyHandler(nextHandler, theEvent, userDataPtr) {
	// EventHandlerCallRef nextHandler, EventRef theEvent, void *userData
	console.error('wooohoo ah!! called hotkey!');
	return 1; // must be of type ostypes.TYPE.OSStatus
}

function install() {}
function uninstall() {}

function startup(aData, aReason) {
	
	initOstypes();
	main();
	
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