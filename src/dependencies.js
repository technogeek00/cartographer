var fs = require('fs');
var path = require('path');
var vinyl = require('vinyl');
var Required = require('./required');
var Resolver = require('./resolver');

/**
 * This module provides a recursive search ability that takes
 * a given file and returns the tree of dependencies formed by
 * requirement statements amoung all files used
 * @module cartographer/dependencies
 */
function Dependencies(options) {
    options = options || {};
    this.resolver = options.resolver || new Resolver(options.resolverOptions);
}

/**
 * An internal cache that maps resolved dependencies to their file,
 * the cache is stored per directory to account for path searches
 * as part of the file resolutions
 * @type {Object}
 */
Dependencies.cache = {}

/**
 * Helper used to resolve the requirements of the given file
 * using asynchronous file system queries
 * @param  {Vinyl}    file         The file currently being analyzed
 * @param  {Object[]} requirements The requirements identified for this file
 * @param  {Number}   index        The index of the requirement to process
 * @param  {Function} cb           The function ta call after analysis is complete
 */
Dependencies.prototype.resolveRequirements = function(file, requirements, index, cb) {
    var that = this;
    // if we've processed them all continue to the next set
    if(requirements.length == index) {
        return cb();
    }

    var requirement = requirements[index];

    // for dynamic dependencies we don't attempt resolving
    if(!requirement.static) {
        file.dependencies.push({
            path: requirement.path,
            static: requirement.static,
            references : requirement.references,
            file : null,
            error : "Unable to resolve dynamic dependency"
        });
        return this.resolveRequirements(file, requirements, index + 1, cb);
    }

    // for static dependencies see if we already have a resolution
    var dirname = file.dirname;
    if(Dependencies.cache[dirname] && Dependencies.cache[dirname][requirement.path]) {
        var cacheResult = Dependencies.cache[dirname][requirement.path];
        file.dependencies.push({
            path: requirement.path,
            static: requirement.static,
            references : requirement.references,
            file : cacheResult.file,
            error : cacheResult.error
        });
        return this.resolveRequirements(file, requirements, index + 1, cb);
    }

    // static dependencies have not been found yet, go ahead and resolve it
    this.resolver.resolve(requirement.path, file.dirname, function(err, dependent) {
        if(!dependent) {
            err = "Unable to locate dependency";
            dependent = null;
        }

        // Cache the result, including errors
        Dependencies.cache[dirname] = Dependencies.cache[dirname] || {};
        Dependencies.cache[dirname][requirement.path] = {
            file : dependent,
            error : err
        };

        file.dependencies.push({
            path: requirement.path,
            static: requirement.static,
            references : requirement.references,
            file : dependent,
            error : err
        });

        if(dependent) {
            // if we did indeed find a file, resolve its dependencies
            that.analyze(dependent, function() {
                // then continue with the current ones
                that.resolveRequirements(file, requirements, index + 1, cb);
            });
        } else {
            // otherwise resolve the next dependency of the current file
            that.resolveRequirements(file, requirements, index + 1, cb);
        }
    });
}

/**
 * Analyze the given file to find the tree of dependencies created by
 * the requirement calls within the file
 * @param  {Vinyl}    file The file to analyze
 * @param  {Function} cb   The function to call when analysis is complete
 */
Dependencies.prototype.analyze = function(file, cb) {
    // if file is incompatible don't process it
    if(!vinyl.isVinyl(file) || file.isNull()) {
        return;
    }

    // if the file has already been processed don't do it again
    if(file.dependencies) {
        return cb();
    }

    // setup a dependencies array
    file.dependencies = [];

    // otherwise compute the dependencies for this file
    var requirements = Required.analyze(file);

    // and then resolve the dependencies of those files
    this.resolveRequirements(file, requirements, 0, cb);
}

module.exports = Dependencies
