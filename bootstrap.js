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
		var win = Services.ww.openWindow(null, 'data:text/html,rawr<style>* { background-color: transparent }</style>', null, 'width=300,height=300', null);

		win.addEventListener('mousedown', function(e) {
			if (e.button !== 0) return; // drag can only be initated by primary mouse button

			const GDK_BUTTON_PRIMARY = 1; // im not sure about this, it might be specifically "LEFT" button, and not "Primary" as it is in javascript

			// https://dxr.mozilla.org/mozilla-central/source/widget/gtk/nsWindow.cpp#6638
			var gdkwinptr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(_getNativeHandlePtrStr(win)));
			var button = ostypes.TYPE.gint();
			var screenX = ostypes.TYPE.gint();
			var screenY = ostypes.TYPE.gint();

			var toplevel = ostypes.API('gdk_window_get_toplevel')(gdkwinptr);
			console.log('pointers same?', cutils.comparePointers(toplevel, gdkwinptr), cutils.jscEqual(toplevel, gdkwinptr), cutils.jscGetDeepest(toplevel), cutils.jscGetDeepest(gdkwinptr));

			var coordmouse = getMouseCoords()
			console.log('coordmouse:', coordmouse);
			var coordwin = getWindowCoords(gdkwinptr);
			console.log('coordwin:', coordwin);

			ostypes.API('gdk_window_begin_move_drag')(gdkwinptr, GDK_BUTTON_PRIMARY, coordmouse.x, coordmouse.y, ostypes.CONST.GDK_CURRENT_TIME);
		}, false);

	/*
	// for fun trying gtk callback method - couldnt get it to work, the connection happens, but for some reason its not trigger
	var gdkwinptr = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(_getNativeHandlePtrStr(win)));
	var gtkwinptr = ostypes.HELPER.gdkWinPtrToGtkWinPtr(gdkwinptr);
	var gtkwidgetptr = ctypes.cast(gtkwinptr, ostypes.TYPE.GtkWidget.ptr);

	// ostypes.API('gtk_widget_add_events')(gtkwidgetptr, ostypes.CONST.GDK_BUTTON_PRESS_MASK);

	// must keep the handler global until done
	OSStuff.handler = ostypes.TYPE.GtkWidget_button_press_callback(pressHandler);
	var connectionid = ostypes.API('g_signal_connect_object')(gtkwidgetptr, 'button-press-event', OSStuff.handler, null, 0);
	console.log('connectionid:', cutils.jscGetDeepest(connectionid));

	if (cutils.jscEqual(connectionid, 0)) {
		console.error('failed to connect button_press_event listener');
		throw new Error('failed to connect button_press_event listener')
	}
	*/

}

function pressHandler(widgetPtr, eventPtr, user_data) {
	// https://developer.gnome.org/gtk3/stable/GtkWidget.html#GtkWidget-button-press-event // gboolean user_function (GtkWidget *widget, GdkEvent *event, gpointer user_data)
	console.log('in handler');

	return false; //  TRUE to stop other handlers from being invoked for the event. FALSE to propagate the event further.
}

function getMouseCoords() {
	if (GTK_VERSION < 3) {
		// use GTK2 method
		var x = ostypes.TYPE.gint();
		var y = ostypes.TYPE.gint();

		var gdkwinptr_undermouse = ostypes.API('gdk_window_get_pointer')(ostypes.API('gdk_get_default_root_window')(), x.address(), y.address(), null);

		return {
			x: parseInt(cutils.jscGetDeepest(x)),
			y: parseInt(cutils.jscGetDeepest(y)),
		};
	} else {
		// use GTK3 method
		var dispptr = ostypes.API('gdk_display_get_default')();

		// get pointer_device_ptr
		var pointer_device_ptr;
		try {
			// try GTK3
			// will throw `Error: couldn't find function symbol in library  ostypes_x11.jsm:2981:11` if it is deprecated, meaning user is on GTK3.2 and not GTK3
			var devmgrptr = ostypes.API('gdk_display_get_device_manager')(dispptr);
			pointer_device_ptr = ostypes.API('gdk_device_manager_get_client_pointer')(devmgrptr);
		} catch(ex) {
			// this is future proofing, right now firefox doesnt use GTK3.2
			console.log('probably GTK3.2, ex:', ex);
			// use GTK3.2
			var seatmgr = ostypes.API('gdk_display_get_default_seat')(dispptr);
			pointer_device_ptr = ostypes.API('gdk_seat_get_pointer')(seatmgr);
		}

		var x = ostypes.TYPE.gint();
		var y = ostypes.TYPE.gint();
		ostypes.API('gdk_device_get_position')(pointer_device_ptr, null, x.address(), y.address());

		return {
			x: parseInt(cutils.jscGetDeepest(x)),
			y: parseInt(cutils.jscGetDeepest(y)),
		};
	}
}

function getWindowCoords(aGdkWinPtr) {
	// gdk_window_get_root_origin: Object { x: 65, y: 486 }  bootstrap.js:150
	// gdk_window_get_geometry: Object { x: 0, y: 0 }  bootstrap.js:156
	// gdk_window_get_position: Object { x: 65, y: 514 }

	var x = ostypes.TYPE.gint();
	var y = ostypes.TYPE.gint();

	ostypes.API('gdk_window_get_root_origin')(aGdkWinPtr,  x.address(), y.address());
	console.log('gdk_window_get_root_origin:', {
		x: parseInt(cutils.jscGetDeepest(x)),
		y: parseInt(cutils.jscGetDeepest(y)),
	});

	ostypes.API('gdk_window_get_geometry')(aGdkWinPtr, x.address(), y.address(), null, null);
	console.log('gdk_window_get_geometry:', {
		x: parseInt(cutils.jscGetDeepest(x)),
		y: parseInt(cutils.jscGetDeepest(y)),
	});

	ostypes.API('gdk_window_get_position')(aGdkWinPtr, x.address(), y.address());
	console.log('gdk_window_get_position:', {
		x: parseInt(cutils.jscGetDeepest(x)),
		y: parseInt(cutils.jscGetDeepest(y)),
	});

	return {
		x: parseInt(cutils.jscGetDeepest(x)),
		y: parseInt(cutils.jscGetDeepest(y)),
	};
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
function _getNativeHandlePtrStr(domWindow) {
  const baseWindow = domWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                      .getInterface(Ci.nsIWebNavigation)
                      .QueryInterface(Ci.nsIDocShellTreeItem)
                      .treeOwner
                      .QueryInterface(Ci.nsIInterfaceRequestor)
                      .getInterface(Ci.nsIBaseWindow);
  return baseWindow.nativeHandle;
}
// end - common helper functions
