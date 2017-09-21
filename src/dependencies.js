/**
 * @module  cartographer/dependencies
 */

let fs = require('fs');
let path = require('path');
let vinyl = require('vinyl');

let Declarations = require('./declarations');
let Resolver     = require('./resolver');

/**
 * This module provides the ability to take and analyze a file and all
 * its recursively import dependencies to build a full dependency tree
 * that may be used for file packaging
 */
class Dependencies {
    constructor(options = {}) {
        this.resolver = options.resolver || new Resolver(options.resolverOptions);
    }

    /**
     * Helper used to resolve the imports of the given file using asynchronous
     * file system queries
     * @param  {Vinyl}    file   The file currently being analyzed
     * @param  {Number}   index  The index of the current import to process
     * @param  {Function} cb     The function ta call after analysis is complete
     */
    resolveImports(file, index, cb) {
        // allow index to be omitted
        if(arguments.length == 2) {
            cb = index;
            index = 0;
        }

        // if we've processed them all imports we are done
        if(file.imports.length == index) {
            return cb();
        }

        // get the import we are currently inspecting
        let imported = file.imports[index];

        // for dynamic dependencies we don't attempt resolving
        // we don't attempt to resolve dynamic imports
        if(!imported.static) {
            imported.file = null;
            imported.error = 'Unable to resolve dynamic import';
            return this.resolveImports(file, index + 1, cb);
        }

        // helper to continue resolving, may be called sync or async
        let continueResolving = () => {
            this.resolveImports(file, index + 1, cb);
        }

        // for static imports see if we already have a resolution
        let dirname = file.dirname;
        if(Dependencies.cache[dirname] && Dependencies.cache[dirname][imported.path]) {
            let cacheResult = Dependencies.cache[dirname][imported.path];
            imported.file = cacheResult.file;
            imported.error = cacheResult.error;
            return continueResolving();
        }

        // static imports have not been found yet, go ahead and resolve it
        this.resolver.resolve(imported.path, dirname, (err, dependent) => {
            if(!dependent) {
                err = 'Unable to locate import';
                dependent = null;
            }

            // Cache the result, including errors
            Dependencies.cache[dirname] = Dependencies.cache[dirname] || {};
            Dependencies.cache[dirname][imported.path] = {
                file : dependent,
                error : err
            };

            imported.file = dependent;
            imported.error = err;

            if(dependent) {
                // if we did indeed find a file, resolve its dependencies before continuing
                this.analyze(dependent, continueResolving)
            } else {
                // otherwise continue directly
                continueResolving();
            }
        });
    }

    /**
     * Analyze the given file to find the tree of dependencies creaded by the
     * import calls within the file
     * @param  {Vinyl}    file The file to analyze
     * @param  {Function} cb   The function to call when analysis is complete
     */
    analyze(file, cb) {
        // if file is incompatible don't process it
        if(!vinyl.isVinyl(file) || file.isNull()) {
            return;
        }

        // if the file has already been processed for declarations we
        // dont have to process this file again
        if(file.imports) {
            return cb();
        }

        // analyze the file for declarations
        file = Declarations.analyze(file);

        // and then resolve the dependencies of those files
        this.resolveImports(file, cb);
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
