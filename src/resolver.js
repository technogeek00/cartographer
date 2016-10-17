var fs = require('fs');
var path = require('path');
var File = require('vinyl');

/**
 * A regular expression used to test a requirement path to see
 * if it is for a module or for a relative path
 * @type {RegExp}
 */
var RELATIVE_PATH = /^(\/|\.\/|\.\.\/)/;

/**
 * This module provides an extended NodeJS resolver that can be
 * configured to look beyond the typical resolution path
 * @module cartographer/resolver
 */
function Resolver(options) {
    options = options || {};

    this.extensions = options.extensions || ['', '.js'];
    this.modules    = options.modules    || ['node_modules'];
    this.packages   = options.packages   || ['package.json'];
    this.mains      = options.mains      || ['main'];
    this.index      = options.index      || 'index';
}

/**
 * The internal cache used to avoid unnecessary file system calls
 * The mapping is absolute path to vinyl file and is shared across
 * all resolver instances.
 * @type {Object}
 */
Resolver.cache = {};

/**
 * Attempts to load the given file with the series of different
 * extensions the resolver is configured with
 * @param  {String}   fileName The file to attempt the load of
 * @param  {Number}   [ext]    The current extension to test
 * @param  {Function} cb       A function to call when either the file has
 *                             been resolved, an error has occurred, or no
 *                             file has been found after all attempts
 */
Resolver.prototype.loadFile = function(fileName, ext, cb) {
    var that = this;

    // allow the extension number to be omitted
    if(arguments.length == 2) {
        cb = ext;
        ext = 0;
    }

    // if we've tried all the extensions consider it a failure
    if(ext >= this.extensions.length) {
        return cb();
    }

    // construct the real file name
    var realName = fileName + this.extensions[ext];

    // provide the file from cache if available
    if(Resolver.cache[realName]) {
        return cb(null, Resolver.cache[realName]);
    }

    // otherwise lookup the current file from the file system
    fs.readFile(realName, function(err, contents) {
        if(err) {
            return that.loadFile(fileName, ext + 1, cb);
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
Resolver.prototype.getEntryPoint = function(packageData) {
    var main = null;
    for(var i = 0; i < this.mains.length; i++) {
        main = this.mains[i];
        if(packageData[main]) {
            return packageData[main];
        }
    }
    return this.index;
}

/**
 * Attempts to load the given directory, first looking for a
 * package file within it, and then looking for a default file fallback
 * @param  {String}   directory     The directory that should be attempted
 * @param  {Number}   [packageFile] The current configured package to attempt to load
 * @param  {Function} cb            The function to call when the module is resolved
 */
Resolver.prototype.loadDirectory = function(directory, packageFile, cb) {
    var that = this;
    if(arguments.length == 2) {
        cb = packageFile;
        packageFile = 0;
    }

    // if none of the package files could be found, attempt a base file load
    if(packageFile >= this.packages.length) {
        return this.loadFile(path.resolve(directory, this.index), cb);
    }

    // construct a wrapper to allow us to attempt different package file loads
    nextWrapper = function(err, file) {
        // if an error occurred or file was found stop now
        if(err || file) {
            return cb(err, file);
        }

        // otherwise attempt the next package type
        that.loadDirectory(directory, packageFile + 1, cb);
    }

    var packagePath = path.resolve(directory, this.packages[packageFile]);

    fs.readFile(packagePath, function(err, packageData) {
        // if an error occurred then try the next file
        if(err) {
            return that.loadDirectory(directory, packageFile + 1, cb);
        }

        // otherwise attempt to get the entry from the package
        try {
            packageData = JSON.parse(packageData);
        } catch(err) {
            return cb("File is incorrectly formatted: " + packagePath);
        }

        var entry = that.getEntryPoint(packageData);
        that.loadFile(path.resolve(directory, entry), cb);
    });
}

/**
 * Attempts to resolve a relative path to a file by loading it
 * as a directory if it is one or a file if it is not
 * @param  {String}   module The path to a possible module to load
 * @param  {Function} cb     The function to call when the module is resolved
 */
Resolver.prototype.resolveRelative = function(module, cb) {
    var that = this;
    fs.stat(module, function(err, stat) {
        if(stat && stat.isDirectory()) {
            that.loadDirectory(module, cb);
        } else {
            that.loadFile(module, cb);
        }
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
Resolver.prototype.resolveModule = function(base, moduleName, directory, cb) {
    var that = this;

    // allow current to be an optional parameter
    if(arguments.length === 3) {
        cb = directory;
        directory = 0;
    }

    // if we don't have any more base, consider the resolution failed
    if(base.length == 0) {
        return cb();
    }

    var module = path.resolve(base, this.modules[directory], moduleName);
    this.loadDirectory(module, function(err, file) {
        if(file) {
            return cb(null, file);
        }
        directory += 1;
        if(directory >= that.modules.length) {
            base = base.substring(0, base.lastIndexOf(path.sep));
            directory = 0;
        }

        that.resolveModule(base, moduleName, directory, cb);
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
Resolver.prototype.resolve = function(module, base, cb) {
    if(arguments.length == 2) {
        cb = base;
        base = process.cwd();
    }

    if(!module || !cb) {
        throw new Error("Must pass module to resolve and a callback");
    }

    if(module.match(RELATIVE_PATH)) {
        this.resolveRelative(path.resolve(base, module), cb);
    } else {
        this.resolveModule(base, module, cb);
    }
}

module.exports = Resolver
