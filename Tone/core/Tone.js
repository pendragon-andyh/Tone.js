/**
 *  Tone.js
 *  @author Yotam Mann
 *  @license http://opensource.org/licenses/MIT MIT License
 *  @copyright 2014-2017 Yotam Mann
 */
define(function(){

	"use strict";

	///////////////////////////////////////////////////////////////////////////
	//	TONE
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  @class  Tone is the base class of all other classes.
	 *  @constructor
	 *  @param {Tone.Context} context The audio context
	 */
	var Tone = function(){
		// this._context = Tone.defaultArg(context, Tone.context);
	};

	/**
	 *  @returns {string} returns the name of the class as a string
	 */
	Tone.prototype.toString = function(){
		for (var className in Tone){
			var isLetter = className[0].match(/^[A-Z]$/);
			var sameConstructor =  Tone[className] === this.constructor;
			if (Tone.isFunction(Tone[className]) && isLetter && sameConstructor){
				return className;
			}
		}
		return "Tone";
	};

	/**
	 *  disconnect and dispose
	 *  @returns {Tone} this
	 */
	Tone.prototype.dispose = function(){
		if (!Tone.isUndef(this.input)){
			if (this.input instanceof AudioNode){
				this.input.disconnect();
			} 
			this.input = null;
		}
		if (!Tone.isUndef(this.output)){
			if (this.output instanceof AudioNode){
				this.output.disconnect();
			} 
			this.output = null;
		}
		return this;
	};

	///////////////////////////////////////////////////////////////////////////
	//	GET/SET
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  Set the parameters at once. Either pass in an
	 *  object mapping parameters to values, or to set a
	 *  single parameter, by passing in a string and value.
	 *  The last argument is an optional ramp time which 
	 *  will ramp any signal values to their destination value
	 *  over the duration of the rampTime.
	 *  @param {Object|string} params
	 *  @param {number=} value
	 *  @param {Time=} rampTime
	 *  @returns {Tone} this
	 *  @example
	 * //set values using an object
	 * filter.set({
	 * 	"frequency" : 300,
	 * 	"type" : highpass
	 * });
	 *  @example
	 * filter.set("type", "highpass");
	 *  @example
	 * //ramp to the value 220 over 3 seconds. 
	 * oscillator.set({
	 * 	"frequency" : 220
	 * }, 3);
	 */
	Tone.prototype.set = function(params, value, rampTime){
		if (Tone.isObject(params)){
			rampTime = value;
		} else if (Tone.isString(params)){
			var tmpObj = {};
			tmpObj[params] = value;
			params = tmpObj;
		}

		paramLoop:
		for (var attr in params){
			value = params[attr];
			var parent = this;
			if (attr.indexOf(".") !== -1){
				var attrSplit = attr.split(".");
				for (var i = 0; i < attrSplit.length - 1; i++){
					parent = parent[attrSplit[i]];
					if (parent instanceof Tone) {
						attrSplit.splice(0,i+1);
						var innerParam = attrSplit.join(".");
						parent.set(innerParam, value);
						continue paramLoop;
					}
				}
				attr = attrSplit[attrSplit.length - 1];
			}
			var param = parent[attr];
			if (Tone.isUndef(param)){
				continue;
			}
			if ((Tone.Signal && param instanceof Tone.Signal) || 
					(Tone.Param && param instanceof Tone.Param)){
				if (param.value !== value){
					if (Tone.isUndef(rampTime)){
						param.value = value;
					} else {
						param.rampTo(value, rampTime);
					}
				}
			} else if (param instanceof AudioParam){
				if (param.value !== value){
					param.value = value;
				}				
			} else if (param instanceof Tone){
				param.set(value);
			} else if (param !== value){
				parent[attr] = value;
			}
		}
		return this;
	};

	/**
	 *  Get the object's attributes. Given no arguments get
	 *  will return all available object properties and their corresponding
	 *  values. Pass in a single attribute to retrieve or an array
	 *  of attributes. The attribute strings can also include a "."
	 *  to access deeper properties.
	 *  @example
	 * osc.get();
	 * //returns {"type" : "sine", "frequency" : 440, ...etc}
	 *  @example
	 * osc.get("type");
	 * //returns { "type" : "sine"}
	 * @example
	 * //use dot notation to access deep properties
	 * synth.get(["envelope.attack", "envelope.release"]);
	 * //returns {"envelope" : {"attack" : 0.2, "release" : 0.4}}
	 *  @param {Array=|string|undefined} params the parameters to get, otherwise will return 
	 *  					                  all available.
	 *  @returns {Object}
	 */
	Tone.prototype.get = function(params){
		if (Tone.isUndef(params)){
			params = this._collectDefaults(this.constructor);
		} else if (Tone.isString(params)){
			params = [params];
		} 
		var ret = {};
		for (var i = 0; i < params.length; i++){
			var attr = params[i];
			var parent = this;
			var subRet = ret;
			if (attr.indexOf(".") !== -1){
				var attrSplit = attr.split(".");
				for (var j = 0; j < attrSplit.length - 1; j++){
					var subAttr = attrSplit[j];
					subRet[subAttr] = subRet[subAttr] || {};
					subRet = subRet[subAttr];
					parent = parent[subAttr];
				}
				attr = attrSplit[attrSplit.length - 1];
			}
			var param = parent[attr];
			if (Tone.isObject(params[attr])){
				subRet[attr] = param.get();
			} else if (Tone.Signal && param instanceof Tone.Signal){
				subRet[attr] = param.value;
			} else if (Tone.Param && param instanceof Tone.Param){
				subRet[attr] = param.value;
			} else if (param instanceof AudioParam){
				subRet[attr] = param.value;
			} else if (param instanceof Tone){
				subRet[attr] = param.get();
			} else if (!Tone.isFunction(param) && !Tone.isUndef(param)){
				subRet[attr] = param;
			} 
		}
		return ret;
	};

	/**
	 *  collect all of the default attributes in one
	 *  @private
	 *  @param {function} constr the constructor to find the defaults from
	 *  @return {Array} all of the attributes which belong to the class
	 */
	Tone.prototype._collectDefaults = function(constr){
		var ret = [];
		if (!Tone.isUndef(constr.defaults)){
			ret = Object.keys(constr.defaults);
		}
		if (!Tone.isUndef(constr._super)){
			var superDefs = this._collectDefaults(constr._super);
			//filter out repeats
			for (var i = 0; i < superDefs.length; i++){
				if (ret.indexOf(superDefs[i]) === -1){
					ret.push(superDefs[i]);
				}
			}
		}
		return ret;
	};

	///////////////////////////////////////////////////////////////////////////
	//	DEFAULTS
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  @param  {Array}  values  The arguments array
	 *  @param  {Array}  keys    The names of the arguments
	 *  @param {Function} constr The class constructor
	 *  @return  {Object}  An object composed of the  defaults between the class' defaults
	 *                        and the passed in arguments.
	 */
	Tone.defaults = function(values, keys, constr){
		var options = {};
		if (values.length === 1 && Tone.isObject(values[0])){
			options = values[0];
		} else {
			for (var i = 0; i < keys.length; i++){
				options[keys[i]] = values[i];
			}
		}
		if (!Tone.isUndef(constr.defaults)){
			return Tone.defaultArg(options, constr.defaults);
		} else {
			return options;
		}
	};

	/**
	 *  If the `given` parameter is undefined, use the `fallback`. 
	 *  If both `given` and `fallback` are object literals, it will
	 *  return a deep copy which includes all of the parameters from both 
	 *  objects. If a parameter is undefined in given, it will return
	 *  the fallback property. 
	 *  <br><br>
	 *  WARNING: if object is self referential, it will go into an an 
	 *  infinite recursive loop.
	 *  
	 *  @param  {*} given    
	 *  @param  {*} fallback 
	 *  @return {*}          
	 */
	Tone.defaultArg = function(given, fallback){
		if (Tone.isObject(given) && Tone.isObject(fallback)){
			var ret = {};
			//make a deep copy of the given object
			for (var givenProp in given) {
				ret[givenProp] = Tone.defaultArg(fallback[givenProp], given[givenProp]);
			}
			for (var fallbackProp in fallback) {
				ret[fallbackProp] = Tone.defaultArg(given[fallbackProp], fallback[fallbackProp]);
			}
			return ret;
		} else {
			return Tone.isUndef(given) ? fallback : given;
		}
	};

	///////////////////////////////////////////////////////////////////////////
	//	CONNECTIONS
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  connect the output of a ToneNode to an AudioParam, AudioNode, or ToneNode
	 *  @param  {Tone | AudioParam | AudioNode} unit 
	 *  @param {number} [outputNum=0] optionally which output to connect from
	 *  @param {number} [inputNum=0] optionally which input to connect to
	 *  @returns {Tone} this
	 */
	Tone.prototype.connect = function(unit, outputNum, inputNum){
		if (Tone.isArray(this.output)){
			outputNum = Tone.defaultArg(outputNum, 0);
			this.output[outputNum].connect(unit, 0, inputNum);
		} else {
			this.output.connect(unit, outputNum, inputNum);
		}
		return this;
	};

	/**
	 *  disconnect the output
	 *  @param {Number|AudioNode} output Either the output index to disconnect
	 *                                   if the output is an array, or the
	 *                                   node to disconnect from.
	 *  @returns {Tone} this
	 */
	Tone.prototype.disconnect = function(destination, outputNum, inputNum){
		if (Tone.isArray(this.output)){
			if (Tone.isNumber(destination)){
				this.output[destination].disconnect();
			} else {
				outputNum = Tone.defaultArg(outputNum, 0);
				this.output[outputNum].disconnect(destination, 0, inputNum);
			}
		} else {
			this.output.disconnect.apply(this.output, arguments);
		}
	};

	/**
	 *  Connect the output of this node to the rest of the nodes in series.
	 *  @example
	 *  //connect a node to an effect, panVol and then to the master output
	 *  node.chain(effect, panVol, Tone.Master);
	 *  @param {...AudioParam|Tone|AudioNode} nodes
	 *  @returns {Tone} this
	 */
	Tone.prototype.chain = function(){
		var currentUnit = this;
		for (var i = 0; i < arguments.length; i++){
			var toUnit = arguments[i];
			currentUnit.connect(toUnit);
			currentUnit = toUnit;
		}
		return this;
	};

	/**
	 *  connect the output of this node to the rest of the nodes in parallel.
	 *  @param {...AudioParam|Tone|AudioNode} nodes
	 *  @returns {Tone} this
	 */
	Tone.prototype.fan = function(){
		for (var i = 0; i < arguments.length; i++){
			this.connect(arguments[i]);
		}
		return this;
	};

	/**
	 *  connect together all of the arguments in series
	 *  @param {...AudioParam|Tone|AudioNode} nodes
	 *  @returns {Tone}
	 *  @static
	 */
	Tone.connectSeries = function(){
		var currentUnit = arguments[0];
		for (var i = 1; i < arguments.length; i++){
			var toUnit = arguments[i];
			currentUnit.connect(toUnit);
			currentUnit = toUnit;
		}
		return Tone;
	};

	//give native nodes chain and fan methods
	AudioNode.prototype.chain = Tone.prototype.chain;
	AudioNode.prototype.fan = Tone.prototype.fan;


	///////////////////////////////////////////////////////////////////////////
	// TYPE CHECKING
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  test if the arg is undefined
	 *  @param {*} arg the argument to test
	 *  @returns {boolean} true if the arg is undefined
	 *  @static
	 */
	Tone.isUndef = function(val){
		return typeof val === "undefined";
	};

	/**
	 *  test if the arg is a function
	 *  @param {*} arg the argument to test
	 *  @returns {boolean} true if the arg is a function
	 *  @static
	 */
	Tone.isFunction = function(val){
		return typeof val === "function";
	};

	/**
	 *  Test if the argument is a number.
	 *  @param {*} arg the argument to test
	 *  @returns {boolean} true if the arg is a number
	 *  @static
	 */
	Tone.isNumber = function(arg){
		return (typeof arg === "number");
	};

	/**
	 *  Test if the given argument is an object literal (i.e. `{}`);
	 *  @param {*} arg the argument to test
	 *  @returns {boolean} true if the arg is an object literal.
	 *  @static
	 */
	Tone.isObject = function(arg){
		return (Object.prototype.toString.call(arg) === "[object Object]" && arg.constructor === Object);
	};

	/**
	 *  Test if the argument is a boolean.
	 *  @param {*} arg the argument to test
	 *  @returns {boolean} true if the arg is a boolean
	 *  @static
	 */
	Tone.isBoolean = function(arg){
		return (typeof arg === "boolean");
	};

	/**
	 *  Test if the argument is an Array
	 *  @param {*} arg the argument to test
	 *  @returns {boolean} true if the arg is an array
	 *  @static
	 */
	Tone.isArray = function(arg){
		return (Array.isArray(arg));
	};

	/**
	 *  Test if the argument is a string.
	 *  @param {*} arg the argument to test
	 *  @returns {boolean} true if the arg is a string
	 *  @static
	 */
	Tone.isString = function(arg){
		return (typeof arg === "string");
	};

	/**
	 *  Test if the argument is in the form of a note in scientific pitch notation.
	 *  e.g. "C4"
	 *  @param {*} arg the argument to test
	 *  @returns {boolean} true if the arg is a string
	 *  @static
	 */
	Tone.isNote = function(arg){
		return Tone.isString(arg) && /^([a-g]{1}(?:b|#|x|bb)?)(-?[0-9]+)/i.test(arg);
	};

 	/**
	 *  An empty function.
	 *  @static
	 */
	Tone.noOp = function(){};

	/**
	 *  Make the property not writable. Internal use only. 
	 *  @private
	 *  @param  {string}  property  the property to make not writable
	 */
	Tone.prototype._readOnly = function(property){
		if (Array.isArray(property)){
			for (var i = 0; i < property.length; i++){
				this._readOnly(property[i]);
			}
		} else {
			Object.defineProperty(this, property, { 
				writable: false,
				enumerable : true,
			});
		}
	};

	/**
	 *  Make an attribute writeable. Interal use only. 
	 *  @private
	 *  @param  {string}  property  the property to make writable
	 */
	Tone.prototype._writable = function(property){
		if (Array.isArray(property)){
			for (var i = 0; i < property.length; i++){
				this._writable(property[i]);
			}
		} else {
			Object.defineProperty(this, property, { 
				writable: true,
			});
		}
	};

	/**
	 * Possible play states. 
	 * @enum {string}
	 */
	Tone.State = {
		Started : "started",
		Stopped : "stopped",
		Paused : "paused",
 	};

	///////////////////////////////////////////////////////////////////////////
	// CONVERSIONS
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  Equal power gain scale. Good for cross-fading.
	 *  @param  {NormalRange} percent (0-1)
	 *  @return {Number}         output gain (0-1)
	 */
	Tone.equalPowerScale = function(percent){
		var piFactor = 0.5 * Math.PI;
		return Math.sin(percent * piFactor);
	};

	/**
	 *  Convert decibels into gain.
	 *  @param  {Decibels} db
	 *  @return {Number} 
	 *  @static  
	 */
	Tone.dbToGain = function(db) {
		return Math.pow(2, db / 6);
	};

	/**
	 *  Convert gain to decibels.
	 *  @param  {Number} gain (0-1)
	 *  @return {Decibels}   
	 *  @static
	 */
	Tone.gainToDb = function(gain) {
		return  20 * (Math.log(gain) / Math.LN10);
	};

	/**
	 *  Convert an interval (in semitones) to a frequency ratio.
	 *  @param  {Interval} interval the number of semitones above the base note
	 *  @return {number}          the frequency ratio
	 *  @example
	 * tone.intervalToFrequencyRatio(0); // 1
	 * tone.intervalToFrequencyRatio(12); // 2
	 * tone.intervalToFrequencyRatio(-12); // 0.5
	 */
	Tone.intervalToFrequencyRatio = function(interval){
		return Math.pow(2,(interval/12));
	};

	///////////////////////////////////////////////////////////////////////////
	//	TIMING
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  Return the current time of the AudioContext clock.
	 *  @return {Number} the currentTime from the AudioContext
	 */
	Tone.prototype.now = function(){
		return Tone.context.now();
	};

	/**
	 *  Return the current time of the AudioContext clock.
	 *  @return {Number} the currentTime from the AudioContext
	 *  @static
	 */
	Tone.now = function(){
		return Tone.context.now();
	};

	///////////////////////////////////////////////////////////////////////////
	//	INHERITANCE
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  have a child inherit all of Tone's (or a parent's) prototype
	 *  to inherit the parent's properties, make sure to call 
	 *  Parent.call(this) in the child's constructor
	 *
	 *  based on closure library's inherit function
	 *
	 *  @static
	 *  @param  {function} 	child  
	 *  @param  {function=} parent (optional) parent to inherit from
	 *                             if no parent is supplied, the child
	 *                             will inherit from Tone
	 */
	Tone.extend = function(child, parent){
		if (Tone.isUndef(parent)){
			parent = Tone;
		}
		function TempConstructor(){}
		TempConstructor.prototype = parent.prototype;
		child.prototype = new TempConstructor();
		/** @override */
		child.prototype.constructor = child;
		child._super = parent;
	};

	///////////////////////////////////////////////////////////////////////////
	//	CONTEXT
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  The private audio context shared by all Tone Nodes. 
	 *  @private
	 *  @type {Tone.Context|undefined}
	 */
	var audioContext;

	/**
	 *  A static pointer to the audio context accessible as Tone.context. 
	 *  @type {Tone.Context}
	 *  @name context
	 *  @memberOf Tone
	 */
	Object.defineProperty(Tone, "context", {
		get : function(){
			return audioContext;
		},
		set : function(context){
			if (Tone.Context && context instanceof Tone.Context){
				audioContext = context;
			} else {
				audioContext = new Tone.Context(context);
			}
			//initialize the new audio context
			Tone.Context.emit("init", audioContext);
		}
	});

	/**
	 *  The AudioContext
	 *  @type {Tone.Context}
	 *  @name context
	 *  @memberOf Tone#
	 *  @readOnly
	 */
	Object.defineProperty(Tone.prototype, "context", {
		get : function(){
			return Tone.context;
		}
	});

	/**
	 *  Tone automatically creates a context on init, but if you are working
	 *  with other libraries which also create an AudioContext, it can be
	 *  useful to set your own. If you are going to set your own context, 
	 *  be sure to do it at the start of your code, before creating any objects.
	 *  @static
	 *  @param {AudioContext} ctx The new audio context to set
	 */
	Tone.setContext = function(ctx){
		Tone.context = ctx;
	};

	///////////////////////////////////////////////////////////////////////////
	//	ATTRIBUTES
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  The number of inputs feeding into the AudioNode. 
	 *  For source nodes, this will be 0.
	 *  @memberOf Tone#
	 *  @name numberOfInputs
	 *  @readOnly
	 */
	Object.defineProperty(Tone.prototype, "numberOfInputs", {
		get : function(){
			if (this.input){
				if (Tone.isArray(this.input)){
					return this.input.length;
				} else {
					return 1;
				}
			} else {
				return 0;
			}
		}
	});

	/**
	 *  The number of outputs coming out of the AudioNode. 
	 *  For source nodes, this will be 0.
	 *  @memberOf Tone#
	 *  @name numberOfInputs
	 *  @readOnly
	 */
	Object.defineProperty(Tone.prototype, "numberOfOutputs", {
		get : function(){
			if (this.output){
				if (Tone.isArray(this.output)){
					return this.output.length;
				} else {
					return 1;
				}
			} else {
				return 0;
			}
		}
	});

	/**
	 *  The number of seconds of 1 processing block (128 samples)
	 *  @type {Number}
	 *  @name blockTime
	 *  @memberOf Tone#
	 *  @readOnly
	 */
	Object.defineProperty(Tone.prototype, "blockTime", {
		get : function(){
			return 128 / this.context.sampleRate;
		}
	});

	/**
	 *  The duration in seconds of one sample.
	 *  @type {Number}
	 *  @name sampleTime
	 *  @memberOf Tone#
	 *  @readOnly
	 */
	Object.defineProperty(Tone.prototype, "sampleTime", {
		get : function(){
			return 1 / this.context.sampleRate;
		}
	});

	/**
	 *  Whether or not all the technologies that Tone.js relies on are supported by the current browser. 
	 *  @type {Boolean}
	 *  @name supported
	 *  @memberOf Tone
	 *  @readOnly
	 *  @static
	 */
	Object.defineProperty(Tone, "supported", {
		get : function(){
			var hasAudioContext = window.hasOwnProperty("AudioContext") || window.hasOwnProperty("webkitAudioContext");
			var hasPromises = window.hasOwnProperty("Promise");
			var hasWorkers = window.hasOwnProperty("Worker");
			return hasAudioContext && hasPromises && hasWorkers;
		}
	});

	/**
	 * The version number
	 * @type {String}
	 * @static
	 */
	Tone.version = "r11-dev";

	// allow optional silencing of this log
	if (!window.TONE_SILENCE_VERSION_LOGGING) {
		console.log("%c * Tone.js " + Tone.version + " * ", "background: #000; color: #fff");
	}

	return Tone;
});
