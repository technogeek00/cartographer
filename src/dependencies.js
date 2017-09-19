let fs = require('fs');
let path = require('path');
let vinyl = require('vinyl');

let Required = require('./required');
let Resolver = require('./resolver');

/**
 * This module provides a recursive search ability that takes
 * a given file and returns the tree of dependencies formed by
 * requirement statements amoung all files used
 * @module cartographer/dependencies
 */
class Dependencies {
    constructor(options = {}) {
        this.resolver = options.resolver || new Resolver(options.resolverOptions);
    }

    /**
     * Helper used to resolve the requirements of the given file
     * using asynchronous file system queries
     * @param  {Vinyl}    file         The file currently being analyzed
     * @param  {Object[]} requirements The requirements identified for this file
     * @param  {Number}   index        The index of the requirement to process
     * @param  {Function} cb           The function ta call after analysis is complete
     */
    resolveRequirements(file, requirements, index, cb) {
        var that = this;

        // allow index to be omitted
        if(arguments.length == 3) {
            cb = index;
            index = 0;
        }

        // if we've processed them all continue to the next set
        if(requirements.length == index) {
            return cb();
        }

        // get the requirement we are currently inspecting
        let requirement = requirements[index];

        // for dynamic dependencies we don't attempt resolving
        if(!requirement.static) {
            file.dependencies.push({
                path: requirement.path,
                static: requirement.static,
                references : requirement.references,
                file : null,
                error : 'Unable to resolve dynamic dependency'
            });
            return this.resolveRequirements(file, requirements, index + 1, cb);
        }

        // for static dependencies see if we already have a resolution
        let dirname = file.dirname;
        if(Dependencies.cache[dirname] && Dependencies.cache[dirname][requirement.path]) {
            let cacheResult = Dependencies.cache[dirname][requirement.path];
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
        this.resolver.resolve(requirement.path, dirname, (err, dependent) => {
            if(!dependent) {
                err = 'Unable to locate dependency';
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
                this.analyze(dependent, () => {
                    // then continue with the current ones
                    this.resolveRequirements(file, requirements, index + 1, cb);
                });
            } else {
                // otherwise resolve the next dependency of the current file
                this.resolveRequirements(file, requirements, index + 1, cb);
            }
        });
    }

    /**
     * Analyze the given file to find the tree of dependencies created by
     * the requirement calls within the file
     * @param  {Vinyl}    file The file to analyze
     * @param  {Function} cb   The function to call when analysis is complete
     */
    analyze(file, cb) {
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
        let requirements = Required.analyze(file);

        // and then resolve the dependencies of those files
        this.resolveRequirements(file, requirements, cb);
    }
}

/**
 * An internal cache that maps resolved dependencies to their file,
 * the cache is stored per directory to account for path searches
 * as part of the file resolutions
 * @type {Object}
 */
Dependencies.cache = {}

module.exports = Dependencies
