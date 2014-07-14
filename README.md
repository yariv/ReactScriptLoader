#What is it?

ReactScriptLoader simplifies creating React components whose rendering depends on dynamically loaded scripts. It can be used for lazily loading heavy scripts but it's especially useful for loading components that rely on 3rd party scripts, such as Google Maps or Stripe Checkout.

#Why use it?

React apps are typically single-page apps that are rendered client-side in Javascript. When loading a site built with React, the browser typically pre-loads the javascript necessary to render the site's React components so that they can be rendered with no latency. This works well for sites that serve a relatively small amount of javascript from their own servers in a single bundle. However, in some situations pre-loading all the scripts necessary to render the site's components is impractial. For example, a site may have a Map component that relies on a dynamically loaded 3rd party library to render itself. It may be possible to delay rendering the app until the third party library is finished loading but doing so would make the site feel unnecessarily sluggish. It's a much better strategy to first render the page with a placeholder for the map and asynchronously render the map once the third party library has loaded. Deferring the loading of the external script is even more important when the map component isn't rendered right away but is only revealed after user interaction.

#How does it work?

ReactScriptLoader provides a [React mixin](http://facebook.github.io/react/docs/reusable-components.html#mixins) that you can add to any component class. In addition to using the mixin, your class should provide a few methods that tell ReactScriptLoaderMixin the script's URL and how to handle script load and error events. ReactScriptLoaderMixin handles loading the scripts, notifying the components that depend on a script after they mount and cleaning before the components unmount. ReactScriptLoader ensures that a script is only loaded once no matter how many components use it.

# Examples

## Basic Example

Here's the most basic example for implemnting a React class that uses ReactScriptLoaderMixin. It uses require-js to import modules.

```javascript
/** @jsx React.DOM */

var React = require('react');
var ReactScriptLoaderMixin = require('./ReactScriptLoaderMixin.js').ReactScriptLoaderMixin;

var Foo = React.createClass({
	mixins: [ReactScriptLoaderMixin],
	getInitialState: function() {
		return {
			scriptLoading: true,
			scriptLoadError: false,
		};
	},

	// this function tells ReactScriptLoaderMixin where to load the script from
	getScriptURL: function() {
		return 'http://d3js.org/d3.v3.min.js';
	},

	// ReactScriptLoaderMixin calls this function when the script has loaded
	// successfully.
	onScriptLoaded: function() {
		this.setState({scriptLoading: false});
	},

	// ReactScriptLoaderMixin calls this function when the script has failed to load.
	onScriptError: function() {
		this.setState({scriptLoading: false, scriptLoadError: true});
	},

	render: function() {
		var message;
		if (this.state.scriptLoading) {
			message = 'loading script...';
		} else if (this.state.scriptLoadError) {
			message = 'loading failed';
		} else {
			message = 'loading succeeded';
		}
		return <span>{message}</span>;
	}
});
```

## A Goole Maps component

You may want to do some additional initialization after the script loads and before ReactScriptLoaderMixin calls onScriptLoaded. For example, the Google maps API calls a JSONP callback on your page before you can start using the API. If you naively try calling the Google maps methods in onScriptLoaded you'll probably see 'undefined is not a function' errors in the javascript console. ReactScriptLoader helps you avoid this problem by implementing the ***deferOnScriptLoaded()*** callback in your component class. If this method returns true, ReactScriptLoaderMixin will wait on calling onScriptLoaded() until you manually call ***ReactScriptLoader.triggerOnScriptLoaded(scriptURL)*** method. This is best illustrated in the following example:

```javascript
/** @jsx React.DOM */

var React = require('react.js');

var ReactScriptLoaderModule = require('./ReactScriptLoader.js');
var ReactScriptLoaderMixin= ReactScriptLoaderModule.ReactScriptLoaderMixin;
var ReactScriptLoader= ReactScriptLoaderModule.ReactScriptLoader;

var scriptURL = 'https://maps.googleapis.com/maps/api/js?v=3.exp&callback=initializeMaps';

// This function is called by the Google maps API after its initialization is
// complete.
// We need to define this function in the window scope to make it accessible
// to the Google maps script.
window.initializeMaps = function() {

	// This triggers the onScriptLoaded method call on all mounted Map components.
	ReactScriptLoader.triggerOnScriptLoaded(scriptURL);
}

var Map = React.createClass({
	mixins: [ReactScriptLoaderMixin],
	getScriptURL: function() {
		return scriptURL;
	},
	
	// Ensure that onScriptLoaded is deferred until the
	// ReactScriptLoader.triggerOnScriptLoaded() call above is made in
	// initializeMaps().
	deferOnScriptLoaded: function() {
		return true;
	},

	onScriptLoaded: function() {
		// Render a map with the center point given by the component's lat and lng
		// properties.
		var center = new google.maps.LatLng(this.props.lat, this.props.lng);
	  	var mapOptions = {
		    zoom: 12,
		    center: center,
		    disableDefaultUI: true,
		    draggable: false,
		    zoomControl: false,
		    scrollwheel: false,
		    disableDoubleClickZoom: true,
		  };
  		var map = new google.maps.Map(this.getDOMNode(), mapOptions);
	},
	onScriptError: function() {
		// Show the user an error message.
	},
	render: function() {
		return <div className="mapCanvas"/>;
	},

});

exports.Map = Map;
```

## A Stripe Checkout example

This last example shows how to create a component called StripeButton that renders a button and uses Stripe Checkout to pop up a payment dialog when the user clicks on it. The button is rendered immediately but if the user clicks before the script is loaded the user sees a loading indicator, which disappears when the script has loaded. (Additional logic should be added to remove the loading dialog once all StripeButtons have been unmounted from the page. This remains an exercise for the reader :) ) If the script fails to load, we show the user an error message when the user clicks on the button.

