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

function getDefaultBrowserPath() {
    // returns a string when found, else null
    var rez;

    switch (core.os.mname) {
        case 'winnt':
        case 'wince':

                // http://en.code-bude.net/2013/04/28/how-to-retrieve-default-browsers-path-in-c/

                // Read default browser path from Win XP registry key
                // this XP registry key is for Win10 as well, maybe others. I think just Vista has the special entry below
                var rez_xp = winRegistryRead('HKEY_CLASSES_ROOT', 'http\\shell\\open\\command', null, 2056); // null for default value
                console.log('rez_xp:', rez_xp);
                var rez_vista;
        		if (rez_xp === null || rez_xp === undefined) {
                    //If browser path wasn't found, try Win Vista registry key
        			rez_vista = winRegistryRead('HKEY_CURRENT_USER', 'Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http', null, 2056);
                    console.log('rez_vista:', rez_vista);
                }
                // else, i dont know but maybe what if its a blank string?

                var reg_val = (rez_xp || rez_vista);
                if (reg_val) {
                    // If browser reg_val was found, clean it
                    var path_in_quotes = reg_val.match(/"(.*?)"/);
                    if (path_in_quotes) {
                        rez =  path_in_quotes[1];
                    } else {
                        // maybe no quotes - so then assume the registry value is the path
                        rez = reg_val;
                    }
                }

            break;
        case 'gtk':

                var app_info = ostypes.API('g_app_info_get_default_for_uri_scheme')('http');
                console.log('app_info:', app_info);

                // var commandline = ostypes.API('g_app_info_get_commandline')(app_info);
                // console.log('commandline:', commandline, commandline.toString(), commandline.readString()); // commandline: CData { contents: 102 } ctypes.char.ptr(ctypes.UInt64("0x7fcb70bdf340")) firefox %u bootstrap.js:94
                //
                // var executable = ostypes.API('g_app_info_get_executable')(app_info);
                // console.log('executable:', executable, executable.toString(), executable.readString()); // executable: CData { contents: 102 } ctypes.char.ptr(ctypes.UInt64("0x7fcb7c234580")) firefox bootstrap.js:97

                var desktop_app_info = ctypes.cast(app_info, ostypes.TYPE.GDesktopAppInfo.ptr);
                var desktop_filename = ostypes.API('g_desktop_app_info_get_filename')(desktop_app_info);
                console.log('desktop_filename:', desktop_filename, desktop_filename.toString(), desktop_filename.readString()); // desktop_filename: CData { contents: 47 } ctypes.char.ptr(ctypes.UInt64("0x7fcb704e2640")) /usr/share/applications/firefox.desktop

                rez = desktop_filename.readString();

            break;
        case 'darwin':

                // http://stackoverflow.com/questions/15404723/how-to-get-version-of-default-browser-on-my-mac-os-x/15406479#15406479

                var myNSStrings = new ostypes.HELPER.nsstringColl();

                var NSURL = ostypes.HELPER.class('NSURL');
                var inurl_objc = ostypes.API('objc_msgSend')(NSURL, ostypes.HELPER.sel('URLWithString:'), myNSStrings.get('http:'));
                console.log('inurl_objc:', inurl_objc, inurl_objc.toString());

                myNSStrings.releaseAll();

                var inurl = ctypes.cast(inurl_objc, ostypes.TYPE.CFURLRef);

                var appurl;
                try {
                    // LSGetApplicationForURL was deprecated in 10.10 per the docs
                    appurl = ostypes.TYPE.CFURLRef();
                    var rez_getapp = ostypes.API('LSGetApplicationForURL')(inurl, ostypes.CONST.kLSRolesAll, null, appurl.address());
                    console.log('rez_getapp:', rez_getapp, rez_getapp.toString(), cutils.jscGetDeepest(rez_getapp), ostypes.HELPER.convertLongOSStatus(cutils.jscGetDeepest(rez_getapp)));
                } catch(ex) {
                    // LSCopyDefaultApplicationURLForURL is what should be used in 10.10+
                    console.error('failed to do LSGetApplicationForURL but this makes sense as docs say this was dperecated in 10.10, so try this other way, ex:', ex);
                    var rez_copyapp = ostypes.API('LSCopyDefaultApplicationURLForURL')(inurl, ostypes.CONST.kLSRolesAll, null);
                    console.log('rez_copyapp:', rez_copyapp, rez_copyapp.toString());
                    appurl = rez_copyapp;
                }

                // https://developer.apple.com/library/mac/documentation/Cocoa/Reference/Foundation/Classes/NSURL_Class/#//apple_ref/occ/instp/NSURL/path
                var path = ostypes.API('objc_msgSend')(appurl, ostypes.HELPER.sel('path'));
                console.log('path:', path, path.toString);
                if (!path.isNull()) {
                    var path_js = ostypes.HELPER.readNSString(path);
                    console.log('path_js:', path_js);
                }

                rez = path_js;

                // do i have to release path? as it is a NSString it makes sense, // TODO: figure this out and uncomment if true
                // ostypes.API('objc_msgSend')(path, ostypes.HELPER.sel('release'));


            break;
        // case 'android':
        //
        //         // TODO:
        //
        //     break;
        default:
            console.error('Your OS - ' + core.os.name + ' - is not supported');
            throw new Error('Your OS - ' + core.os.name + ' - is not supported');
    }

    return rez;
}

