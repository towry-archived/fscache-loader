/**
 * @file Speed up the webpack build time.
 * @author Towry Wang, http://towry.me
 * @copyright MIT 
 */ 

const utils = require('loader-utils');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mkdirp = require('mkdirp');
const chalk = require('chalk');

const CACHE_FOLDER = '.webpack_cache';

function cacheLoader(source) {
	this.cacheable && this.cacheable();
	
	var config = getConfig(this);

	!config.silent && 
		console.log('[fscache-loader] cache file ' + 
			chalk.white(getRelativePath(this.resource, config.context)) + 
			" was " +
			chalk.yellow("created"));

	var cachePath = path.join(config.context, CACHE_FOLDER);
	var cacheFilePath = getCacheFilePath(this.resource, config.context, cachePath);
	var cacheFileHashPath = getCacheFileHashPath(cacheFilePath);

	// Save the source to cache file.
	var callback = this.async();

	if (!callback) {
		return;
	}
	
	var self = this;
	writeFile(cacheFilePath, source, function (err) {
		if (err) {
			return callback(err);
		}
		// Save the hash info.
		var hash = getFileHash(self.resource);
		writeFile(cacheFileHashPath, hash, function (err) {
			if (err) {
				return callback(err);
			}

			callback(null, source);
		})
	});
}
module.exports = cacheLoader;

cacheLoader.pitch = function () {
	var config = getConfig(this);

	var cachePath = path.join(config.context, CACHE_FOLDER);
	var cacheFilePath = getCacheFilePath(this.resource, config.context, cachePath);
	var cacheFileHashPath = getCacheFileHashPath(cacheFilePath);
	if (notChanged(cacheFileHashPath, this.resource)) {
		
		!config.silent && 
			console.log("[fscache-loader] cache file " + 
				chalk.white(getRelativePath(this.resource, config.context)) + 
				" was " +
				chalk.green("used"));
		
		return getCacheContent(cacheFilePath);
	}
}

/**
 * Get the loader config.
 */
function getConfig(context) {
	var options = context.options;
	if (!options.context) {
		throw new Error("You must specific context option in webpack config.");
	}

	var query = utils.parseQuery(context.query);
	var key = query.config || "fscacheLoader";
	var config = options[key] || {};

	config.context = options.context;
	return config;
}

/**
 * Get the path of cached file.
 */
function getCacheFilePath(pathString, part, repl) {
	return pathString.replace(part, repl);
}

function getCacheFileHashPath(pathString) {
	return pathString + '.cache';
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
 * Get file hash.
 */
function getFileHash(request) {
	var buffer = fs.readFileSync(request);
	var hash = crypto.createHash('md5');
	hash.update(buffer);
	return hash.digest('hex');
}

/**
 * Get cache content.
 */
function getCacheContent(request) {
	var content = fs.readFileSync(request, {encoding: 'utf8'});
	return content;
}

function writeFile(name, content, cb) {
	mkdirp(getDirname(name), function (err) {
		if (err) return cb(err);

		fs.writeFile(name, content, cb);
	})
}

var dirname = path.dirname;
function getDirname(path) {
	return dirname(path);
}

function getRelativePath(fullpath, context) {
	var p = fullpath.replace(context, '');
	if (p[0] === '/') {
		return p.substr(1);
	} 

	return p;
}
