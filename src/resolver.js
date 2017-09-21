/**
 * @module cartographer/resolver
 */

let fs = require('fs');
let path = require('path');
let File = require('vinyl');

/**
 * A regular expression used to test a requirement path to see
 * if it is for a module or for a relative path
 * @type {RegExp}
 */
const RELATIVE_PATH = /^(\/|\.\/|\.\.\/)/;

/**
 * This module provides an extended NodeJS resolver that can be
 * configured to look beyond the typical resolution path
 */
class Resolver {
    constructor(options = {}) {
        this.options = {
            extensions: options.extensions || ['', '.js'],
            modules:    options.modules    || ['node_modules'],
            packages:   options.packages   || ['package.json'],
            mains:      options.mains      || [['main']],
            index:      options.index      || 'index'
        }
    }

    /**
     * Attempts to load the given file with the series of different
     * extensions the resolver is configured with
     * @param  {String}   fileName The file to attempt the load of
     * @param  {Number}   [ext]    The current extension to test
     * @param  {Function} cb       A function to call when either the file has
     *                             been resolved, an error has occurred, or no
     *                             file has been found after all attempts
     */
    loadFile(fileName, ext, cb) {
        // allow the extension number to be omitted
        if(arguments.length == 2) {
            cb = ext;
            ext = 0;
        }

        // if we've tried all the extensions consider it a failure
        if(ext >= this.options.extensions.length) {
            return cb();
        }

        // construct the real file name
        let realName = fileName + this.options.extensions[ext];

        // provide the file from cache if available
        if(Resolver.cache[realName]) {
            return cb(null, Resolver.cache[realName]);
        }

        // otherwise lookup the current file from the file system
        fs.readFile(realName, (err, contents) => {
            if(err) {
                return this.loadFile(fileName, ext + 1, cb);
            }

            Resolver.cache[realName] = new File({
                path : realName,
                contents: contents
            });

            cb(null, Resolver.cache[realName]);
        });
    }

    /**
     * Given a package file, get the appropriate entry point
     * @param  {Object} packageData A package file to search for entries in
     * @return {String} The entry point from the package main, or the
     *                  configured default if no main can be found
     */
    getEntryPoint(packageData) {
        for(let main of this.options.mains) {
            // if entry is not an array wrap it for single path
            if(!(main instanceof Array)) {
                main = [main];
            }

            // walk package object for this main entry until either
            // we run out of object levels in the package or we reach
            // the end of this main definition
            let packageLevel = packageData;
            for(let level of main) {
                packageLevel = packageLevel[level];
                if(!packageLevel) {
                    break;
                }
            }

            // if there is a defined package level assume it is the
            // entry point that we are looking for
            if(packageLevel) {
                return packageLevel;
            }
        }

        // when all else fails assume the normal index file
        return this.options.index;
    }

    /**
     * Attempts to load the given directory, first looking for a
     * package file within it, and then looking for a default file fallback
     * @param  {String}   directory     The directory that should be attempted
     * @param  {Number}   [packageFile] The current configured package to attempt to load
     * @param  {Function} cb            The function to call when the module is resolved
     */
    loadDirectory(directory, packageFile, cb) {
        if(arguments.length == 2) {
            cb = packageFile;
            packageFile = 0;
        }

        // if none of the package files could be found, attempt a base file load
        if(packageFile >= this.options.packages.length) {
            return this.loadFile(path.resolve(directory, this.options.index), cb);
        }

        let packagePath = path.resolve(directory, this.options.packages[packageFile]);

        fs.readFile(packagePath, (err, packageData) => {
            // if an error occurred then try the next file
            if(err) {
                return this.loadDirectory(directory, packageFile + 1, cb);
            }

            // otherwise attempt to get the entry from the package
            try {
                packageData = JSON.parse(packageData);
            } catch(err) {
                return cb(`Package file is incorrectly formatted: ${packagePath}`);
            }

            // get the entry for the package, resolve relative to the directory
            let entry = this.getEntryPoint(packageData);
            entry = path.resolve(directory, entry);

            // attempt the entry load as a regular file
            this.loadFile(entry, (err, file) => {
                // if a file was loaded we are done
                if(file) {
                    return cb(null, file);
                }

                // otherwise try to load the entry as an index file
                let entryIndex = path.resolve(entry, this.options.index);
                this.loadFile(entryIndex, (err, file) => {
                    // if this ended in a file we are done
                    if(file) {
                        return cb(null, file);
                    }

                    // otherwise we will trigger the directory index load skipping
                    // all remaining packages since we only want to consider the first
                    // package file at this point in time
                    this.loadDirectory(directory, this.options.packages.length, cb);
                });
            });
        });
    }

    /**
     * Attempts to resolve a relative path to a file by loading it
     * as a directory if it is one or a file if it is not
     * @param  {String}   module The path to a possible module to load
     * @param  {Function} cb     The function to call when the module is resolved
     */
    resolveRelative(module, cb) {
        // attempt to load the module as a file first
        this.loadFile(module, (err, file) => {
            // if we found a file we are done
            if(file) {
                return cb(null, file);
            }

            // otherwise we must now try to load this module as a directory
            this.loadDirectory(module, cb);
        });
    }

    /**
     * Attempts to resolve a module by attempting a directory load in
     * the given base and module name, continuing up the directory
     * tree until either a module is found or the end of the tree is
     * has been reached. At each base path this will attempt to load
     * the named module from each of the configured module directory paths.
     * @param  {String}   base          The base path to look for the module in
     * @param  {String}   moduleName    The name of the module to locate
     * @param  {Number}   [directory=0] The current module directory to search in
     * @param  {Function} cb            The function to call when the module is resolved
     */
    resolveModule(base, moduleName, directory, cb) {
        // allow current to be an optional parameter
        if(arguments.length === 3) {
            cb = directory;
            directory = 0;
        }

        // if we don't have any more bases, consider the resolution failed
        if(base.length == 0) {
            return cb();
        }

        let module = path.resolve(base, this.options.modules[directory], moduleName);
        this.resolveRelative(module, (err, file) => {
            if(file) {
                return cb(null, file);
            }
            directory += 1;
            if(directory >= this.options.modules.length) {
                base = base.substring(0, base.lastIndexOf(path.sep));
                directory = 0;
            }

            this.resolveModule(base, moduleName, directory, cb);
        });
    }

    /**
     * Attempts to resolve the given module using the NodeJS require resolution
     * algorithm with extensions based on the configuration of this instance.
     * @param  {String}   module The name of the module to resolve
     * @param  {String}   [base] The base path to use for the resolution, defaults
     *                           to the current process working directory
     * @param  {Function} cb     A function to call with the file if found
     */
    resolve(module, base, cb) {
        if(arguments.length == 2) {
            cb = base;
            base = process.cwd();
        }

        if(!module || !cb) {
            throw new Error('Must pass module to resolve and a callback');
        }

        if(module.match(RELATIVE_PATH)) {
            // track if the module ends in a trailing slash
            let hadTrailingSlash = module[module.length - 1] == '/';

            // make the module path absolute
            module = path.resolve(base, module);

            // add back the slash if it was there to ensure proper resolution
            // note: we only have to do this for this resolution, all subsequent
            // resolutions will properly be requesting directories or files, not both
            if(hadTrailingSlash) {
                module += '/';
            }

            this.resolveRelative(module, cb);
        } else {
            this.resolveModule(base, module, cb);
        }
    }
}

/**
 * The internal cache used to avoid unnecessary file system calls
 * The mapping is absolute path to vinyl file and is shared across
 * all resolver instances.
 * @type {Object}
 */
Resolver.cache = {};

module.exports = Resolver
