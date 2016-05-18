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
function enumFormatsOnClipboard() {
	
	switch (core.os.mname) {
		case 'winnt':

				var rezOpened = ostypes.API('OpenClipboard')(null);
				console.log('rezOpened:', rezOpened, rezOpened.toString());
				if (!rezOpened) {
					console.error('Failed to open clipboard, error was:' + ctypes.winLastError);
					throw new Error('Failed to open clipboard, error was:' + ctypes.winLastError);
				}
				
				try {
					
					var cntClipboard = ostypes.API('CountClipboardFormats')();
					console.log('cntClipboard:', cntClipboard, cntClipboard.toString());
					cntClipboard = parseInt(cutils.jscGetDeepest(cntClipboard));
					
					if (cntClipboard > 0) {
						// list all formats currently on the clipboard:
						console.log('there are', cntClipboard, 'formats on the clipboard');
						
						var formats = [];
						var nextFormat = 0;
						while (true) {
							nextFormat = ostypes.API('EnumClipboardFormats')(nextFormat);
							console.log('nextFormat:', nextFormat, nextFormat.toString());
							nextFormat = parseInt(cutils.jscGetDeepest(nextFormat));
							
							if (nextFormat === 0) {
								// either an error happend, or there are no more formats
								if (ctypes.winLastError === ostypes.CONST.ERROR_SUCCESS) {
									// error did not happen, there are no more formats on the clipboard
								} else {
									// error happend
									console.error('An error happend while enumerating formats on clipboard, error was: ' + ctypes.winLastError);
									throw new Error('An error happend while enumerating formats on clipboard, error was: ' + ctypes.winLastError);
								}
								break;
							}
							
							formats.push(nextFormat);
						}
						
						console.log('The codes of the formats on clipboard are:', formats);
						
						// lets get strings of the formats - i can get this from calling GetUpdatedClipboardFormats  - https://msdn.microsoft.com/en-us/library/windows/desktop/ms649046(v=vs.85).aspx - but i just copied them from - https://msdn.microsoft.com/en-us/library/windows/desktop/ff729168(v=vs.85).aspx
						var stdFormats = {
							CF_TEXT: 1,
							CF_BITMAP: 2,
							CF_METAFILEPICT: 3,
							CF_SYLK: 4,
							CF_DIF: 5,
							CF_TIFF: 6,
							CF_OEMTEXT: 7,
							CF_DIB: 8,
							CF_PALETTE: 9,
							CF_PENDATA: 10,
							CF_RIFF: 11,
							CF_WAVE: 12,
							CF_UNICODETEXT: 13,
							CF_ENHMETAFILE: 14,
							CF_HDROP: 15,
							CF_LOCALE: 16,
							CF_DIBV5: 17,
							CF_OWNERDISPLAY: 128,
							CF_DSPTEXT: 129,
							CF_DSPBITMAP: 130,
							CF_DSPMETAFILEPICT: 131,
							CF_DSPENHMETAFILE: 142,
							CF_PRIVATEFIRST: 512,
							CF_PRIVATELAST: 767,
							CF_GDIOBJFIRST: 768,
							CF_GDIOBJLAST: 1023
						};
						var formatNames = {};
						var cchMaxCount = 256; // i dont know what to use for this, im just using 255, anyhting longer is truncated
						var lpszFormatName = ostypes.TYPE.LPTSTR.targetType.array(cchMaxCount)();
						var l = formats.length;
						for (var i=0; i<l; i++) {
							var format = formats[i];
							
							var isStdFormat = false;
							for (var p in stdFormats) {
								if (stdFormats[p] === format) {
									formatNames[format] = p;
									isStdFormat = true;
									break;
								}
							}
							
							if (isStdFormat) {
								continue;
							}
							
							// format MUST NOT be one of the standard formats, otherwise GetClipboardFormatName will result in error of 87 which is ERROR_INVALID_PARAMETER - the docs say "This parameter must not specify any of the predefined clipboard formats."
							var rezLength = ostypes.API('GetClipboardFormatName')(format, lpszFormatName, cchMaxCount); // will populate cFormatName buffer with null terminator. the return is the length NOT containing the null terminator // Thus if the returned length is one less than the size of your lpszFormatName (in characters) then it's possible the format name was truncated.
							console.log('rezLength:', rezLength, rezLength.toString());
							console.log('lpszFormatName.readString():', lpszFormatName.readString());
							
							rezLength = parseInt(cutils.jscGetDeepest(rezLength));
							if (rezLength === 0) {
								console.error('Error occured while trying to get name of format "' + format + '", it may be that this format is one of the standard formats but it was documented in the spot where I got it from, to be most accuration I should call GetUpdatedClipboardFormats to get all standard formats, the error was: ' + ctypes.winLastError);
								// throw new Error('Error occured while trying to get name of format "' + format + '", the error was: ' + ctypes.winLastError);
							} else {
								formatNames[format] = lpszFormatName.readString(); // because readString reads up till the nul term, and because GetClipboardFormatName populates lpszFormatName with null term, i dont need to do `.substr(0, rezLength)` even though I am reusing the buffer. as the buffer
							}
						}
					} else {
						console.log('there is nothing on the clipboard');
					}
					
					console.log('The names of the formats on clipboard are:', formatNames);
					
					
				} finally {
					var rezClosed = ostypes.API('CloseClipboard')();
					console.log('rezClosed:', rezClosed, rezClosed.toString());
					if (!rezClosed) {
						console.error('Failed to close clipboard, error was:' + ctypes.winLastError);
					}
				}
				
			break;
		case 'darwin':
		
				var NSPasteboard = ostypes.HELPER.class('NSPasteboard');
				var generalPasteboard = ostypes.API('objc_msgSend')(NSPasteboard, ostypes.HELPER.sel('generalPasteboard'));
				
				var arrTypes = ostypes.API('objc_msgSend')(generalPasteboard, ostypes.HELPER.sel('types'));
				
				var cnt = ostypes.API('objc_msgSend')(arrTypes, ostypes.HELPER.sel('count'));
				// console.log('cnt:', cnt);
				
				cnt = ctypes.cast(cnt, ostypes.TYPE.NSUInteger);
				// console.log('cnt:', cnt); // cnt: CData { value: UInt64 }
				
				cnt = parseInt(cutils.jscGetDeepest(cnt));
				console.log('cnt:', cnt);
			
				console.log('there are', cntClipboard, 'formats on the clipboard');
				if (cnt > 0) {
					var formatNames = [];
					for (var i=0; i<cnt; i++) {
						var el = ostypes.API('objc_msgSend')(arrTypes, ostypes.HELPER.sel('objectAtIndex:'), ostypes.TYPE.NSUInteger(i));
						console.log('el:', el, el.toString());
						
						// from docs i know its a NSString	
						var type = ostypes.HELPER.readNSString(el);
						formatNames.push(type);
					}
					
					console.log('The names of the formats on clipboard are:', formatNames);
				}
		
			break;
		default:
			console.error('Your os is not yet supported, your OS is: ' + core.os.mname);
			throw new Error('Your os is not yet supported, your OS is: ' + core.os.mname);
	}
	
}

