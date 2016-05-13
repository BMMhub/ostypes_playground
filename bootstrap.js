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
	
	// find window with title "Camera"
	var hwnd = ostypes.API('FindWindow')(null, 'Untitled - Notepad');

	if(hwnd.isNull()) {
		console.warn('no window found with specified lpClassName/lpWindowName');
	} else {
	
		// ask user what to do
		var doWhat = Services.prompt.confirmEx(Services.wm.getMostRecentWindow('navigator:browser'), 'Toggle Window', 'What do you want to do with the window?', Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING + Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_IS_STRING + Services.prompt.BUTTON_POS_2 * Services.prompt.BUTTON_TITLE_IS_STRING, 'Hide', 'Nothing', 'Show', null, {value: false});
		// cancel === 1
		
		console.log('doWhat:', doWhat);
		
		if (doWhat === 1) {
			return; // cancelled
		}
		/*
		var rez_ShowWindow = ostypes.API('ShowWindow')(hwnd, doWhat === 0 ? ostypes.CONST.SW_HIDE : ostypes.CONST.SW_SHOW);
		console.info('rez_ShowWindow:', rez_ShowWindow, rez_ShowWindow.toString(), uneval(rez_ShowWindow));
		if(rez_ShowWindow == true) {
			console.log('intended state succesfully applied');
		} else if(rez_ShowWindow == false) {
			console.error('ShowWindow failed, it may already be at the intended state');
		} else {
			console.error('ShowWindow returned not false or true, this should never happen, if it did it should crash');
		}
		*/
		var taskbarListPtr;
		var taskbarList;
		try {
			var hr_CoInit = ostypes.API('CoInitializeEx')(null, ostypes.CONST.COINIT_APARTMENTTHREADED);
			console.info('hr_CoInit:', hr_CoInit, hr_CoInit.toString(), uneval(hr_CoInit));
			// ostypes.HELPER.checkHRESULT(hr_CoInit, 'CoInit') // cannot use this as it throws `SPECIAL HRESULT FAIL RESULT!!! HRESULT is 1!!! hr: Int64 {  } funcName: CoInit`
			
			if (cutils.jscEqual(ostypes.CONST.S_OK, hr_CoInit)) {
				console.log('CoInitializeEx says successfully initialized');
			} else if (cutils.jscEqual(ostypes.CONST.S_FALSE, hr_CoInit)) {
				console.warn('CoInitializeEx says the COM library is already initialized on this thread!!! This is weird I dont expect this to ever happen.'); // i made this console.error so it brings it to my attention. i dont expect this, if it happens i need to deal with it. thats why i dont throw new error here
				// warn, not an error, as i think i can proceed just fine
			} else {
				console.error('Unexpected return value from CoInitializeEx: ', hr);
				throw new Error('Unexpected return value from CoInitializeEx: ' + hr);
			}
			
			var CLSID_TaskbarList = ostypes.HELPER.CLSIDFromArr([0x56fdf344,0xfd6d,0x11d0,[0x95,0x8a,0x0,0x60,0x97,0xc9,0xa0,0x90]]);
			var IID_ITaskbarList = ostypes.HELPER.CLSIDFromArr([0x56fdf342,0xfd6d,0x11d0,[0x95,0x8a,0x0,0x60,0x97,0xc9,0xa0,0x90]]);
			
			taskbarListPtr = ostypes.TYPE.ITaskbarList.ptr();
			var hr_CoCreateInstance = ostypes.API('CoCreateInstance')(CLSID_TaskbarList.address(), null, ostypes.CONST.CLSCTX_INPROC_SERVER, IID_ITaskbarList.address(), taskbarListPtr.address());
			ostypes.HELPER.checkHRESULT(hr_CoCreateInstance, 'main -> CoCreateInstance');
			taskbarList = taskbarListPtr.contents.lpVtbl.contents;
			
			// initialize the taskbar list object
			var rez_inittb = taskbarList.HrInit(taskbarListPtr);
			console.log('rez_inittb:', rez_inittb, rez_inittb.toString());
			ostypes.HELPER.checkHRESULT(rez_inittb, 'init taskbarList');
			
			if (doWhat === 0) {
				var rez_hide = taskbarList.DeleteTab(taskbarListPtr, hwnd);
				console.log('rez_hide:', rez_hide, rez_hide.toString());
				ostypes.HELPER.checkHRESULT(rez_hide, 'main -> DeleteTab');
			} else if (doWhat == 2) {
				var rez_add = taskbarList.AddTab(taskbarListPtr, hwnd);
				console.log('rez_add:', rez_add, rez_add.toString());
				ostypes.HELPER.checkHRESULT(rez_add, 'main -> AddTab');
			}
			
		} catch(err) {
			console.error('CAUGHT:', err);
		} finally {
			if (taskbarList) {
				var rez_refCnt = taskbarList.Release(taskbarListPtr);
				console.log('rez_refCnt:', rez_refCnt, rez_refCnt.toString());
			}

			//if (shouldUninitialize) { // should always CoUninit even if CoInit returned false, per the docs on msdn
				ostypes.API('CoUninitialize')(); // return void
				console.log('did CoUnit');
			//}
		}
	}
	
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
function xpcomSetTimeout(aNsiTimer, aDelayTimerMS, aTimerCallback) {
	aNsiTimer.initWithCallback({
		notify: function() {
			aTimerCallback();
		}
	}, aDelayTimerMS, Ci.nsITimer.TYPE_ONE_SHOT);
}
// end - common helper functions