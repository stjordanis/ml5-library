// Copyright (c) 2018 ml5
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/* eslint prefer-destructuring: ['error', {AssignmentExpression: {array: false}}] */
/* eslint no-await-in-loop: 'off' */
/*
SketchRNN
*/

import * as ms from '@magenta/sketch';
import callCallback from '../utils/callcallback';
import modelPaths from './models';

const PATH_START_LARGE = 'https://storage.googleapis.com/quickdraw-models/sketchRNN/large_models/';
const PATH_START_SMALL = 'https://storage.googleapis.com/quickdraw-models/sketchRNN/models/';
const PATH_END = '.gen.json';

class SketchRNN {
  /**
   * Create SketchRNN. 
   * @param {String} model - The name of the sketch model to be loaded.
   *    The names can be found in the models.js file
   * @param {function} callback - Optional. A callback function that is called once the model has loaded. If no callback is provided, it will return a promise 
   *    that will be resolved once the model has loaded.
   */
  constructor(model, callback, large = true) {
    let checkpointUrl = model;
    if (modelPaths.has(checkpointUrl)) {
      checkpointUrl = (large ? PATH_START_LARGE : PATH_START_SMALL) + checkpointUrl + PATH_END;
    }
    this.defaults = {
      temperature: 0.65,
      pixelFactor: 3.0,
    };
    this.model = new ms.SketchRNN(checkpointUrl);
    this.penState = this.model.zeroInput();
    this.ready = callCallback(this.model.initialize(), callback);
  }

  async generateInternal(options, strokes) {
    const temperature = +options.temperature || this.defaults.temperature;
    const pixelFactor = +options.pixelFactor || this.defaults.pixelFactor;

    await this.ready;
    if (!this.rnnState) {
      this.rnnState = this.model.zeroState();
      this.model.setPixelFactor(pixelFactor);
    }

    if (Array.isArray(strokes) && strokes.length) {
      this.rnnState = this.model.updateStrokes(strokes, this.rnnState);
    }
    this.rnnState = this.model.update(this.penState, this.rnnState);
    const pdf = this.model.getPDF(this.rnnState, temperature);
    this.penState = this.model.sample(pdf);
    const result = {
      dx: this.penState[0],
      dy: this.penState[1],
    };
    if (this.penState[2] === 1) {
      result.pen = 'down';
    } else if (this.penState[3] === 1) {
      result.pen = 'up';
    } else if (this.penState[4] === 1) {
      result.pen = 'end';
    }
    return result;
  }

  async generate(optionsOrSeedOrCallback, seedOrCallback, cb) {
    let callback;
    let options;
    let seedStrokes;

    if (typeof optionsOrSeedOrCallback === 'function') {
      options = {};
      seedStrokes = [];
      callback = optionsOrSeedOrCallback;
    } else if (Array.isArray(optionsOrSeedOrCallback)) {
      options = {};
      seedStrokes = optionsOrSeedOrCallback;
      callback = seedOrCallback;
    } else if (typeof seedOrCallback === 'function') {
      options = optionsOrSeedOrCallback || {};
      seedStrokes = [];
      callback = seedOrCallback;
    } else {
      options = optionsOrSeedOrCallback || {};
      seedStrokes = seedOrCallback || [];
      callback = cb;
    }

    const strokes = seedStrokes.map(s => {
      const up = s.pen === 'up' ? 1 : 0;
      const down = s.pen === 'down' ? 1 : 0;
      const end = s.pen === 'end' ? 1 : 0;
      return [s.dx, s.dy, down, up, end];
    });
    return callCallback(this.generateInternal(options, strokes), callback);
  }

  reset() {
    this.penState = this.model.zeroInput();
    if (this.rnnState) {
      this.rnnState = this.model.zeroState();
    }
  }
}

const sketchRNN = (model, callback, large = true) => new SketchRNN(model, callback, large);

export default sketchRNN;
