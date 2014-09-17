
// A dictionary mapping script URLs to a dictionary mapping
// component key to component for all components that are waiting
// for the script to load.
var scriptObservers = {};

// A dictionary mapping script URL to a boolean value indicating if the script
// has already been loaded.
var loadedScripts = {};

// A dictionary mapping script URL to a boolean value indicating if the script
// has failed to load.
var erroredScripts = {};

// A counter used to generate a unique id for each component that uses
// ScriptLoaderMixin.
var idCount = 0;

var ReactScriptLoader = {
	componentDidMount: function(key, component, scriptURL) {
		if (typeof component.onScriptLoaded !== 'function') {
			throw new Error('ScriptLoader: Component class must implement onScriptLoaded()');
		}
		if (typeof component.onScriptError !== 'function') {
			throw new Error('ScriptLoader: Component class must implement onScriptError()');
		}
		if (loadedScripts[scriptURL]) {
			component.onScriptLoaded();
			return;
		}
		if (erroredScripts[scriptURL]) {
			component.onScriptError();
			return;
		}

		// If the script is loading, add the component to the script's observers
		// and return. Otherwise, initialize the script's observers with the component
		// and start loading the script.
		if (scriptObservers[scriptURL]) {
			scriptObservers[scriptURL][key] = component;
			return;
		}

		var observers = {};
		observers[key] = component;
		scriptObservers[scriptURL] = observers;

		var script = document.createElement('script');

		if (typeof component.onScriptTagCreated === 'function') {
			component.onScriptTagCreated(script);
		}

		script.src = scriptURL;

		var callObserverFuncAndRemoveObserver = function(func) {
			var observers = scriptObservers[scriptURL];
			for (var key in observers) {
				observer = observers[key];
				var removeObserver = func(observer);
				if (removeObserver) {
					delete scriptObservers[scriptURL][key];
				}
			}
			//delete scriptObservers[scriptURL];
		}
		script.onload = function() {
			loadedScripts[scriptURL] = true;
			callObserverFuncAndRemoveObserver(function(observer) {
				if (observer.deferOnScriptLoaded && observer.deferOnScriptLoaded()) {
					return false;
				}
				observer.onScriptLoaded();
				return true;
			});
		};
		script.onerror = function(event) {
			erroredScripts[scriptURL] = true;
			callObserverFuncAndRemoveObserver(function(observer) {
				observer.onScriptError();
				return true;
			});
		};
		document.body.appendChild(script);
	},
	componentWillUnmount: function(key, scriptURL) {
		// If the component is waiting for the script to load, remove the
		// component from the script's observers before unmounting the component.
		var observers = scriptObservers[scriptURL];
		if (observers) {
			delete observers[key];
		}
	},
	triggerOnScriptLoaded: function(scriptURL) {
		if (!loadedScripts[scriptURL]) {
			throw new Error('Error: only call this function after the script has in fact loaded.');
		}
		var observers = scriptObservers[scriptURL];
		for (var key in observers) {
			var observer = observers[key];
			observer.onScriptLoaded();
		}
		delete scriptObservers[scriptURL];
	}
};

var ReactScriptLoaderMixin = {
	componentDidMount: function() {
		if (typeof this.getScriptURL !== 'function') {
			throw new Error("ScriptLoaderMixin: Component class must implement getScriptURL().")
		}
		ReactScriptLoader.componentDidMount(this.__getScriptLoaderID(), this, this.getScriptURL());
	},
	componentWillUnmount: function() {
		ReactScriptLoader.componentWillUnmount(this.__getScriptLoaderID(), this.getScriptURL());
	},
	__getScriptLoaderID: function() {
		if (typeof this.__reactScriptLoaderID === 'undefined') {
			this.__reactScriptLoaderID = 'id' + idCount++;
		}

		return this.__reactScriptLoaderID;
	},
};

exports.ReactScriptLoaderMixin = ReactScriptLoaderMixin;
exports.ReactScriptLoader = ReactScriptLoader;
