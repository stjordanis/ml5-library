// Copyright (c) 2018 ml5
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/*
PoseNet
The original PoseNet model was ported to TensorFlow.js by Dan Oved.
*/

import EventEmitter from 'events';
import * as tf from '@tensorflow/tfjs';
import * as posenet from '@tensorflow-models/posenet';
import callCallback from '../utils/callcallback';

const DEFAULTS = {
  imageScaleFactor: 0.3,
  outputStride: 16,
  flipHorizontal: false,
  minConfidence: 0.5,
  maxPoseDetections: 5,
  scoreThreshold: 0.5,
  nmsRadius: 20,
  detectionType: 'multiple',
  multiplier: 0.75,
};

class PoseNet extends EventEmitter {
  /**
   * @typedef {Object} options
   * @property {number} imageScaleFactor - default 0.3
   * @property {number} outputStride - default 16
   * @property {boolean} flipHorizontal - default false
   * @property {number} minConfidence - default 0.5
   * @property {number} maxPoseDetections - default 5
   * @property {number} scoreThreshold - default 0.5
   * @property {number} nmsRadius - default 20
   * @property {String} detectionType - default single
   * @property {multiplier} nmsRadius - default 0.75
   */
  /**
   * Create a PoseNet model.
   * @param {HTMLVideoElement || p5.Video} video  - Optional. A HTML video element or a p5 video element.
   * @param {options} options - Optional. An object describing a model accuracy and performance.
   * @param {String} detectionType - Optional. A String value to run 'single' or 'multiple' estimation.
   * @param {function} callback  Optional. A function to run once the model has been loaded. 
   *    If no callback is provided, it will return a promise that will be resolved once the 
   *    model has loaded.
   */
  constructor(video, options, detectionType, callback) {
    super();
    this.video = video;
    /**
     * The type of detection. 'single' or 'multiple'
     * @type {String}
     * @public
     */
    this.detectionType = detectionType || DEFAULTS.detectionType;
    this.imageScaleFactor = options.imageScaleFactor || DEFAULTS.imageScaleFactor;
    this.outputStride = options.outputStride || DEFAULTS.outputStride;
    this.flipHorizontal = options.flipHorizontal || DEFAULTS.flipHorizontal;
    this.minConfidence = options.minConfidence || DEFAULTS.minConfidence;
    this.multiplier = options.multiplier || DEFAULTS.multiplier;
    this.ready = callCallback(this.load(), callback);
    // this.then = this.ready.then;
  }

  async load() {
    this.net = await posenet.load(this.multiplier);

    if (this.video) {
      if (this.video.readyState === 0) {
        await new Promise((resolve) => {
          this.video.onloadeddata = () => resolve();
        });
      }
      if (this.detectionType === 'single') {
        this.singlePose();
      }

      this.multiPose();
    }
    return this;
  }

  skeleton(keypoints, confidence = this.minConfidence) {
    return posenet.getAdjacentKeyPoints(keypoints, confidence);
  }

  // eslint-disable-next-line class-methods-use-this
  mapParts(pose) {
    const newPose = JSON.parse(JSON.stringify(pose));
    newPose.keypoints.forEach((keypoint) => {
      newPose[keypoint.part] = {
        x: keypoint.position.x,
        y: keypoint.position.y,
        confidence: keypoint.score,
      };
    });
    return newPose;
  }

  /**
   * Given an image or video, returns an array of objects containing pose estimations 
   *    using single or multi-pose detection.
   * @param {HTMLVideoElement || p5.Video || function} inputOr 
   * @param {function} cb 
   */
  /* eslint max-len: ["error", { "code": 180 }] */
  async singlePose(inputOr, cb) {
    let input;
    if (inputOr instanceof HTMLImageElement || inputOr instanceof HTMLVideoElement) {
      input = inputOr;
    } else if (typeof inputOr === 'object' && (inputOr.elt instanceof HTMLImageElement || inputOr.elt instanceof HTMLVideoElement)) {
      input = inputOr.elt; // Handle p5.js image and video
    } else {
      input = this.video;
    }

    const pose = await this.net.estimateSinglePose(input, this.imageScaleFactor, this.flipHorizontal, this.outputStride);
    const poseWithParts = this.mapParts(pose);
    const result = [{ pose:poseWithParts, skeleton: this.skeleton(pose.keypoints) }];
    this.emit('pose', result);

    if (this.video) {
      return tf.nextFrame().then(() => this.singlePose());
    }

    if (typeof cb === 'function') {
      cb(result);
    }

    return result;
  }
  
  /**
   * Given an image or video, returns an array of objects containing pose 
   *    estimations using single or multi-pose detection.
   * @param {HTMLVideoElement || p5.Video || function} inputOr 
   * @param {function} cb 
   */
  async multiPose(inputOr, cb) {
    let input;

    if (inputOr instanceof HTMLImageElement || inputOr instanceof HTMLVideoElement) {
      input = inputOr;
    } else if (typeof inputOr === 'object' && (inputOr.elt instanceof HTMLImageElement || inputOr.elt instanceof HTMLVideoElement)) {
      input = inputOr.elt; // Handle p5.js image and video
    } else {
      input = this.video;
    }

    const poses = await this.net.estimateMultiplePoses(input, this.imageScaleFactor, this.flipHorizontal, this.outputStride);
    const posesWithParts = poses.map(pose => (this.mapParts(pose)));
    const result = posesWithParts.map(pose => ({ pose, skeleton: this.skeleton(pose.keypoints) }));
    this.emit('pose', result);
    if (this.video) {
      return tf.nextFrame().then(() => this.multiPose());
    }

    if (typeof cb === 'function') {
      cb(result);
    }

    return result;
  }
}

const poseNet = (videoOrOptionsOrCallback, optionsOrCallback, cb) => {
  let video;
  let options = {};
  let callback = cb;
  let detectionType = null;

  if (videoOrOptionsOrCallback instanceof HTMLVideoElement) {
    video = videoOrOptionsOrCallback;
  } else if (typeof videoOrOptionsOrCallback === 'object' && videoOrOptionsOrCallback.elt instanceof HTMLVideoElement) {
    video = videoOrOptionsOrCallback.elt; // Handle a p5.js video element
  } else if (typeof videoOrOptionsOrCallback === 'object') {
    options = videoOrOptionsOrCallback;
  } else if (typeof videoOrOptionsOrCallback === 'function') {
    callback = videoOrOptionsOrCallback;
  }

  if (typeof optionsOrCallback === 'object') {
    options = optionsOrCallback;
  } else if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
  } else if (typeof optionsOrCallback === 'string') {
    detectionType = optionsOrCallback;
  }

  return new PoseNet(video, options, detectionType, callback);
};

export default poseNet;
