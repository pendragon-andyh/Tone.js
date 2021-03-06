define(["Tone/core/Tone", "Tone/instrument/Instrument", "Tone/core/Buffers", "Tone/source/BufferSource"], 
	function (Tone) {

	/**
	 * @class Automatically interpolates between a set of pitched samples
	 * @param {Object} samples An object of samples mapping either Midi 
	 *                         Note Numbers or Scientific Pitch Notation 
	 *                         to the url of that sample. 
	 * @example
	 * var sampler = new Tone.MultiSampler({
	 * 	"C3" : "path/to/C3.mp3",
	 * 	"D#3" : "path/to/Dsharp3.mp3",
	 * 	"F#3" : "path/to/Fsharp3.mp3",
	 * 	"A3" : "path/to/A3.mp3",
	 * }, function(){
	 * 	//sampler will repitch the closest sample
	 * 	sampler.triggerAttack("D3")
	 * })
	 */
	Tone.MultiSampler = function(urls){

		// shift arguments over one. Those are the remainder of the options
		var args = Array.prototype.slice.call(arguments);
		args.shift();
		var options = Tone.defaults(args, ["onload", "baseUrl"], Tone.MultiSampler);
		Tone.Instrument.call(this, options);

		var urlMap = {};
		for (var note in urls){
			if (Tone.isNote(note)){
				//convert the note name to MIDI
				var mid = Tone.Frequency(note).toMidi();
				urlMap[mid] = urls[note];
			} else if (!isNaN(parseFloat(note))){
				//otherwise if it's numbers assume it's midi
				urlMap[note] = urls[note];
			} else {
				throw new Error("Tone.MultiSampler: url keys must be the note's pitch");
			}
		}

		/**
		 * The stored and loaded buffers
		 * @type {Tone.Buffers}
		 * @private
		 */
		this._buffers = new Tone.Buffers(urlMap, options.onload, options.baseUrl);

		/**
		 * The object of all currently playing BufferSources
		 * @type {Object}
		 * @private
		 */
		this._activeSources = {};

		/**
		 * The envelope applied to the beginning of the sample.
		 * @type {Time}
		 */
		this.attack = options.attack;

		/**
		 * The envelope applied to the end of the envelope.
		 * @type {Time}
		 */
		this.release = options.release;
	};

	Tone.extend(Tone.MultiSampler, Tone.Instrument);

	/**
	 * The defaults
	 * @const
	 * @type {Object}
	 */
	Tone.MultiSampler.defaults = {
		attack : 0,
		release : 0.1,
		onload : Tone.noOp,
		baseUrl : ""
	};

	/**
	 * Returns the difference in steps between the given midi note at the closets sample.
	 * @param  {Midi} midi
	 * @return {Interval}    
	 * @private
	 */
	Tone.MultiSampler.prototype._findClosest = function(midi){
		var MAX_INTERVAL = 24;
		var interval = 0;
		while(interval < MAX_INTERVAL){
			// check above and below
			if (this._buffers.has(midi + interval)){
				return -interval;
			} else if (this._buffers.has(midi - interval)){
				return interval;
			}
			interval++;
		}
		return null;
	};

	/**
	 * @param  {Frequency} note     The note to play
	 * @param  {Time=} time     When to play the note
	 * @param  {NormalRange=} velocity The velocity to play the sample back.
	 * @return {Tone.MultiSampler}          this
	 */
	Tone.MultiSampler.prototype.triggerAttack = function(note, time, velocity){
		var midi = Tone.Frequency(note).toMidi();
		// find the closest note pitch
		var difference = this._findClosest(midi);
		if (difference !== null){
			var closestNote = midi - difference;
			var buffer = this._buffers.get(closestNote);
			// play that note
			var source = new Tone.BufferSource({
				"buffer" : buffer,
				"playbackRate" : Tone.intervalToFrequencyRatio(difference),
				"fadeIn" : this.attack,
				"fadeOut" : this.release
			}).connect(this.output);
			source.start(time, 0, buffer.duration, velocity);
			// add it to the active sources
			if (!Tone.isArray(this._activeSources[midi])){
				this._activeSources[midi] = [];
			}
			this._activeSources[midi].push({
				note : midi,
				source : source
			});
		}
		return this;
	};

	/**
	 * @param  {Frequency} note     The note to release.
	 * @param  {Time=} time     	When to release the note.
	 * @return {Tone.MultiSampler}	this
	 */
	Tone.MultiSampler.prototype.triggerRelease = function(note, time){
		var midi = Tone.Frequency(note).toMidi();
		// find the note
		if (this._activeSources[midi] && this._activeSources[midi].length){
			var source = this._activeSources[midi].shift().source;
			source.stop(time, this.release);
		}
	};

	/**
	 *  Add a note to the sampler.
	 *  @param  {Note|Midi}   note      The buffer's pitch.
	 *  @param  {String|Tone.Buffer|Audiobuffer}  url  Either the url of the bufer, 
	 *                                                 or a buffer which will be added
	 *                                                 with the given name.
	 *  @param  {Function=}  callback  The callback to invoke 
	 *                                 when the url is loaded.
	 */
	Tone.MultiSampler.prototype.add = function(note, url, callback){
		if (Tone.isNote(note)){
			//convert the note name to MIDI
			var mid = Tone.Frequency(note).toMidi();
			this._buffers.add(mid, url, callback);
		} else if (!isNaN(parseFloat(note))){
			//otherwise if it's numbers assume it's midi
			this._buffers.add(note, url, callback);
		} else {
			throw new Error("Tone.MultiSampler: note must be the note's pitch. Instead got "+note);
		}
	};

	/**
	 * If the buffers are loaded or not
	 * @memberOf Tone.MultiSampler#
	 * @type {Boolean}
	 * @name loaded
	 * @readOnly
	 */
	Object.defineProperty(Tone.MultiSampler.prototype, "loaded", {
		get : function(){
			return this._buffers.loaded;
		}
	});

	/**
	 * Clean up
	 * @return {Tone.MultiSampler} this
	 */
	Tone.MultiSampler.prototype.dispose = function(){
		Tone.Instrument.prototype.dispose.call(this);
		this._buffers.dispose();
		this._buffers = null;
		for (var midi in this._activeSources){
			this._activeSources[midi].forEach(function(event){
				event.source.dispose();
			});
		}
		this._activeSources = null;
		return this;
	};

	return Tone.MultiSampler;
});