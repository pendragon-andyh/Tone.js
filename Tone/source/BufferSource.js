define(["Tone/core/Tone", "Tone/core/Buffer", "Tone/source/Source", "Tone/core/Gain"], function (Tone) {

	/**
	 *  BufferSource polyfill
	 */
	if (window.AudioBufferSourceNode && !AudioBufferSourceNode.prototype.start){
		AudioBufferSourceNode.prototype.start = AudioBufferSourceNode.prototype.noteGrainOn;
		AudioBufferSourceNode.prototype.stop = AudioBufferSourceNode.prototype.noteOff;
	}

	/**
	 *  @class Wrapper around the native BufferSourceNode.
	 *  @extends {Tone}
	 *  @param  {AudioBuffer|Tone.Buffer}  buffer   The buffer to play
	 *  @param  {Function}  onload  The callback to invoke when the 
	 *                               buffer is done playing.
	 */
	Tone.BufferSource = function(){

		var options = Tone.defaults(arguments, ["buffer", "onload"], Tone.BufferSource);
		Tone.call(this);

		/**
		 *  The callback to invoke after the 
		 *  buffer source is done playing. 
		 *  @type  {Function}
		 */
		this.onended = options.onended;

		/**
		 *  The time that the buffer was started.
		 *  @type  {Number}
		 *  @private
		 */
		this._startTime = -1;

		/**
		 *  The time that the buffer is scheduled to stop.
		 *  @type  {Number}
		 *  @private
		 */
		this._stopTime = -1;

		/**
		 *  The gain node which envelopes the BufferSource
		 *  @type  {Tone.Gain}
		 *  @private
		 */
		this._gainNode = this.output = new Tone.Gain();

		/**
		 *  The buffer source
		 *  @type  {AudioBufferSourceNode}
		 *  @private
		 */
		this._source = this.context.createBufferSource();
		this._source.connect(this._gainNode);

		/**
		 * The private buffer instance
		 * @type {Tone.Buffer}
		 * @private
		 */
		this._buffer = new Tone.Buffer(options.buffer, options.onload);
	
		/**
		 *  The playbackRate of the buffer
		 *  @type {Positive}
		 *  @signal
		 */
		this.playbackRate = new Tone.Param(this._source.playbackRate, Tone.Type.Positive);

		/**
		 *  The fadeIn time of the amplitude envelope.
		 *  @type {Time}
		 */
		this.fadeIn = options.fadeIn;

		/**
		 *  The fadeOut time of the amplitude envelope.
		 *  @type {Time}
		 */
		this.fadeOut = options.fadeOut;

		/**
		 *  The value that the buffer ramps to
		 *  @type {Gain}
		 *  @private
		 */
		this._gain = 1;

		/**
		 * The onended timeout
		 * @type {Number}
		 * @private
		 */
		this._onendedTimeout = -1;

		this.loop = options.loop;
		this.loopStart = options.loopStart;
		this.loopEnd = options.loopEnd;
		this.playbackRate.value = options.playbackRate;
	};

	Tone.extend(Tone.BufferSource);

	/**
	 *  The defaults
	 *  @const
	 *  @type  {Object}
	 */
	Tone.BufferSource.defaults = {
		"onended" : Tone.noOp,
		"onload" : Tone.noOp,
		"loop" : false,
		"loopStart" : 0,
		"loopEnd" : 0,
		"fadeIn" : 0,
		"fadeOut" : 0,
		"playbackRate" : 1
	};

	/**
	 *  Returns the playback state of the source, either "started" or "stopped".
	 *  @type {Tone.State}
	 *  @readOnly
	 *  @memberOf Tone.BufferSource#
	 *  @name state
	 */
	Object.defineProperty(Tone.BufferSource.prototype, "state", {
		get : function(){
			var now = this.now();
			if (this._startTime !== -1 && now >= this._startTime && now < this._stopTime){
				return Tone.State.Started;
			} else {
				return Tone.State.Stopped;
			}
		}
	});

	/**
	 *  Start the buffer
	 *  @param  {Time} [startTime=now] When the player should start.
	 *  @param  {Time} [offset=0] The offset from the beginning of the sample
	 *                                 to start at. 
	 *  @param  {Time=} duration How long the sample should play. If no duration
	 *                                is given, it will default to the full length 
	 *                                of the sample (minus any offset)
	 *  @param  {Gain}  [gain=1]  The gain to play the buffer back at.
	 *  @param  {Time=}  fadeInTime  The optional fadeIn ramp time.
	 *  @return  {Tone.BufferSource}  this
	 */
	Tone.BufferSource.prototype.start = function(time, offset, duration, gain, fadeInTime){
		if (this._startTime !== -1){
			throw new Error("Tone.BufferSource can only be started once.");
		}

		if (this.buffer.loaded){
			time = this.toSeconds(time);
			//if it's a loop the default offset is the loopstart point
			if (this.loop){
				offset = Tone.defaultArg(offset, this.loopStart);
			} else {
				//otherwise the default offset is 0
				offset = Tone.defaultArg(offset, 0);
			}
			offset = this.toSeconds(offset);
			//the values in seconds
			time = this.toSeconds(time);

			gain = Tone.defaultArg(gain, 1);
			this._gain = gain;

			//the fadeIn time
			if (Tone.isUndef(fadeInTime)){
				fadeInTime = this.toSeconds(this.fadeIn);
			} else {
				fadeInTime = this.toSeconds(fadeInTime);
			}

			if (fadeInTime > 0){
				this._gainNode.gain.setValueAtTime(0, time);
				this._gainNode.gain.linearRampToValueAtTime(this._gain, time + fadeInTime);
			} else {
				this._gainNode.gain.setValueAtTime(gain, time);
			}

			this._startTime = time + fadeInTime;

			var computedDur = Tone.defaultArg(duration, this.buffer.duration - offset);
			computedDur = this.toSeconds(computedDur);
			computedDur = Math.max(computedDur, 0);

			if (!this.loop || (this.loop && !Tone.isUndef(duration))){
				//clip the duration when not looping
				if (!this.loop){
					computedDur = Math.min(computedDur, this.buffer.duration - offset);
				}
				this.stop(time + computedDur + fadeInTime, fadeInTime);
			}

			//start the buffer source
			if (this.loop){
				//modify the offset if it's greater than the loop time
				var loopEnd = this.loopEnd || this.buffer.duration;
				var loopStart = this.loopStart;
				var loopDuration = loopEnd - loopStart;
				//move the offset back
				if (offset > loopEnd){
					offset = ((offset - loopStart) % loopDuration) + loopStart;
				}
			}
			this._source.buffer = this.buffer.get();
			this._source.loopEnd = this.loopEnd || this.buffer.duration;
			this._source.start(time, offset);
		} else {
			throw new Error("Tone.BufferSource: buffer is either not set or not loaded.");
		}

		return this;
	};

	/**
	 *  Stop the buffer. Optionally add a ramp time to fade the 
	 *  buffer out. 
	 *  @param  {Time=}  time         The time the buffer should stop.
	 *  @param  {Time=}  fadeOutTime  How long the gain should fade out for
	 *  @return  {Tone.BufferSource}  this
	 */
	Tone.BufferSource.prototype.stop = function(time, fadeOutTime){
		if (this.buffer.loaded){

			time = this.toSeconds(time);
			
			//the fadeOut time
			if (Tone.isUndef(fadeOutTime)){
				fadeOutTime = this.toSeconds(this.fadeOut);
			} else {
				fadeOutTime = this.toSeconds(fadeOutTime);
			}			

			this._stopTime = time + fadeOutTime;

			//cancel the end curve
			this._gainNode.gain.cancelScheduledValues(this._startTime + this.sampleTime);
			time = Math.max(this._startTime, time);

			//set a new one
			if (fadeOutTime > 0){
				this._gainNode.gain.setValueAtTime(this._gain, time);
				time += fadeOutTime;
				this._gainNode.gain.linearRampToValueAtTime(0, time);
			} else {
				this._gainNode.gain.setValueAtTime(0, time);
			}

			Tone.context.clearTimeout(this._onendedTimeout);
			this._onendedTimeout = Tone.context.setTimeout(this._onended.bind(this), this._stopTime - this.now());
		} else {
			throw new Error("Tone.BufferSource: buffer is either not set or not loaded.");
		}

		return this;
	};

	/**
	 *  Internal callback when the buffer is ended. 
	 *  Invokes `onended` and disposes the node.
	 *  @private
	 */
	Tone.BufferSource.prototype._onended = function(){
		this.onended(this);
	};

	/**
	 * If loop is true, the loop will start at this position. 
	 * @memberOf Tone.BufferSource#
	 * @type {Time}
	 * @name loopStart
	 */
	Object.defineProperty(Tone.BufferSource.prototype, "loopStart", {
		get : function(){
			return this._source.loopStart;
		}, 
		set : function(loopStart){
			this._source.loopStart = this.toSeconds(loopStart);
		}
	});

	/**
	 * If loop is true, the loop will end at this position.
	 * @memberOf Tone.BufferSource#
	 * @type {Time}
	 * @name loopEnd
	 */
	Object.defineProperty(Tone.BufferSource.prototype, "loopEnd", {
		get : function(){
			return this._source.loopEnd;
		}, 
		set : function(loopEnd){
			this._source.loopEnd = this.toSeconds(loopEnd);
		}
	});

	/**
	 * The audio buffer belonging to the player. 
	 * @memberOf Tone.BufferSource#
	 * @type {Tone.Buffer}
	 * @name buffer
	 */
	Object.defineProperty(Tone.BufferSource.prototype, "buffer", {
		get : function(){
			return this._buffer;
		}, 
		set : function(buffer){
			this._buffer.set(buffer);
		}
	});

	/**
	 * If the buffer should loop once it's over. 
	 * @memberOf Tone.BufferSource#
	 * @type {Boolean}
	 * @name loop
	 */
	Object.defineProperty(Tone.BufferSource.prototype, "loop", {
		get : function(){
			return this._source.loop;
		}, 
		set : function(loop){
			this._source.loop = loop;
		}
	});

	/**
	 *  Clean up.
	 *  @return  {Tone.BufferSource}  this
	 */
	Tone.BufferSource.prototype.dispose = function(){
		Tone.prototype.dispose.call(this);
		this.onended = null;
		this._source.disconnect();
		this._source = null;
		this._gainNode.dispose();
		this._gainNode = null;
		this._buffer.dispose();
		this._buffer = null;
		this._startTime = -1;
		this.playbackRate = null;
		Tone.context.clearTimeout(this._onendedTimeout);
		return this;
	};

	return Tone.BufferSource;
});