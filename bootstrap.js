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

function listAudio_InputAndRenderers() {
  switch (core.os.mname) {
			case 'winnt':

					var VARIANT_BSTR = ctypes.StructType('tagVARIANT', [
						{ vt: ostypes.TYPE.VARTYPE },
                        { wReserved1: ostypes.TYPE.WORD },
                        { wReserved2: ostypes.TYPE.WORD },
                        { wReserved3: ostypes.TYPE.WORD },
                        { bstrVal: ostypes.TYPE.BSTR }
					]);

					var deviceEnumPtr;
					var deviceEnum;

					var CLSID_SystemDeviceEnum = ostypes.HELPER.CLSIDFromArr([0x62be5d10, 0x60eb, 0x11d0,[0xbd, 0x3b, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]]);
					var IID_ICreateDevEnum = ostypes.HELPER.CLSIDFromString('29840822-5B84-11D0-BD3B-00A0C911CE86');

					deviceEnumPtr = ostypes.TYPE.ICreateDevEnum.ptr();
					var hr_instDeviceNum = ostypes.API('CoCreateInstance')(CLSID_SystemDeviceEnum.address(), null, ostypes.CONST.CLSCTX_INPROC_SERVER, IID_ICreateDevEnum.address(), deviceEnumPtr.address());//Initialise Device enumerator
					ostypes.HELPER.checkHRESULT(hr_instDeviceNum, 'instantiate deviceEnum');
					deviceEnum = deviceEnumPtr.contents.lpVtbl.contents;

					// Enumerate the specified device, distinguished by DEVICE_CLSID such as CLSID_AudioInputDeviceCategory
					var CLSID_AudioInputDeviceCategory = ostypes.HELPER.CLSIDFromArr([0x33d9a762, 0x90c8, 0x11d0, [0xbd, 0x43, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]])
                    var CLSID_AudioRendererCategory = ostypes.HELPER.CLSIDFromArr([0xe0f158e1, 0xcb04, 0x11d0, [0xbd, 0x4e, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]]);


                    var IID_IPropertyBag = ostypes.HELPER.CLSIDFromString('55272A00-42CB-11CE-8135-00AA004BB851');
                    var fetched = ostypes.TYPE.ULONG();
                    var varName;
                    var devices = [];
                    var categories = [CLSID_AudioInputDeviceCategory, CLSID_AudioRendererCategory];
                    for (var i=0; i<categories.length; i++) {
                        var category = categories[i];
                        var enumCatPtr = ostypes.TYPE.IEnumMoniker.ptr();
        				var hr_enum = deviceEnum.CreateClassEnumerator(deviceEnumPtr, category.address(), enumCatPtr.address(), 0);
    					if (ostypes.HELPER.checkHR(hr_enum, 'hr_enum') === 1) {
    						var enumCat = enumCatPtr.contents.lpVtbl.contents;

                            while (true) {
                                var device_info = {};

    							// pickup as moniker
    							var devMonikPtr = ostypes.TYPE.IMoniker.ptr();
    							var devMonik = null;
    							var hr_next =  enumCat.Next(enumCatPtr, 1, devMonikPtr.address(), fetched.address());
    							console.log('hr_next:', hr_next.toString(), 'fetched:', cutils.jscGetDeepest(fetched));
    							if (ostypes.HELPER.checkHR(hr_next, 'hr_next') !== 1) {
    								// when fetched is 0, we get hr_next of `1` which is "did not succeed but did not fail", so checkHR returns -1
    								break;
    							}
    							devMonik = devMonikPtr.contents.lpVtbl.contents;

    							// bind the properties of the moniker
                                var propBagPtr = ostypes.TYPE.IPropertyBag.ptr();
    							var hr_bind = devMonik.BindToStorage(devMonikPtr, null, null, IID_IPropertyBag.address(), propBagPtr.address());
    							if (ostypes.HELPER.checkHR(hr_bind, 'hr_bind')) {
    								var propBag = propBagPtr.contents.lpVtbl.contents;

                                    // NEXT PROP
                                    if (!varName) {
                                        // Initialise the variant data type
                                        varName = ostypes.TYPE.VARIANT();
                                        ostypes.API('VariantInit')(varName.address());
                                    }

    								var hr_read = propBag.Read(propBagPtr, 'FriendlyName', varName.address(), null);
    								// console.log('varName:', varName, varName.toString(), uneval(varName));
    								varNameCast = ctypes.cast(varName.address(), VARIANT_BSTR.ptr).contents;
    								// console.log('varNameCast:', varNameCast, varNameCast.toString(), uneval(varNameCast));
    								if (ostypes.HELPER.checkHR(hr_read, 'hr_read')) {
    									// console.log('FriendlyName:', 'varNameCast.bstrVal:', varNameCast.bstrVal.readString());

                                        device_info.FriendlyName = varNameCast.bstrVal.readString();

                                        //clear the variant data type
    									ostypes.API('VariantClear')(varName.address());
    								}

                                    // NEXT PROP
    								var hr_read = propBag.Read(propBagPtr, 'CLSID', varName.address(), null);
    								varNameCast = ctypes.cast(varName.address(), VARIANT_BSTR.ptr).contents;
    								if (ostypes.HELPER.checkHR(hr_read, 'hr_read')) {
    									// console.log('CLSID:', 'varNameCast.bstrVal:', varNameCast.bstrVal.readString());

                                        device_info.CLSID = varNameCast.bstrVal.readString(); // is "{E30629D2-27E5-11CE-875D-00608CB78066}" without the quotes

    									//clear the variant data type
    									ostypes.API('VariantClear')(varName.address());
    								}

    								var releasePropBag = propBag.Release(propBagPtr); // release the properties
    								console.log('releasePropBag:', releasePropBag, releasePropBag.toString());
    							}

    							var releaseDevMonik = devMonik.Release(devMonikPtr); // release Device moniker
    							console.log('releaseDevMonik:', releaseDevMonik, releaseDevMonik.toString());

                                devices.push(device_info);
    						}

    						var releaseEnumCat = enumCat.Release(enumCatPtr); // release category enumerator
    						console.log('releaseEnumCat:', releaseEnumCat, releaseEnumCat.toString());
    					}
                    }
                    console.log('devices:', devices);

					if (!deviceEnumPtr.isNull()) {
						var releaseDeviceEnum = deviceEnum.Release(deviceEnumPtr);
						console.log('releaseDeviceEnum:', releaseDeviceEnum, releaseDeviceEnum.toString());
					} else {
						console.log('deviceEnumPtr is null', deviceEnumPtr, deviceEnumPtr.toString());
					}

				break;
			default:
				console.error('Your os is not yet supported, your OS is: ' + core.os.mname);
				throw new Error('Your os is not yet supported, your OS is: ' + core.os.mname);
	}
}