function getFilesOnClipboard() {
	// returns platform paths to the files on the clipboard, or null if no files
	
	switch (core.os.mname) {
		case 'winnt':
			
				var rezOpened = ostypes.API('OpenClipboard')(null);
				console.log('rezOpened:', rezOpened, rezOpened.toString());
				if (!rezOpened) {
					console.error('Failed to open clipboard, error was:' + ctypes.winLastError);
					throw new Error('Failed to open clipboard, error was:' + ctypes.winLastError);
				}
				
				try {
					
					const CF_HDROP = 15;
					var rezClipData = ostypes.API('GetClipboardData')(CF_HDROP);
					if (rezClipData.isNull()) {
						// nothing on clipboard of tyep CF_HDROP
						return null;
					} else {
						const FILECOUNT = 0xFFFFFFFF;
						var rezNumFiles = ostypes.API('DragQueryFile')(rezClipData, FILECOUNT, null, 0);
						console.log('rezNumFiles:', rezNumFiles, rezNumFiles.toString());
						
						var filepaths = [];
						
						var l = parseInt(cutils.jscGetDeepest(rezNumFiles));
						var cch = 256;
						var lpszFile = ostypes.TYPE.LPTSTR.targetType.array(cch)();
						for (var i=0; i<l; i++) {
							var rezLength = ostypes.API('DragQueryFile')(rezClipData, i, lpszFile, cch);
							console.log('rezLength:', rezLength, rezLength.toString());
							console.log('lpszFile:', lpszFile.readString());
							filepaths.push(lpszFile.readString());
						}
						
						return filepaths;
					}
				} finally {
					var rezClosed = ostypes.API('CloseClipboard')();
					console.log('rezClosed:', rezClosed, rezClosed.toString());
					if (!rezClosed) {
						console.error('Failed to close clipboard, error was:' + ctypes.winLastError);
					}
				}
			
			break;
		case 'darwin':
			
				// NSFilenamesPboardType
				var NSPasteboard = ostypes.HELPER.class('NSPasteboard');
				var generalPasteboard = ostypes.API('objc_msgSend')(NSPasteboard, ostypes.HELPER.sel('generalPasteboard'));
				
				var myNSStrings = new ostypes.HELPER.nsstringColl();
				try {
					
					var arrFiles = ostypes.API('objc_msgSend')(generalPasteboard, ostypes.HELPER.sel('propertyListForType:'), myNSStrings.get('NSFilenamesPboardType'));
					var rezNumFiles = ostypes.API('objc_msgSend')(arrFiles, ostypes.HELPER.sel('count'));
					console.log('rezNumFiles:', rezNumFiles);
					
					rezNumFiles = ctypes.cast(rezNumFiles, ostypes.TYPE.NSUInteger);
					// console.log('rezNumFiles:', rezNumFiles); // rezNumFiles: CData { value: UInt64 }
					rezNumFiles = parseInt(cutils.jscGetDeepest(rezNumFiles));
					console.log('rezNumFiles:', rezNumFiles);
					
					if (rezNumFiles === 0) {
						return null;
					} else {
						console.log('there are ' + rezNumFiles + ' files on the clipboard');
					}
					
					var filepaths = [];
					
					var l = rezNumFiles;
					for (var i=0; i<l; i++) {
						var el = ostypes.API('objc_msgSend')(arrFiles, ostypes.HELPER.sel('objectAtIndex:'), ostypes.TYPE.NSUInteger(i));
						filepaths.push(ostypes.HELPER.readNSString(el));
					}
					
					return filepaths;
					
				} finally {
					myNSStrings.releaseAll();
				}
			break;
		default:
			console.error('Your os is not yet supported, your OS is: ' + core.os.mname);
			throw new Error('Your os is not yet supported, your OS is: ' + core.os.mname);
	}
}

function main() {
	var platformPathsOfFilesOnClipboard = getFilesOnClipboard();
	console.log('platformPathsOfFilesOnClipboard:', platformPathsOfFilesOnClipboard);
	// console.log('formats on clipboard:', enumFormatsOnClipboard());
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