function main() {
    var defaultbrowser_path = getDefaultBrowserPath();
    console.log('defaultbrowser_path:', defaultbrowser_path);
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

// START - platform helpers
function winRegistryRead(aHkeyGroup, aKeyDirPath, aKeyName, aLength=50) { // v4 - https://gist.github.com/Noitidart/3d82320f1799c7cd6aee5630ad88b221/
	// aHkeyGroup - string; ['HKEY_CLASSES_ROOT', 'HKEY_CURRENT_USER', 'HKEY_LOCAL_MACHINE', 'HKEY_USERS', 'HKEY_PERFORMANCE_DATA', 'HKEY_CURRENT_CONFIG', 'HKEY_DYN_DATA'] no others are supported
	// aKeyDirPath - string; with double back slash - like "Hardware\\DeviceMap\\SerialComm"
	// aKeyName - string; like "\\Device\\Serial0" OR '' or null for default value

	// returns
	// cKeyValue as string -- default max length returned is aLength=50 link90000000000
	// else on error it returns undefined
	// else if it doesnt exist it returns null

	var h_Key = ostypes.TYPE.HKEY();
	var group_key = ostypes.TYPE.HKEY(ostypes.CONST[aHkeyGroup]);
	var rez_openKey = ostypes.API('RegOpenKeyEx')(group_key, aKeyDirPath, 0, ostypes.CONST.KEY_QUERY_VALUE, h_Key.address());
	if (!cutils.jscEqual(rez_openKey, ostypes.CONST.ERROR_SUCCESS)) {
		console.error('failed opening registry key:', cutils.jscGetDeepest(rez_openKey));
		// throw new Error('failed opening registry key');
		return undefined;
	}

	var cKeyValue;
	try {
		var u16_cKeyData = ostypes.TYPE.WCHAR.array(aLength)(); // link90000000000

		var u32_Type = ostypes.TYPE.DWORD();
		var u32_Size = ostypes.TYPE.DWORD(u16_cKeyData.constructor.size);

		var u16_cKeyData_castedAsByte = ctypes.cast(u16_cKeyData.address(), ostypes.TYPE.BYTE.ptr);

		// var a = ctypes.jschar.array(aLength)(); // CData { length: 50 }
		// var ac = ctypes.cast(a.address(), ctypes.char.array(a.constructor.size / ctypes.char.size).ptr).contents; // CData { length: 100 }

		if (aKeyName === undefined || aKeyName === '') {
			aKeyName = null; // i can use '' but i prefer to use null, this will get the (Default Value). http://stackoverflow.com/a/6297205/1828637
		}
		var rez_queryKey = ostypes.API('RegQueryValueEx')(h_Key, aKeyName, null, u32_Type.address(), u16_cKeyData_castedAsByte, u32_Size.address());
		if (!cutils.jscEqual(rez_queryKey, ostypes.CONST.ERROR_SUCCESS)) {
			if (cutils.jscEqual(rez_queryKey, ostypes.CONST.ERROR_FILE_NOT_FOUND)) {
				// if it is 2 then the value of u16_NTPath doesnt exist in this registry, its common to registry querying
				console.warn('this aKeyName does not exist OR its value is (value not set) at aKeyDirPath in aHkeyGroup so returning null.', aHkeyGroup, aKeyDirPath, aKeyName);
				cKeyValue = null;
			} else {
				console.error('failed querying registry key:', cutils.jscGetDeepest(rez_queryKey));
				// error of 234 here means ERROR_MORE_DATA, so increase the aLength and try again
				// throw new Error('failed querying registry key');
				return undefined;
			}
		} else {
			cKeyValue = u16_cKeyData.readString();
		}
	} finally {
		var rez_closeKey = ostypes.API('RegCloseKey')(h_Key);
		if (!cutils.jscEqual(rez_closeKey, ostypes.CONST.ERROR_SUCCESS)) {
			console.error('failed closing registry key:', cutils.jscGetDeepest(rez_closeKey));
			// throw new Error('failed closing registry key');
		}
		else {
			console.log('closed key');
		}
	}

	return cKeyValue;
}
