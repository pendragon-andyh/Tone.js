define(["Tone/core/Tone", "Tone/core/Param", "Tone/type/Type"], function (Tone) {

	"use strict";

	/**
	 *  createGain shim
	 *  @private
	 */
	if (window.GainNode && !AudioContext.prototype.createGain){
		AudioContext.prototype.createGain = AudioContext.prototype.createGainNode;
	}

	/**
	 *  @class A thin wrapper around the Native Web Audio GainNode.
	 *         The GainNode is a basic building block of the Web Audio
	 *         API and is useful for routing audio and adjusting gains. 
	 *  @extends {Tone}
	 *  @param  {Number=}  gain  The initial gain of the GainNode
	 *  @param {Tone.Type=} units The units of the gain parameter. 
	 */
	Tone.Gain = function(){

		var options = Tone.defaults(arguments, ["gain", "units"], Tone.Gain);
		Tone.call(this);

		/**
		 *  The GainNode
		 *  @type  {GainNode}
		 *  @private
		 */
		this.input = this.output = this._gainNode = this.context.createGain();

		/**
		 *  The gain parameter of the gain node.
		 *  @type {Tone.Param}
		 *  @signal
		 */
		this.gain = new Tone.Param({
			"param" : this._gainNode.gain, 
			"units" : options.units,
			"value" : options.gain,
			"convert" : options.convert
		});
		this._readOnly("gain");
	};

	Tone.extend(Tone.Gain);

	/**
	 *  The defaults
	 *  @const
	 *  @type  {Object}
	 */
	Tone.Gain.defaults = {
		"gain" : 1,
		"convert" : true,
	};

	/**
	 *  Clean up.
	 *  @return  {Tone.Gain}  this
	 */
	Tone.Gain.prototype.dispose = function(){
		Tone.Param.prototype.dispose.call(this);
		this._gainNode.disconnect();
		this._gainNode = null;
		this._writable("gain");
		this.gain.dispose();
		this.gain = null;
	};

	//STATIC///////////////////////////////////////////////////////////////////

	/**
	 *  Create input and outputs for this object.
	 *  @param  {Number}  input   The number of inputs
	 *  @param  {Number=}  outputs  The number of outputs
	 *  @return  {Tone}  this
	 *  @internal
	 */
	Tone.prototype.createInsOuts = function(inputs, outputs){

		if (inputs === 1){
			this.input = new Tone.Gain();
		} else if (inputs > 1){
			this.input = new Array(inputs);
		}

		if (outputs === 1){
			this.output = new Tone.Gain();
		} else if (outputs > 1){
			this.output = new Array(outputs);
		}
	};

	///////////////////////////////////////////////////////////////////////////

	return Tone.Gain;
});