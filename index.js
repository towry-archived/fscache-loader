/**
 * @file Speed up the webpack build time.
 * @author Towry Wang, http://towry.me
 * @copyright MIT
 */
'use strict';

const utils = require('loader-utils');
const path = require('path');
const fs = require('fs');
const bufferShim = require('buffer-shims');
const crypto = require('crypto');
const mkdirp = require('mkdirp');
const chalk = require('chalk');

const CACHE_FOLDER = '.fscache';
const FC_HASH_COMMENT_START = "/**! fcVer: ";
const FC_HASH_COMMENT_END = " */";
const FC_HASH_COMMENT_START_TRIM = FC_HASH_COMMENT_START.trim();
const FC_HASH_MAX_LENGTH = FC_HASH_COMMENT_START.length +
		FC_HASH_COMMENT_END.length +
		/* md5 string length */
		32 +
		/* extras */
		10;

function cacheLoader(source) {
	this.cacheable && this.cacheable();

	var config = utils.getOptions(this) || {};
	var cachePath;
	var cacheFilePath;
	var sourcePath = this.resourcePath;
	var cacheFolder = config.cacheFolder || CACHE_FOLDER;
	var self = this;

	cachePath = path.join(this.options.context, CACHE_FOLDER);
	if (config.getCacheFilePath) {
		cacheFilePath = config.getCacheFilePath(sourcePath, this.options.context);
	} else {
		cacheFilePath = getCacheFilePath(sourcePath, this.options.context, cachePath);
	}

	// Save the source to cache file.
	var callback = this.async();

	if (!callback) {
		return;
	}

	function log() {
		!config.silent &&
			console.log('[fscache-loader] cache file ' +
				chalk.white(getRelativePath(sourcePath, self.options.context)) +
				" was " +
				chalk.yellow("created"));
	}

	// create cache file.
	getFileHash(sourcePath).then(function (value) {
		var hashStr = FC_HASH_COMMENT_START + value + FC_HASH_COMMENT_END;
		var hashStrBuffer = bufferShim.from(hashStr, 'utf8');

		var fileBuffer = source;
		var newFileBuffer = bufferShim.alloc(fileBuffer.length + hashStrBuffer.length);

		hashStrBuffer.copy(newFileBuffer, 0, 0, hashStrBuffer.length);
		fileBuffer.copy(newFileBuffer, hashStrBuffer.length, 0, fileBuffer.length);

		// make dirs.
		mkdirp(getDirname(cacheFilePath), function (err) {
			if (err) {
				return callback(null, source);
			}

			// write file.
			fs.open(cacheFilePath, 'w+', function (err, fd) {
				if (err) {
					// ignore.
					return callback(null, source);
				}

				fs.write(fd, newFileBuffer, 0, newFileBuffer.length, function (err) {
					if (!err) {
						fs.close(fd);
					}

					log();
					return callback(null, source);
				})
			});
		});

	}, function err() {
		return callback(null, source);
	})
}
module.exports = cacheLoader;
module.exports.raw = true;

// Return undefined if no cache.
cacheLoader.pitch = function () {
	var config = utils.getOptions(this) || {};
	var sourcePath = this.resourcePath;
	var self = this;

	var cachePath = path.join(this.options.context, CACHE_FOLDER);
	var cacheFilePath = getCacheFilePath(sourcePath, this.options.context, cachePath);

	var callback = this.async();
	if (!callback) {
		return;
	}

	var sourceHash = getFileHash();
	var cacheHash = getFcHashStrFromFile(cacheFilePath);

	function log() {
		!config.silent &&
			console.log('[fscache-loader] cache file ' +
				chalk.white(getRelativePath(sourcePath, self.options.context)) +
				" was " +
				chalk.yellow("used"));
	}

	Promise.all([ sourceHash, cacheHash ]).then(function success(values) {
		var sourceHash = values[0];
		var cacheHash = values[1];

		if (sourceHash === cacheHash) {
			// not changed.
			fs.readFile(cacheFilePath, function (err, data) {
				if (err || !data) {
					// ignore cache.
					return callback();
				}

				log();
				// return cache content.
				return callback(null, data);
			})
		}

		return callback();
	}, function fail() {
		return callback();
	})
}

/**
 * Get the path of cached file.
 */
function getCacheFilePath(pathString, part, repl) {
	return pathString.replace(part, repl);
}

/**
 * Check if chunk file is changed.
 */
function notChanged(cache, request) {
	var cacheHash = getCacheHash(cache);
	if (cacheHash === null) {
		return false;
	}

	var requestHash = getFileHash(request);

	return cacheHash === requestHash;
}

/**
 * Get hash from cache file.
 */
function getCacheHash(cache) {
	try {
		var content = fs.readFileSync(cache, {encoding: 'utf8'});
	} catch (e) {
		return null;
	}
	return content;
}

/**
 * Get cache content.
 */
function getCacheContent(request) {
	var content = fs.readFileSync(request, {encoding: 'utf8'});
	return content;
}

function getRelativePath(fullpath, context) {
	var p = fullpath.replace(context, '');
	if (p[0] === '/') {
		return p.substr(1);
	}

	return p;
}

function getFcStrFromBuffer(buffer) {
	var hashBuffer = bufferShim.alloc(FC_HASH_MAX_LENGTH, 0);
	buffer.copy(hashBuffer, 0, 0, FC_HASH_MAX_LENGTH);
	var hashStr = hashBuffer.toString();

	return getFcHashStrFromStr(hashStr);
}

function getFcHashStrFromStr(str) {
	str = str.trim();
	if (str.indexOf(FC_HASH_COMMENT_START_TRIM) !== 0) {
		return '';
	}

	str = str.substr(0, FC_HASH_MAX_LENGTH);

	var parts = str.split(' ');
	if (parts.length < 4) {
		return '';
	}

	return parts[2];
}

function getFileHash(filepath) {
	var hash = crypto.createHash('md5');

	return new Promise(function (resolve, reject) {
		if (filepath instanceof Buffer) {
			var contents = filepath.toString();
			var hex = null;

			filepath = null;

			hash.update(contents, 'utf8');
			hex = hash.digest('hex');

			resolve(hex);
			return;
		}

		try {
			var stream = fs.createReadStream(filepath);
		} catch (e) {
			reject(e);
			return;
		}

		stream.on('data', function (data) {
			hash.update(data, 'utf8');
		})

		stream.on('end', function () {
			resolve(hash.digest('hex'));
		})

		stream.on('error', function (err) {
			reject(err);
		})
	})
}

function getFcHashStrFromFile(filepath) {
	return new Promise((resolve, reject) => {
		var hashStr = '';

		if (filepath instanceof Buffer) {
			hashStr = getFcStrFromBuffer(filepath);
			return hashStr ? resolve(hashStr) : reject(null);
		}

		try {
			fs.open(filepath, 'r', function (err, fd) {
				if (err) {
					return reject(err);
				}

				var hashBuffer = bufferShim.alloc(FC_HASH_MAX_LENGTH, 0);
				fs.read(fd, hashBuffer, 0, FC_HASH_MAX_LENGTH, 0, function (err) {
					if (err) {
						return reject(err);
					}

					var hashStr = getFcStrFromBuffer(hashBuffer);
					hashStr = hashStr ? hashStr.trim() : hashStr;

					fs.close(fd);

					return hashStr ? resolve(hashStr) : reject(null);
				});
			})
		} catch (e) {
			return reject(e);
		}
	});
}

var dirname = path.dirname;
function getDirname(path) {
	return dirname(path);
}