```javascript
/** @jsx React.DOM */

var React = require('react');
var ReactScriptLoaderMixin = require('./ReactScriptLoader.js').ReactScriptLoaderMixin;

var StripeButton = React.createClass({
	mixins: [ReactScriptLoaderMixin],
	getScriptURL: function() {
		return 'https://checkout.stripe.com/checkout.js';
	},

	statics: {
		stripeHandler: null,
		scriptDidError: false,
	},

	// Indicates if the user has clicked on the button before the
	// the script has loaded.
	hasPendingClick: false,

	onScriptLoaded: function() {
		// Initialize the Stripe handler on the first onScriptLoaded call.
		// This handler is shared by all StripeButtons on the page.
		if (!StripeButton.stripeHandler) {
			StripeButton.stripeHandler = StripeCheckout.configure({
				key: 'YOUR_STRIPE_KEY',
  				image: '/YOUR_LOGO_IMAGE.png',
  				token: function(token) {
    					// Use the token to create the charge with a server-side script.
		  		}
		  	});
  			if (this.hasPendingClick) {
				this.showStripeDialog();
			}
		}
	},
	showLoadingDialog: function() {
		// show a loading dialog
	},
	hideLoadingDialog: function() {
		// hide the loading dialog
	},
	showStripeDialog: function() {
		this.hideLoadingDialog();
		StripeButton.stripeHandler.open({
      			name: 'Demo Site',
      			description: '2 widgets ($20.00)',
      			amount: 2000
    		});
	},
	onScriptError: function() {
		this.hideLoadingDialog();
		StripeButton.scriptDidError = true;
	},
	onClick: function() {
		if (StripeButton.scriptDidError) {
			console.log('failed to load script');
		} else if (StripeButton.stripeHandler) {
			this.showStripeDialog();
 		} else {
 			this.showLoadingDialog();
 			this.hasPendingClick = true;
 		}
	},
	render: function() {
		return (
			<button onClick={this.onClick}>Place order</button>
		);
	}
});

exports.StripeButton = StripeButton;
```