function connectInputToOutput() {
	switch (core.os.mname) {
		case 'winnt':
                var VARIANT_BSTR = ctypes.StructType('tagVARIANT', [
                    { vt: ostypes.TYPE.VARTYPE },
                    { wReserved1: ostypes.TYPE.WORD },
                    { wReserved2: ostypes.TYPE.WORD },
                    { wReserved3: ostypes.TYPE.WORD },
                    { bstrVal: ostypes.TYPE.BSTR }
                ]);

                function createInst(type, clsid_desc, iid_desc) {
                	// _desc is either string or arr
                	// context is always CLSCTX_INPROC_SERVER
                	var inst = ostypes.TYPE[type].ptr();
                	var iface;

                	var clsid = GUID_fromDesc(clsid_desc);
                	var iid = GUID_fromDesc(iid_desc);

                	var hr_create = ostypes.API('CoCreateInstance')(clsid.address(), null, ostypes.CONST.CLSCTX_INPROC_SERVER, iid.address(), inst.address());
                	if (ostypes.HELPER.checkHR(hr_create, 'creation - ' + type)) {
                		iface = inst.contents.lpVtbl.contents;
                		return { inst, iface };
                	} else {
                		return {};
                	}
                }

                var ptrsReleased = [];
                function releaseInst(inst, str) {
                    if (inst && !inst.isNull()) {
                        var inststr = inst.toString();
                        ptrsReleased.push(inststr);
                        if (ptrsReleased.indexOf(inststr) == -1) {
                            var ref_cnt = inst.contents.lpVtbl.contents.Release(inst);
                            console.log(str + '->Release:', ref_cnt);
                        } else {
                            console.log('already released', str, 'so will not release it again, inststr:', inststr);
                        }
                    }
                }

                function GUID_fromDesc(aGuidDesc) {
                    return typeof(aGuidDesc) == 'string' ? ostypes.HELPER.CLSIDFromString(aGuidDesc) : ostypes.HELPER.CLSIDFromArr(aGuidDesc);
                }
                // constants
                var guid_desc = { // descriptions of guids, as either string or array that goes into ostypes.HELPER.CLISDFromArr or CLSIDFromString
                    CLSID_SystemDeviceEnum: [0x62be5d10, 0x60eb, 0x11d0, [0xbd, 0x3b, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]],
                    IID_ICreateDevEnum: '29840822-5B84-11D0-BD3B-00A0C911CE86',
                    CLSID_FilterGraph: [0xe436ebb3, 0x524f, 0x11ce, [0x9f, 0x53, 0x00, 0x20, 0xaf, 0x0b, 0xa7, 0x70]],
                    IID_IGraphBuilder: [0x56a868a9, 0x0ad4, 0x11ce, [0xb0, 0x3a, 0x00, 0x20, 0xaf, 0x0b, 0xa7, 0x70]],
                    CLSID_SystemDeviceEnum: [0x62BE5D10, 0x60EB, 0x11d0, [0xBD, 0x3B, 0x00, 0xA0, 0xC9, 0x11, 0xCE, 0x86]],
                    IID_ICreateDevEnum: [0x29840822, 0x5b84, 0x11d0, [0xbd, 0x3b, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]],
                    CLSID_AudioInputDeviceCategory: [0x33d9a762, 0x90c8, 0x11d0, [0xbd, 0x43, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]],
                    CLSID_AudioRendererCategory: [0xe0f158e1, 0xcb04, 0x11d0, [0xbd, 0x4e, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]],
                    IID_IPropertyBag: '55272A00-42CB-11CE-8135-00AA004BB851',
                    IID_IBaseFilter: [0x56a86895, 0x0ad4, 0x11ce, [0xb0, 0x3a, 0x00, 0x20, 0xaf, 0x0b, 0xa7, 0x70]]
                };
                var IID_IMediaControl = ostypes.HELPER.CLSIDFromArr([0x56a868b1, 0x0ad4, 0x11ce, [0xb0, 0x3a, 0x00, 0x20, 0xaf, 0x0b, 0xa7, 0x70]]);
                const BREAK = {};

                try {
                    var {iface:graph, inst:graphPtr} = createInst('IGraphBuilder', guid_desc.CLSID_FilterGraph, guid_desc.IID_IGraphBuilder);
                    var {iface:deviceEnum, inst:deviceEnumPtr} = createInst('ICreateDevEnum', guid_desc.CLSID_SystemDeviceEnum, guid_desc.IID_ICreateDevEnum);

                    if (graph && deviceEnum) { // no need for !.isNull() test as if hr was FAILED then createInst would set these to undefined
                        var controlPtr = ostypes.TYPE.IMediaControl.ptr();
                        var hr_qi = graph.QueryInterface(graphPtr, IID_IMediaControl.address(), controlPtr.address());
                        if (ostypes.HELPER.checkHR(hr_qi, 'hr_qi') === 1) { // no need -  && !controlPtr.isNull() as hr was SUCCEEDED
                            var control = controlPtr.contents.lpVtbl.contents;

                            // get list input/output devices
                            var devices = []; // entries are objects {FriendlyName:string, CLSID:string, put:string, devMonk:cdata, devMonikPtr:cdata} // put is INPUT or OUTPUT

                            var categories = [GUID_fromDesc(guid_desc.CLSID_AudioInputDeviceCategory), GUID_fromDesc(guid_desc.CLSID_AudioRendererCategory)];
                            var varName;
                            var IID_IPropertyBag = GUID_fromDesc(guid_desc.IID_IPropertyBag);
                            for (var i=0; i<categories.length; i++) {
                                var category = categories[i];
                                var put = i === 0 ? 'INPUT' : 'OUTPUT';
                                var catEnumPtr = ostypes.TYPE.IEnumMoniker.ptr();
                				var hr_enum = deviceEnum.CreateClassEnumerator(deviceEnumPtr, category.address(), catEnumPtr.address(), 0);
            					if (ostypes.HELPER.checkHR(hr_enum, 'hr_enum') === 1) {
            						var catEnum = catEnumPtr.contents.lpVtbl.contents;

                                    while (true) {
                                        var device_info = {};

            							// pickup as moniker
            							var devMonikPtr = ostypes.TYPE.IMoniker.ptr();
            							var devMonik = null;
            							var hr_nextDev = catEnum.Next(catEnumPtr, 1, devMonikPtr.address(), null);
            							if (ostypes.HELPER.checkHR(hr_nextDev, 'hr_nextDev') !== 1) {
            								// when fetched is 0, we get hr_nextDev of `1` which is "did not succeed but did not fail", so checkHR returns -1
                                            console.log('no more devices in this category, breaking');
            								break;
            							}
            							devMonik = devMonikPtr.contents.lpVtbl.contents;

            							// bind the properties of the moniker
                                        var propBagPtr = ostypes.TYPE.IPropertyBag.ptr();
            							var hr_bind = devMonik.BindToStorage(devMonikPtr, null, null, IID_IPropertyBag.address(), propBagPtr.address());
            							if (ostypes.HELPER.checkHR(hr_bind, 'hr_bind')) {
            								var propBag = propBagPtr.contents.lpVtbl.contents;

                                            if (!varName) {
                                                // Initialise the variant data type
                                                varName = ostypes.TYPE.VARIANT();
                                                ostypes.API('VariantInit')(varName.address());
                                            }

                                            // get FriendlyName
            								var hr_read = propBag.Read(propBagPtr, 'FriendlyName', varName.address(), null);
            								if (ostypes.HELPER.checkHR(hr_read, 'hr_read')) {
                                                varNameCast = ctypes.cast(varName.address(), VARIANT_BSTR.ptr).contents;
            									// console.log('FriendlyName:', 'varNameCast.bstrVal:', varNameCast.bstrVal.readString());
                                                device_info.FriendlyName = varNameCast.bstrVal.readString();
            									ostypes.API('VariantClear')(varName.address());
            								}

                                            // get CLSID
            								var hr_read = propBag.Read(propBagPtr, 'CLSID', varName.address(), null);
            								if (ostypes.HELPER.checkHR(hr_read, 'hr_read')) {
                                                varNameCast = ctypes.cast(varName.address(), VARIANT_BSTR.ptr).contents;
            									// console.log('CLSID:', 'varNameCast.bstrVal:', varNameCast.bstrVal.readString());
                                                device_info.CLSID = varNameCast.bstrVal.readString(); // is "{E30629D2-27E5-11CE-875D-00608CB78066}" without the quotes
            									ostypes.API('VariantClear')(varName.address());
            								}

            								releaseInst(propBagPtr, 'propBag');
            							}

                                        Object.assign(device_info, { devMonik, devMonikPtr, put });
                                        releaseInst(devMonikPtr, 'devMonik'); // dont release yet, this will be done after user has picked link33

                                        devices.push(device_info);
            						}

            						releaseInst(catEnumPtr, 'catEnum');
            					}
                            }

                            releaseInst(deviceEnumPtr, 'deviceEnum');

                            // used in both the prompt sections
                            var IID_IBaseFilter = GUID_fromDesc(guid_desc.IID_IBaseFilter);

                            // prompt user to pick input device or quit
                            var items = devices.filter(function(device) { return device.put == 'INPUT' });
                            items = items.map(function(item) { return '"' + item.FriendlyName + '" ------- ' + item.CLSID });
                            var selected = {};
                            var result = Services.prompt.select(Services.wm.getMostRecentWindow('navigator:browser'), 'Select Device', 'Choose input device:', items.length, items, selected);

                            if (!result || selected.value == -1) {
                                // user cancelled, or there were no items to pick from
                                throw BREAK;
                            }

                            var clsid = items[selected.value].split(' ------- ')[1];
                            for (var device of devices) {
                                if (device.CLSID == clsid) {
                                    break;
                                }
                            }

                            // user picked something. set it as pInputDevice which is IBaseFilter
                            device.selected = true;
                            var inputDevPtr = ostypes.TYPE.IBaseFilter.ptr();
                            var hr_initDevice = device.devMonik.BindToObject(device.devMonikPtr, null, null, IID_IBaseFilter.address(), inputDevPtr.address()); // Instantiate the device
                            if (ostypes.HELPER.checkHR(hr_initDevice, 'hr_initDevice') !== 1) {
                                throw BREAK;
                            }
                            // also add it to the graph
                            var hr_add = graph.AddFilter(graphPtr, inputDevPtr, device.FriendlyName);
                            // TODO: GC question, i dont use inputDevPtr/inputDev anymore (i dont think, another todo here, verify this), can I release it and GC it?

                            // prompt user to pick output device or quit
                            var items = devices.filter(function(device) { return device.put == 'OUTPUT' });
                            items = items.map(function(item) { return '"' + item.FriendlyName + '" ------- ' + item.CLSID });
                            var selected = {};
                            var result = Services.prompt.select(Services.wm.getMostRecentWindow('navigator:browser'), 'Select Device', 'Choose input device:', items.length, items, selected);

                            if (!result || selected.value == -1) {
                                // user cancelled, or there were no items to pick from
                                throw BREAK;
                            }

                            var clsid = items[selected.value].split(' ------- ')[1];
                            for (var device of devices) {
                                if (device.CLSID == clsid) {
                                    break;
                                }
                            }

                            // user picked something. set it as pOutputDevice which is IBaseFilter
                            device.selected = true;
                            var outputDevPtr = ostypes.TYPE.IBaseFilter.ptr();
                            var hr_initDevice = device.devMonik.BindToObject(device.devMonikPtr, null, null, IID_IBaseFilter.address(), outputDevPtr.address()); // Instantiate the device
                            if (ostypes.HELPER.checkHR(hr_initDevice, 'hr_initDevice') !== 1) {
                                throw BREAK;
                            }
                            // also add it to the graph
                            var hr_add = graph.AddFilter(graphPtr, outputDevPtr, device.FriendlyName);
                            // TODO: GC question, i dont use outputDevPtr/outputDev anymore (i dont think, another todo here, verify this), can I release it and GC it?

                            // release the entries from devices that were not selected, so delete devMonik and devMonikPtr from the entry afterwards, leave the name and clsid though for display puproses // link33
                            // TODO: figure out if i can release the devMonik/devMonikPtr of the seelcted devices. I dont use the monik anymore, i use the IBaseFilter inputDev/inputDevPtr and outputDev/outputDevPtr - my concern is these inputDev/outputDev is based on the devMonik of it, GC question, will figure out as i use it and research online, can force test it by releasing it and see if crash happens
                            for (var i=0; i<devices.length; i++) {
                                var { selected, devMonikPtr } = devices[i];
                                if (!selected) {
                                    releaseInst(devMonikPtr);
                                }
                            }

                            // get input pins for connection
                            var inputPinsPtr = ostypes.TYPE.IEnumPins.ptr();
                            var hr_enumPins = inputDev.EnumPins(inputDevPtr, inputPinsPtr); // Enumerate the pin
                            if (ostypes.HELPER.checkHR(hr_enumPins, 'hr_enumPins input') !== 1) {
                                throw BREAK;
                            }

                            var inPinPtr = ostypes.TYPE.IPin.ptr()
                            var hr_findPin = inputDev.FindPin(inputDevPtr, 'Capture', inPinPtr); // Enumerate the pin
                            if (ostypes.HELPER.checkHR(hr_findPin, 'hr_findPin input') !== 1) {
                                throw BREAK;
                            }

                            // get output pins for connection
                            var outputPinsPtr = ostypes.TYPE.IEnumPins.ptr();
                            var hr_enumPins = outputDev.EnumPins(outputDevPtr, outputPinsPtr); // Enumerate the pin
                            if (ostypes.HELPER.checkHR(hr_enumPins, 'hr_enumPins output') !== 1) {
                                throw BREAK;
                            }

                            var outPinPtr = ostypes.TYPE.IPin.ptr()
                            var hr_findPin = outputDev.FindPin(outputDevPtr, 'Capture', outPinPtr); // Enumerate the pin
                            if (ostypes.HELPER.checkHR(hr_findPin, 'hr_findPin output') !== 1) {
                                throw BREAK;
                            }

                            // connect them
                            var hr_connect = pIn.Connect(pInPtr, pOut, null);
                            if (ostypes.HELPER.checkHR(hr_connect, 'hr_connect') !== 1) {
                                throw BREAK;
                            }

                            // now run the graph
                            var hr_run = control.Run(controlPtr);
                            if (ostypes.HELPER.checkHR(hr_run, 'hr_run') !== 1) {
                                throw BREAK;
                            }
                        }
                    }
                } catch (ex if ex != BREAK) {
                    console.error('ERROR :: ', ex);
                } finally {
                    // if graph is running, then will not do clean up till after 10 seconds, otherwise it will clean up in 10ms
                    var isRunning = (ostypes.HELPER.checkHR(hr_run) === 1);
                    xpcomSetTimeout(undefined, isRunning ? 10000 : 10, function() {
                        if (isRunning) {
                            // means graph is running, so stop it
                            var hr_stop = control.Stop(controlPtr);
                            ostypes.HELPER.checkHR(hr_stop, 'hr_stop');
                        }
                        // if connected should we disconnect?
                        if (ostypes.HELPER.checkHR(hr_run) === 1) {
                            // TODO: its connected, should i disconnect? for now i do disconnect them
                            // TODO: figure out how to use graph.Disconnect
                            // msdn docs say dont do it this way --> // var hr_disconnect = pIn.Disconnect(pInPtr, pOut, null); // The Filter Graph Manager calls this method when it disconnects two filters. Applications and filters should not call this method. Instead, call the IFilterGraph::Disconnect method on the Filter Graph Manager.
                            var hr_disconnect = graph.Disconnect(graphPtr, inPinPtr);
                            ostypes.HELPER.checkHR(hr_disconnect, 'hr_disconnect input');
                            var hr_disconnect = graph.Disconnect(graphPtr, outPinPtr);
                            ostypes.HELPER.checkHR(hr_disconnect, 'hr_disconnect output');
                        }
                        if (devices) {
                            for (var i=0; i<devices.length; i++) {
                                var { devMonkPtr } = devices[i];
                                releaseInst(devMonikPtr); // if devMonikPtr is undefined, this will do nothing
                            }
                        }
                        releaseInst(inputDevPtr, 'inputDev');
                        releaseInst(outputDevPtr, 'outputDev');
                        releaseInst(controlPtr, 'control');
                        releaseInst(graphPtr, 'graph');
                        try { releaseInst(deviceEnumPtr, 'deviceEnum'); } catch(ignore) { console.warn('error releasing deviceEnumPtr:', ignore); }
                        try { releaseInst(filePtr, 'file'); } catch(ignore) { console.warn('error releasing filePtr:', ignore); }
                        try { releaseInst(catEnumPtr, 'catEnum'); } catch(ignore) { console.warn('error releasing catEnumPtr:', ignore); }

                        // not sure when to release these, it seems this guy never did:
                        try { releaseInst(inputPinsPtr, 'inputPins'); } catch(ignore) { console.warn('error releasing inputPinsPtr:', ignore); }
                        try { releaseInst(inPinPtr, 'inPin'); } catch(ignore) { console.warn('error releasing inPinPtr:', ignore); }
                        try { releaseInst(outputPinsPtr, 'outputPins'); } catch(ignore) { console.warn('error releasing outputPinsPtr:', ignore); }
                        try { releaseInst(outPinPtr, 'outPin'); } catch(ignore) { console.warn('error releasing outPinPtr:', ignore); }
                    });
                }
            break;
        default:
            console.error('Your os is not yet supported, your OS is: ' + core.os.mname);
            throw new Error('Your os is not yet supported, your OS is: ' + core.os.mname);
        }
}

function main() {
    connectInputToOutput();
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
