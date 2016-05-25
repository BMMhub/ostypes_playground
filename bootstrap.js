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

function waveIn() {

	switch (core.os.mname) {
			case 'winnt':

					const MMSYSERR_NOERROR = 0;

					var nDevices = ostypes.API('waveInGetNumDevs')();
					console.log('nDevices:', nDevices, nDevices.toString(), uneval(nDevices));

					var formats = [];
					var stWIC = ostypes.TYPE.WAVEINCAPS();
					console.log('ostypes.TYPE.WAVEINCAPS.size:', ostypes.TYPE.WAVEINCAPS.size);
					for(var i=0; i<nDevices; i++) {
						var mRes = ostypes.API('waveInGetDevCaps')(i, stWIC.address(), ostypes.TYPE.WAVEINCAPS.size);
						console.log('mRes:', mRes, mRes.toString(), uneval(mRes));
						if (!cutils.jscEqual(mRes, MMSYSERR_NOERROR)) {
							console.error('failed to get waveInGetDevCaps, mRes:', mRes, mRes.toString());
							throw new Error('failed to get waveInGetDevCaps');
						}
						console.log('stWIC:', stWIC, stWIC.toString(), uneval(stWIC));
						formats.push(stWIC.szPname.readString());
					}
					console.log('formats:', formats);

					try {

					} catch(ex) {
						console.error('error occoured:', ex);
					} finally {

					}

				break;
			default:
				console.error('Your os is not yet supported, your OS is: ' + core.os.mname);
				throw new Error('Your os is not yet supported, your OS is: ' + core.os.mname);
	}
}

function main() {
	switch (core.os.mname) {
			case 'winnt':

					var hr_CoInit = ostypes.API('CoInitializeEx')(null, ostypes.CONST.COINIT_APARTMENTTHREADED);
					console.info('hr_CoInit:', hr_CoInit, hr_CoInit.toString(), uneval(hr_CoInit) ,ostypes.HELPER.getStrOfResult(hr_CoInit));
					// ostypes.HELPER.checkHRESULT(hr_CoInit, 'CoInit') // cannot use this as it throws `SPECIAL HRESULT FAIL RESULT!!! HRESULT is 1!!! hr: Int64 {  } funcName: CoInit`
					if (!ostypes.HELPER.checkHR(hr_CoInit, 'hr_CoInit')) {
						throw new Error('Unexpected return value from CoInitializeEx: ' + hr);
					}

					var deviceEnumPtr;
					var deviceEnum;
					// try {
						var CLSID_SystemDeviceEnum = ostypes.HELPER.CLSIDFromArr([0x62be5d10, 0x60eb, 0x11d0,[0xbd, 0x3b, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]]);
						var IID_ICreateDevEnum = ostypes.HELPER.CLSIDFromString('29840822-5B84-11D0-BD3B-00A0C911CE86');

						deviceEnumPtr = ostypes.TYPE.ICreateDevEnum.ptr();
						var hr_instDeviceNum = ostypes.API('CoCreateInstance')(CLSID_SystemDeviceEnum.address(), null, ostypes.CONST.CLSCTX_INPROC_SERVER, IID_ICreateDevEnum.address(), deviceEnumPtr.address());//Initialise Device enumerator
						ostypes.HELPER.checkHRESULT(hr_instDeviceNum, 'instantiate deviceEnum');
						deviceEnum = deviceEnumPtr.contents.lpVtbl.contents;

						// Enumerate the specified device, distinguished by DEVICE_CLSID such as CLSID_AudioInputDeviceCategory
						var CLSID_AudioInputDeviceCategory = ostypes.HELPER.CLSIDFromArr([0x33d9a762, 0x90c8, 0x11d0, [0xbd, 0x43, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]])
						var enumCatPtr = ostypes.TYPE.IEnumMoniker.ptr();
					    var hr_enum = deviceEnum.CreateClassEnumerator(deviceEnumPtr, CLSID_AudioInputDeviceCategory.address(), enumCatPtr.address(), 0);
						if (ostypes.HELPER.checkHR(hr_enum, 'hr_enum')) {
							var enumCat = enumCatPtr.contents.lpVtbl.contents;

							var IID_IPropertyBag = ostypes.HELPER.CLSIDFromString('55272A00-42CB-11CE-8135-00AA004BB851');
							var propBagPtr = ostypes.TYPE.IPropertyBag.ptr();
							var devMonikPtr = ostypes.TYPE.IMoniker.ptr();
							var fetched = ostypes.TYPE.ULONG();
							// while (true) {
								// pickup as moniker
								var hr_next = enumCat.Next(enumCatPtr, 1, devMonikPtr.address(), fetched.address());
								if (!ostypes.HELPER.checkHR(hr_next, 'hr_next')) {
									break;
								}
								console.log('fetched:', fetched, fetched.toString(), cutils.jscGetDeepest(fetched));
								var devMonik = devMonikPtr.contents.lpVtbl.contents;

								// bind the properties of the moniker
								var hr_bind = devMonik.BindToStorage(devMonikPtr, null, null, IID_IPropertyBag.address(), propBagPtr.address());
								if (ostypes.HELPER.checkHR(hr_bind, 'hr_bind')) {
									var propBag = propBagPtr.contents.lpVtbl.contents;

									// // Initialise the variant data type
									// var varName = ostypes.TYPE.VARIANT();
									// ostypes.TYPE.API('VariantInit')(varName.address());
									//
									// var hr_read = propBag.Read('FriendlyName', varName.address(), null);
									// if (ostypes.HELPER.checkHR(hr_read, 'hr_read')) {
									// 	console.log('varName.bstrVal:', varName.bstrVal.readString());
									// }
									//
									// //clear the variant data type
									// ostypes.TYPE.API('VariantClear')(varName.address());

									var releasePropBag = propBag.Release(propBagPtr); // release the properties
									console.log('releasePropBag:', releasePropBag, releasePropBag.toString());
								}
								var releaseDevMonik = devMonik.Release(devMonikPtr); // release Device moniker
								console.log('releaseDevMonik:', releaseDevMonik, releaseDevMonik.toString());
							// }

							var releaseEnumCat = enumCat.Release(enumCatPtr); // release category enumerator
							console.log('releaseEnumCat:', releaseEnumCat, releaseEnumCat.toString());
						}
					// } catch(ex) {
					// 	console.error('ERROR:', ex);
					// } finally {
						if (!deviceEnumPtr.isNull()) {
							var releaseDeviceEnum = deviceEnum.Release(deviceEnumPtr);
							console.log('releaseDeviceEnum:', releaseDeviceEnum, releaseDeviceEnum.toString());
						} else {
							console.log('deviceEnumPtr is null', deviceEnumPtr, deviceEnumPtr.toString());
						}
						//if (shouldUninitialize) { // should always CoUninit even if CoInit returned false, per the docs on msdn
							ostypes.API('CoUninitialize')(); // return void
							console.log('did CoUnit');
						//}
					// }

				break;
			default:
				console.error('Your os is not yet supported, your OS is: ' + core.os.mname);
				throw new Error('Your os is not yet supported, your OS is: ' + core.os.mname);
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
