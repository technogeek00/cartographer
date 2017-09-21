/**
 * @module cartographer
 */
let Resolver = require('./resolver');
let Declarations = require('./declarations');
let Dependencies = require('./dependencies');

/**
 * A module for analyzing javascript source files to produce a tree
 * of dependencies based on the requirement calls within them
 */
class Cartographer {
    constructor(options = {}) {
        this.resolver     = options.resolver     || new Resolver(options.resolverOptions);
        this.dependencies = options.dependencies || new Dependencies({
            resolver : this.resolver
        });
    }

    /**
     * This callback is executed at the completion of a dependency analysis
     * cycle. If a fatal error occurs during analysis it will be handed to
     * this callback as the first argument, if the analysis is able to complete
     * the file corresponding to the filename originally given to analyze will
     * be given to the callback as a Vinyl file with an additional 'dependencies'
     * attribute that contains the calculated dependencies
     * @note it is possible for errors to occur during the resolution of dependencies
     *       that are not fatal errors, the dependency will be marked as an error if
     *       such one occurs
     * @typedef {Function} analyzeCallback
     * @param {Error} err   A fatal error that occurred during analysis
     * @param {Vinyl} file  The vinyl file corresponding to the given file name
     * @memberof module:cartographer~Cartographer
     */

    /**
     * Takes the given file name and attempts to produce a complete
     * dependency tree based on the require calls within that file
     * and any subsequently required files.
     * @param  {String}                       fileName The file to find dependencies from
     * @param  {analyzeCallback} cb       A function to call when analysis is complete
     */
    analyze(fileName, cb) {
        this.resolver.resolve(fileName, (err, file) => {
            if(err || !file) {
                return cb(err || `File not found: ${fileName}`);
            }

            this.dependencies.analyze(file, (err) => {
                cb(err, err ? null : file)
            });
        });
    };
}

/**
 * The module resolver class used by cartographer
 * @memberof module:cartographer
 * @see module:cartographer/resolver~Resolver
 */
Cartographer.Resolver = Resolver;

/**
 * The declaration analysis class used by cartographer
 * @memberof module:cartographer
 * @see module:cartographer/declarations
 */
Cartographer.Declarations = Declarations;

/**
 * The dependency resolver class used by cartographer
 * @memberof module:cartographer
 * @see module:cartographer/dependencies~Dependencies
 */
Cartographer.Dependencies = Dependencies;

module.exports = Cartographer;
